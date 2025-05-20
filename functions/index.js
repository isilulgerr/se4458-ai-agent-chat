const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();
const db = admin.firestore();

// Load secrets from Firebase config
const DUMMY_JWT = functions.config().secrets.dummy_jwt;
const GATEWAY_URL = "https://de50-212-253-192-115.ngrok-free.app";

exports.onMessageCreate = onDocumentCreated("messages/{msgId}", async (event) => {
  const messageData = event.data.data();

  console.log("📩 Incoming user message:", messageData.message);

  if (!messageData || messageData.sender !== "user") {
    console.log("Message is not from a user or is empty. Aborting.");
    return;
  }

  // Avoid duplicate AI responses
  const existing = await db.collection("messages")
    .where("sender", "==", "ai")
    .where("response_to", "==", messageData.message)
    .limit(1)
    .get();

  if (!existing.empty) {
    console.log("⏩ Message already handled. Skipping duplicate response.");
    return;
  }

  const payload = {
    sender: DUMMY_JWT,
    message: messageData.message
  };

  try {
    const res = await axios.post(GATEWAY_URL, payload, {
      validateStatus: () => true
    });

    console.log("✅ Gateway Response:", res.data);
    console.log("HTTP Status Code:", res.status);
    const responseData = res.data;

    // Handle explicit error returned by Gateway
    if (responseData && responseData.error) {
      console.log("⚠️ Gateway returned an error:", responseData.error);
      await db.collection("messages").add({
        sender: "ai",
        message: {
          error: responseData.error,
        },
        response_to: messageData.message,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      return;
    }

    // Handle HTTP-level error without specific error message
    if (res.status >= 400) {
      console.error(`❌ Gateway returned error status (${res.status}) without explicit error message.`);
      await db.collection("messages").add({
        sender: "ai",
        message: {
          error: `API Error: Gateway returned status ${res.status}`,
          details: responseData ? JSON.stringify(responseData) : "No additional error details provided."
        },
        response_to: messageData.message,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      return;
    }

    // Save successful response
    await db.collection("messages").add({
      sender: "ai",
      message: responseData,
      response_to: messageData.message,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("✔️ AI response successfully written to Firestore.");

  } catch (error) {
    console.error("❌ AXIOS or unexpected runtime error:", error.message);

    // Avoid duplicate error logging
    const alreadyResponded = await db.collection("messages")
      .where("sender", "==", "ai")
      .where("response_to", "==", messageData.message)
      .limit(1)
      .get();

    if (!alreadyResponded.empty) {
      console.log("⛔ Skipping duplicate error log entry.");
      return;
    }

    // Log general error
    await db.collection("messages").add({
      sender: "ai",
      message: {
        error: "API Call Error",
        details: error.message
      },
      response_to: messageData.message,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("❌ General API call error written to Firestore.");
  }
});
