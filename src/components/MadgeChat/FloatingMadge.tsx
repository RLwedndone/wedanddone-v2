import React, { useState } from "react";

interface FloatingMadgeProps {
  isChatOpen: boolean;
  onClick: () => void;
}

const FloatingMadge: React.FC<FloatingMadgeProps> = ({ isChatOpen, onClick }) => {
    const [isHovered, setIsHovered] = useState(false);
  
    if (isChatOpen) return null; // Hide when modal is open
  
    const iconSrc = "/assets/images/question_mark.png";
  
    return (
      <div
        style={{
          position: "fixed",
          bottom: "1.5rem",
          right: "1.5rem",
          zIndex: 800,
        }}
      >
        <button
          onClick={onClick}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          style={{
            backgroundColor: "transparent",
            border: "none",
            cursor: "pointer",
            transition: "transform 0.3s ease",
            transform: isHovered ? "scale(1.05)" : "scale(1)",
          }}
        >
          <img
            src={iconSrc}
            alt="Chat with Madge"
            style={{
              width: "clamp(60px, 10vw, 120px)",
              height: "clamp(60px, 10vw, 120px)",
            }}
          />
        </button>
      </div>
    );
  };

export default FloatingMadge;