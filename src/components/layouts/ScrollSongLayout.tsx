import React from "react";
import "../../styles/layouts/ScrollSongLayout.css";

interface ScrollSongLayoutProps {
  title: string;
  sealImageSrc?: string;
  onClose: () => void;
  onSave: () => void;
  children: React.ReactNode;
}

const ScrollSongLayout: React.FC<ScrollSongLayoutProps> = ({
  title,
  sealImageSrc,
  onClose,
  onSave,
  children,
}) => {
  return (
    <div className="scroll-song-overlay">
      <div className="scroll-song-card">
        {onClose && (
          <img
            src="/assets/icons/pink_ex.png"
            alt="Close"
            className="custom-x-button"
            onClick={onClose}
          />
        )}

        <h2 className="scroll-song-title">{title}</h2>

        {/* ✨ Gold seal image */}
        {sealImageSrc && (
          <img
            src={sealImageSrc}
            alt="Scroll Seal"
            className="scroll-song-seal"
          />
        )}

        <div className="scroll-song-form">
          {children}

          <button className="scroll-save-btn" onClick={onSave}>
            Save & Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScrollSongLayout;