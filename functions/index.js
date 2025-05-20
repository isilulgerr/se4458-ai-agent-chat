const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require("axios");

admin.initializeApp();
const db = admin.firestore();

// 🔥 Firebase config'ten alınan sabitler
const DUMMY_JWT = functions.config().secrets.dummy_jwt;
const GATEWAY_URL = functions.config().secrets.gateway_url;

exports.onMessageCreate = onDocumentCreated("messages/{msgId}", async (event) => {
  const messageData = event.data.data();

  console.log("📩 Gelen kullanıcı mesajı:", messageData.message);
  console.log("🪪 Kullanılan JWT:", DUMMY_JWT);

  // Kullanıcı mesajı değilse veya boşsa işlemi durdur
  if (!messageData || messageData.sender !== "user") {
    console.log("Mesaj kullanıcıdan gelmiyor veya boş. İşlem durduruluyor.");
    return;
  }

  // 🔁 Bu mesaja daha önce cevap verilmiş mi kontrol et
  // Eğer 'ai' tarafından bu 'messageData.message'a bir 'response_to' alanı ile yanıt verilmişse, tekrar işlem yapma.
  const existing = await db.collection("messages")
    .where("sender", "==", "ai")
    .where("response_to", "==", messageData.message)
    .limit(1)
    .get();

  if (!existing.empty) {
    console.log("⏩ Bu mesaja zaten cevap verilmiş, atlanıyor...");
    return;
  }

  const payload = {
    sender: DUMMY_JWT,
    message: messageData.message
  };

  try {
    // Axios çağrısı: validateStatus sayesinde 4xx ve 5xx gibi durumlar catch'e düşmez,
    // yanıt 'res.data' ve 'res.status' üzerinden kontrol edilir.
    const res = await axios.post(GATEWAY_URL, payload, {
      validateStatus: () => true // Tüm durum kodlarını başarılı olarak kabul et
    });

    console.log("✅ Gateway Yanıtı:", res.data);
    console.log("HTTP Durum Kodu:", res.status);
    const responseData = res.data;

    // Gateway'den bir hata mesajı gelip gelmediğini kontrol et
    // Postman çıktına göre hata 'error' alanı içinde geliyor.
    if (responseData && responseData.error) {
      console.log("⚠️ Gateway'den hata yanıtı alındı:", responseData.error);
      await db.collection("messages").add({
        sender: "ai",
        // Hata mesajını doğrudan 'message' alanına yaz, böylece frontend tekil olarak işleyebilir.
        message: {
          error: responseData.error, // Spesifik hata mesajı
        },
        response_to: messageData.message,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      // Hata mesajı yazıldıktan sonra fonksiyonu sonlandır, catch bloğuna düşmesini engelle
      return;
    }

    // HTTP durum kodu 2xx değilse ve responseData içinde error yoksa, bu da bir hatadır.
    // Örneğin, Gateway'den 404 dönüp de error alanı boş gelirse.
    if (res.status >= 400) {
      console.error(`❌ Gateway'den hata durum kodu (${res.status}) alındı, ancak spesifik hata mesajı yok.`);
      await db.collection("messages").add({
        sender: "ai",
        message: {
          error: `API Error: Gateway returned status ${res.status}`,
          details: responseData ? JSON.stringify(responseData) : "No specific error details from Gateway."
        },
        response_to: messageData.message,
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });
      return;
    }

    // Başarılı yanıt durumu
    await db.collection("messages").add({
      sender: "ai",
      message: responseData, // Gateway'den gelen başarılı yanıtı doğrudan kaydet
      response_to: messageData.message,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("✔️ Başarılı yanıt Firestore'a yazıldı.");

  } catch (error) {
    // Axios'un kendisinden kaynaklanan bir ağ hatası veya kod hatası durumunda buraya düşer.
    // validateStatus: () => true olduğu için buraya nadiren düşülmeli.
    console.error("❌ AXIOS HATA VEYA İŞLENEMEYEN KOD HATASI:", error.message);

    // Bu catch bloğuna düşüldüğünde (genellikle ağ hataları), daha önce yanıt verilip verilmediğini kontrol etmek
    // hala önemli olabilir, ancak genellikle bu bir ilktir.
    const alreadyResponded = await db.collection("messages")
      .where("sender", "==", "ai")
      .where("response_to", "==", messageData.message)
      .limit(1)
      .get();

    if (!alreadyResponded.empty) {
      console.log("⛔ Yinelenen hata günlüğe kaydedilmesi atlanıyor (zaten bir yanıt/hata yazılmış olabilir).");
      return;
    }

    await db.collection("messages").add({
      sender: "ai",
      message: {
        error: "API Çağrısı Hatası", // Daha genel bir hata mesajı
        details: error.message // Detaylar
      },
      response_to: messageData.message,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log("❌ Genel API çağrısı hatası Firestore'a yazıldı.");
  }
});