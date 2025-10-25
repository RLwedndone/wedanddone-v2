import React, { useEffect } from "react";
import playMagicSound from "../../utils/playMagicSound";

interface JamThankYouInitialProps {
  onClose: () => void;
}

const JamThankYouInitial: React.FC<JamThankYouInitialProps> = ({ onClose }) => {
  useEffect(() => {
    playMagicSound();
    window.dispatchEvent(new Event("userPurchaseMade"));
    window.dispatchEvent(new Event("jamGrooveCompletedNow"));
    console.log("🎧 Jam & Groove booking complete — events dispatched!");
  }, []);

  return (
    <div
      className="pixie-overlay"
      style={{ zIndex: 2000 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="pixie-card pixie-card--modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Pink X */}
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
        </button>
  
        <div className="pixie-card__body" style={{ textAlign: "center" }}>
          <video
            src={`${import.meta.env.BASE_URL}assets/videos/frog_thanks.mp4`}
            autoPlay
            loop
            muted
            playsInline
            className="px-media"
            style={{
              maxWidth: 160,
              borderRadius: 16,
              margin: "0 auto 12px",
              display: "block",
            }}
          />
  
          <h2 className="px-title" style={{ marginBottom: 8 }}>
            Your DJ is officially booked! 🎶
          </h2>
  
          <p className="px-prose-narrow" style={{ marginBottom: 16 }}>
            You’ll find the receipt in your <strong>Docs</strong>. Way to go! Another wedding vendor booked and another big checkmark on the ol' to-do list.
          </p>
  
          <button
  className="boutique-primary-btn"
  onClick={onClose}
  style={{ display: "block", margin: "0 auto" }}
>
  Close
</button>
        </div>
      </div>
    </div>
  );
};

export default JamThankYouInitial;