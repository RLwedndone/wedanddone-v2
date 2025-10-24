import React from "react";

type MadgeChatModalProps = {
  onClose: () => void;
};

const MadgeChatModal: React.FC<MadgeChatModalProps> = ({ onClose }) => {
  const isMobile = window.innerWidth <= 600;

  return (
    <>
      {/* Dimmed backdrop */}
      <div
        onClick={onClose} // Close when backdrop is clicked
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "rgba(0, 0, 0, 0.4)",
          zIndex: 1000,
        }}
      />

      {/* Chat iframe container */}
      <div
        style={{
          position: "fixed",
          bottom: isMobile ? "120px" : "90px",
          right: isMobile ? "auto" : "20px",
          left: isMobile ? "50%" : "auto",
          transform: isMobile ? "translateX(-50%)" : "none",
          width: isMobile ? "360px" : "500px",
          height: isMobile ? "420px" : "550px",
          backgroundColor: "#fff",
          borderRadius: "24px",
          boxShadow: "0 0 20px rgba(0,0,0,0.3)",
          zIndex: 1001,
          overflow: "hidden",
        }}
      >
        <iframe
          src="https://www.chatbase.co/chatbot-iframe/yWFNZP1pCCxy1Ij-_ECgP"
          width="100%"
          height="100%"
          style={{
            border: "none",
          }}
          frameBorder="0"
        ></iframe>
      </div>
    </>
  );
};

export default MadgeChatModal;