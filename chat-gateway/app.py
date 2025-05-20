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

# Load environment variables
load_dotenv()

DUMMY_JWT = os.getenv("DUMMY_JWT")
openai.api_key = os.getenv("OPENAI_API_KEY")
MIDTERM_API_URL = os.getenv("MIDTERM_API_URL")
firebase_config_str = os.getenv("FIREBASE_CONFIG_JSON")

# Load Firebase config (from env or local file)
if not firebase_config_str:
    try:
        with open("firebase_config.json", "r") as f:
            firebase_config = json.load(f)
        print("Loaded Firebase config from local file.")
    except FileNotFoundError:
        raise ValueError("Missing FIREBASE_CONFIG_JSON env variable or firebase_config.json file.")
else:
    firebase_config = json.loads(firebase_config_str)
    print("Loaded Firebase config from environment variable.")

# Initialize Firebase
cred = credentials.Certificate(firebase_config)
if not firebase_admin._apps:
    firebase_admin.initialize_app(cred)
db = firestore.client()
print("✅ Firebase initialized.")

# Initialize Flask app
app = Flask(__name__)
CORS(app)
print("✅ Gateway API is loaded and CORS enabled.")

@app.route("/ping", methods=["GET"])
def ping():
    """Simple health check endpoint."""
    return jsonify({"msg": "pong"}), 200


@app.route("/gateway/message", methods=["POST"])
def handle_message():
    """
    Handles a user message:
    - Extracts intent and parameters using OpenAI
    - Routes to Midterm API
    - Saves the response to Firestore
    """
    data = request.get_json(force=True, silent=True) or {}
    message = data.get("message")
    sender = data.get("sender")
    message_id = data.get("message_id")

    if not message:
        print("❌ Missing 'message' field in request.")
        return jsonify({"error": "Missing 'message' field"}), 400

    system_prompt = (
        "You are an API command generator. For each user message, respond ONLY with a JSON like this:\n"
        '{ "intent": "calculate_bill", "parameters": { "subscriber_id": "123", "month": "2025-12" } }\n'
        'or:\n'
        '{ "intent": "pay_bill", "parameters": { "subscriber_id": "123", "month": "2025-12" } }\n'
        'or:\n'
        '{ "intent": "get_bill_details", "parameters": { "subscriber_id": "123", "month": "2025-12" } }\n'
        "Valid intents: calculate_bill, pay_bill, get_bill_details.\n"
        "Respond ONLY with valid JSON. No explanations."
    )

    try:
        print(f"🔍 Sending message to OpenAI: '{message}'")
        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": message}
            ],
            max_tokens=150,
            temperature=0.0
        )
        llm_output_text = response.choices[0].message.content.strip()
        print(f"🧠 OpenAI raw response: {llm_output_text}")
        parsed_llm_json = json.loads(llm_output_text)
        intent = parsed_llm_json.get("intent")
        params = parsed_llm_json.get("parameters", {})
        print(f"✅ Extracted intent: {intent}, parameters: {params}")

    except json.JSONDecodeError as e:
        print(f"❌ Failed to parse OpenAI JSON. Details: {e}")
        return jsonify({"error": "LLM parsing failed", "details": "Invalid JSON from LLM"}), 500
    except Exception as e:
        print(f"❌ OpenAI API error: {e}")
        return jsonify({"error": "LLM API failed", "details": str(e)}), 500

    midterm_response_data = {}
    midterm_status_code = 500
    try:
        headers = {"Authorization": f"Bearer {sender}"}

        if intent == "calculate_bill":
            print(f"📡 Sending 'calculate-bill' request to Midterm API: {params}")
            midterm_response = requests.post(f"{MIDTERM_API_URL}/calculate-bill", json=params, headers=headers)
        elif intent == "get_bill_details":
            print(f"📡 Sending 'bill/details' request to Midterm API: {params}")
            midterm_response = requests.get(f"{MIDTERM_API_URL}/bill/details", params=params, headers=headers)
        elif intent == "pay_bill":
            print(f"📡 Sending 'pay-bill' request to Midterm API: {params}")
            midterm_response = requests.post(f"{MIDTERM_API_URL}/pay-bill", json=params, headers=headers)
        else:
            print(f"❌ Unknown intent: {intent}")
            return jsonify({"error": "Unknown intent", "details": f"Intent '{intent}' is not recognized."}), 400

        midterm_status_code = midterm_response.status_code
        print(f"🔁 Midterm API returned status code: {midterm_status_code}")

        try:
            midterm_response_data = midterm_response.json()
        except json.JSONDecodeError:
            print("❌ Midterm API returned non-JSON response.")
            midterm_response_data = {
                "error": "Invalid response format from Midterm API",
                "details": midterm_response.text
            }

    except requests.exceptions.RequestException as e:
        print(f"❌ Failed to reach Midterm API. Details: {e}")
        midterm_response_data = {"error": "Midterm API request failed", "details": str(e)}
        return jsonify(midterm_response_data), 500

    # Save response to Firestore
    db.collection("messages").add({
        "sender": "ai",
        "message": midterm_response_data,
        "timestamp": SERVER_TIMESTAMP,
        "response_to": message_id or message
    })
    print("✅ AI response saved to Firestore.")

    return jsonify(midterm_response_data), midterm_status_code


if __name__ == "__main__":
    print("🚀 Starting Gateway App...")
    app.run(debug=True, host='0.0.0.0', port=int(os.getenv("PORT", 5000)))
