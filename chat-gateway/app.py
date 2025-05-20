from flask import Flask, request, jsonify
from flask_cors import CORS
import openai
import os
import requests
import firebase_admin
from firebase_admin import credentials, firestore
from google.cloud.firestore_v1 import SERVER_TIMESTAMP
from dotenv import load_dotenv
import json

load_dotenv()
DUMMY_JWT = os.getenv("DUMMY_JWT")

# OpenAI ve Midterm API URL
openai.api_key = os.getenv("OPENAI_API_KEY")
MIDTERM_API_URL = os.getenv("MIDTERM_API_URL")

# Firebase başlat
cred = credentials.Certificate("firebase_config.json")
firebase_admin.initialize_app(cred)
db = firestore.client()

# Flask setup
print(">> LOADED APP <<")
app = Flask(__name__)
print("Gateway app loaded!")
CORS(app)

@app.route("/ping", methods=["GET"])
def ping():
    return jsonify({"msg": "pong"}), 200

@app.route("/gateway/message", methods=["POST"])
def handle_message():
    data = request.get_json(force=True, silent=True) or {}
    message = data.get("message")
    sender = data.get("sender")

    if not message:
        return jsonify({"status": "error", "message": "Missing 'message' field"}), 400

    # Gelişmiş prompt
    system_prompt = (
        "You are an API command generator. For each user message, respond ONLY with a JSON like this:\n"
        '{ "intent": "calculate_bill", "parameters": { "subscriber_id": "123", "month": "2025-12" } }\n'
        'or:\n'
        '{ "intent": "pay_bill", "parameters": { "subscriber_id": "123", "month": "2025-12" } }\n'
        "Valid intents: calculate_bill, pay_bill, get_bill_details.\n" # get_bill_details intent'ini de ekledim
        "Respond ONLY with valid JSON. No explanations."
    )

    parsed_json = {} # parsed_json'ı tanımladım
    try:
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ],
            max_tokens=150,
            temperature=0.0
        )
        parsed = response.choices[0].message.content.strip()
        parsed_json = json.loads(parsed)
        intent = parsed_json.get("intent")
        params = parsed_json.get("parameters", {})
        print("LLM Output - Calling Midterm API with intent:", intent, "and params:", params)

    except Exception as e:
        # LLM parsing hatasını standart hata formatında döndür
        return jsonify({"status": "error", "message": "LLM intent/parameter parsing failed", "details": str(e)}), 500

    midterm_response_data = {}
    midterm_status_code = 500 # Varsayılan hata kodu

    # Midterm API’ye yönlendir
    try:
        headers = {"Authorization": f"Bearer {sender}"}
        midterm_api_url = None
        method = None

        if intent == "calculate_bill":
            midterm_api_url = f"{MIDTERM_API_URL}/calculate-bill"
            method = "post"
        elif intent == "get_bill_details":
            midterm_api_url = f"{MIDTERM_API_URL}/bill/details"
            method = "get"
        elif intent == "pay_bill":
            midterm_api_url = f"{MIDTERM_API_URL}/pay-bill"
            method = "post"
        else:
            # Bilinmeyen intent durumunu standart hata formatında döndür
            return jsonify({"status": "error", "message": "Unknown intent", "details": f"Intent: {intent}"}), 400

        if method == "post":
            midterm_response = requests.post(midterm_api_url, json=params, headers=headers)
        elif method == "get":
            midterm_response = requests.get(midterm_api_url, params=params, headers=headers)
        
        midterm_status_code = midterm_response.status_code

        try:
            # Midterm API'den gelen yanıtı JSON olarak ayrıştırmaya çalış
            midterm_response_data = midterm_response.json()
        except json.JSONDecodeError:
            # JSON formatında olmayan yanıtları veya boş yanıtları hata olarak ele al
            midterm_response_data = {"message": midterm_response.text if midterm_response.text else "Midterm API returned non-JSON or empty response"}
            if midterm_response.status_code >= 400:
                midterm_response_data["status"] = "error" # Hata durumunda statüsü 'error' yap
                midterm_response_data["details"] = f"HTTP Status: {midterm_response.status_code}"

        # Midterm API'den 4xx veya 5xx durum kodu gelirse veya yanıt içinde 'error' alanı varsa
        if midterm_status_code >= 400:
            error_message = (midterm_response_data.get("error") or # Postman'da gördüğün {"error": "No usage found..."} formatı için
                             midterm_response_data.get("message") or # Diğer olası hata mesajı alanları
                             f"Midterm API Error: Status {midterm_status_code}")

            # Gateway'den standardize edilmiş hata yanıtı döndür
            return jsonify({"status": "error", "message": error_message, "details": midterm_response_data}), midterm_status_code
        
        # Başarılı yanıt durumunda
        final_response_data = {"status": "success", "data": midterm_response_data}


    except requests.exceptions.RequestException as e:
        # Midterm API'ye istek atılamaması (ağ hatası, sunucu kapalı vb.) durumunu yakala
        # Standart hata formatında döndür
        return jsonify({"status": "error", "message": "Midterm API request failed", "details": str(e)}), 503 # Service Unavailable

    # Firestore’a başarılı yanıtı yaz (sadece başarılı durumlarda)
    # Hata durumları zaten yukarıda return ile sonlandırılıyor.
    db.collection("messages").add({
        "sender": "ai",
        "message": final_response_data, # Standartlaştırılmış başarılı yanıtı kaydet
        "timestamp": SERVER_TIMESTAMP,
        "response_to": message
    })
    print(">> Parsed JSON from OpenAI:", parsed_json) # Bu LLM'den gelen intent/params
    print(">> Midterm response status:", midterm_status_code)
    print("LLM Output:", parsed_json) # Bu LLM'den gelen intent/params
    print("Authorization header:", request.headers.get("Authorization"))
    print("📥 Gelen sender:", sender)

    # Gateway'den istemciye (Cloud Function) standart yanıtı döndür
    return jsonify(final_response_data), 200 # Başarılı yanıt her zaman 200 dönsün

if __name__ == "__main__":
    print("Starting app...")
    app.run(debug=True)