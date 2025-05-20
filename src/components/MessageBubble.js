import React from "react";
import "../styles/MessageBubble.css";

const MessageBubble = ({ sender, text }) => {
  const isUser = sender === "user";
  let parsed;

  try {
    parsed = typeof text === "string" ? JSON.parse(text) : text;
  } catch (e) {
    parsed = null;
  }

  const renderAIContent = () => {
    if (!parsed || typeof parsed !== "object") return <span>{text}</span>;

    if (parsed.error) {
      return (
        <div className="ai-card error">
          <p><b>⚠️ Error:</b> {parsed.error}</p>
        </div>
      );
    }

    if (parsed.msg) {
      return (
        <div className="ai-card error">
          <p><b>⚠️ Error:</b> {parsed.msg}</p>
        </div>
      );
    }

    // Bill Summary
    if (parsed.amount_due && parsed.due_date && parsed.month) {
      return (
        <div className="ai-card">
          <h4>📋 Bill Summary</h4>
          <p><b>Month:</b> {parsed.month}</p>
          <p><b>Amount Due:</b> ${parsed.amount_due}</p>
          <p><b>Due Date:</b> {parsed.due_date}</p>
          <p>Would you like to see the detailed bill or proceed with payment?</p>
        </div>
      );
    }

    // Bill Details
    if (parsed.base_plan && parsed.extra_usage && parsed.vat !== undefined) {
      return (
        <div className="ai-card">
          <h4>📑 Bill Details</h4>
          <p><b>Base Plan:</b> ${parsed.base_plan}</p>
          <p><b>Extra Usage:</b> ${parsed.extra_usage}</p>
          <p><b>Taxes (VAT):</b> ${parsed.vat}</p>
          <p><b>Total Due:</b> ${parsed.total}</p>
          <p><b>Due Date:</b> {parsed.due_date}</p>
        </div>
      );
    }

    // Payment confirmation
    if (parsed.success === true) {
      return (
        <div className="ai-card success">
          <h4>✅ Payment Successful!</h4>
          <p><b>Amount:</b> ${parsed.amount}</p>
        </div>
      );
    }

    // Basic total usage
    if (parsed.total !== undefined && parsed.internet_mb !== undefined && parsed.phone_minutes !== undefined) {
      return (
        <div className="ai-card">
          <h4>📊 Monthly Usage Summary</h4>
          <p><b>Internet:</b> {parsed.internet_mb} MB</p>
          <p><b>Phone:</b> {parsed.phone_minutes} min</p>
          <p><b>Total:</b> ${parsed.total}</p>
        </div>
      );
    }

    // (fallback)
    return <pre>{JSON.stringify(parsed, null, 2)}</pre>;
  };

  return (
    <div className={`bubble-wrapper ${isUser ? "user" : "ai"}`}>
      <div className={`bubble ${isUser ? "user-bubble" : "ai-bubble"}`}>
        {isUser ? text : renderAIContent()}
      </div>
    </div>
  );
};

export default MessageBubble;
