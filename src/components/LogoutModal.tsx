// src/components/LogoutModal.tsx
import React from "react";

interface LogoutModalProps {
  onClose: () => void;
}

const LogoutModal: React.FC<LogoutModalProps> = ({ onClose }) => {
  return (
    <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      width: "100vw",
      height: "100vh",
      backgroundColor: "rgba(0, 0, 0, 0.5)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 9999
    }}>
      <div style={{
        background: "white",
        borderRadius: "2rem",
        padding: "3rem",
        textAlign: "center",
        boxShadow: "0 0 30px rgba(0,0,0,0.2)",
        maxWidth: "400px",
        width: "90%",
      }}>
        <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>👋</div>
        <h2 style={{ fontSize: "1.8rem", color: "#2c62ba", marginBottom: "1rem" }}>You’ve been logged out</h2>
        <p style={{ marginBottom: "2rem" }}>Go sprinkle some magic somewhere else… or log back in below!</p>
        <button
          className="boutique-primary-btn"
          onClick={onClose}
          style={{ padding: "0.75rem 2rem", fontSize: "1rem" }}
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
};

export default LogoutModal;