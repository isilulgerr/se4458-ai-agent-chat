# 🔌 Gateway API for SE4458 Mobile Billing System

This is a Flask-based Gateway API built as part of the SE4458 course assignment project. It connects a chat-based frontend (via Firebase) with the Midterm API backend. The gateway extracts intent from user messages using OpenAI GPT, then securely routes requests to the backend using JWT.

---

## 📁 Source Code

👉 [View Full Project on GitHub](https://github.com/isilulgerr/se4458-gateway-api)

---

## 🎬 Video Presentation

📺 [Click to Watch Project Demo](https://drive.google.com/drive/folders/19rEQja9tu-O9IlGBLkqARx_J4neUVG7N?usp=drive_link)

---

## 🏗️ Project Design

The system consists of three main layers:

1. **Firebase Cloud Function**  
   - Listens for new user messages from Firestore  
   - Sends them to the gateway API with a JWT token

2. **Gateway API (Flask)**  
   - Receives the message and token  
   - Uses OpenAI GPT to extract structured intent (e.g., `calculate_bill`, `pay_bill`)  
   - Sends the structured request to the Midterm API  
   - Returns the result to Firestore as an AI response

3. **Midterm Billing API**  
   - Processes billing logic and returns responses based on intent

---

## 📌 Assumptions

- All user messages contain intent that can be interpreted by GPT in a single step
- The backend API supports all defined intents (calculate, pay, get bill)
- JWT token passed from Firebase is valid and maps to a known subscriber
- The Midterm API returns JSON-formatted responses

### 🐛 Issues Encountered
- GitHub Push Protection blocked commits containing .env files with secrets; resolved via BFG Repo Cleaner and .gitignore update.

- Initial deployment to Render failed due to gunicorn not being installed correctly and build commands not being recognized.

- While trying Firebase Cloud Functions, we had difficulties passing headers securely to the gateway and verifying if a response already existed.

- ngrok occasionally failed with gateway connection.

- Firebase Firestore requires unique handling of duplicate message responses; Firestore triggers were refined accordingly.

---

## ⚠️ Development Decisions & Issues Encountered

- 🔍 **OpenAI Integration**: Special care was taken to ensure GPT always returned valid JSON. Fallbacks and error handling were added for robustness.
- 🌐 **Deployment Options Explored**:  
  Render and cloud-based hosting were initially evaluated. However, for more controlled testing and flexible debugging, a local-first approach was adopted using **ngrok**.
- 🛠️ **Ngrok Tunneling**: Enabled seamless external access to the local gateway API. Cloud Function was configured to target the latest ngrok URL.
- 🔐 **JWT Handling**: Proper authorization headers were included in all Midterm API calls.
- 🧠 **Duplicate Firebase Initialization**: Prevented with `if not firebase_admin._apps` guard.
- ❗ **Error Standardization**: All responses (success or error) follow a consistent JSON format to support frontend rendering.

---

## ✅ How to Run the Gateway API

### 🔧 Prerequisites:
- Python 3.9+
- OpenAI API Key
- Ngrok (for tunneling)

### 🧪 Local Setup:

1. Clone the repo and install dependencies:
   ```bash
   pip install -r requirements.txt

### 💡 Technologies Used
Python (Flask)

Firebase Admin SDK

Firestore Database

OpenAI GPT-3.5 Turbo API

Ngrok (secure local tunnel)

Postman (for testing)

### 👤 Developer
Işıl Ülger