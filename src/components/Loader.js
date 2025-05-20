import React from "react";
import "../styles/Loader.css";

const Loader = () => {
  return (
    <div className="loader-container">
      <div className="typing-indicator">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <p>AI is typing...</p>
    </div>
  );
};

export default Loader;
