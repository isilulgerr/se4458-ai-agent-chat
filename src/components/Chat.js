import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import axios from "axios";
import MessageBubble from "./MessageBubble";
import Loader from "./Loader";
import "../styles/Chat.css";
const DUMMY_JWT = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc0NzY5Njk5OCwianRpIjoiYjBjMTliMmEtYWRmMS00ZjQzLTk0Y2ItMmYwMGRhZDI0ZjQxIiwidHlwZSI6ImFjY2VzcyIsInN1YiI6IjEyMyIsIm5iZiI6MTc0NzY5Njk5OCwiY3NyZiI6ImRhYjI0ODk5LWM2M2ItNGI4NC1hNmM2LWVjMmIyN2EyOTQzYiIsImV4cCI6MTc0Nzc4MzM5OH0.-s5xj7SowuJbJZzz_AJM0U_fL9DGBSQs9RiL2uKjoQ8";
const Chat = () => {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const q = query(collection(db, "messages"), orderBy("timestamp"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = {
      sender: "user",
      message: input,
      timestamp: serverTimestamp(),
    };

    await addDoc(collection(db, "messages"), userMessage);
    setInput("");
    setLoading(true);

    try {
      await axios.post("http://127.0.0.1:5000/gateway/message", {
        sender: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJmcmVzaCI6ZmFsc2UsImlhdCI6MTc0NzY5Njk5OCwianRpIjoiYjBjMTliMmEtYWRmMS00ZjQzLTk0Y2ItMmYwMGRhZDI0ZjQxIiwidHlwZSI6ImFjY2VzcyIsInN1YiI6IjEyMyIsIm5iZiI6MTc0NzY5Njk5OCwiY3NyZiI6ImRhYjI0ODk5LWM2M2ItNGI4NC1hNmM2LWVjMmIyN2EyOTQzYiIsImV4cCI6MTc0Nzc4MzM5OH0.-s5xj7SowuJbJZzz_AJM0U_fL9DGBSQs9RiL2uKjoQ8",
        message: input,
      });
    } catch (error) {
      console.error("Gateway error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-container">
      <div className="messages-box">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            sender={msg.sender}
            text={
              typeof msg.message === "object"
                ? JSON.stringify(msg.message, null, 2)
                : msg.message
            }
          />
        ))}
        {loading && <Loader />}
      </div>
      <div className="input-area">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type your question..."
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
};

export default Chat;
