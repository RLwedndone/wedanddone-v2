import React from "react";
import "../styles/globals/GlobalOverlayStyles.css";

interface MagicOverlayProps {
  children: React.ReactNode;
  onClose?: () => void;
}

const MagicOverlay: React.FC<MagicOverlayProps> = ({ children, onClose }) => {
  return (
    <div className="pixie-overlay">
      <div className="pixie-white-card">
        {onClose && (
          <button className="magic-overlay-close" onClick={onClose}>
            ✖
          </button>
        )}
        {children}
      </div>
    </div>
  );
};

export default MagicOverlay;