// src/components/photo/PhotoThankYouAddOn.tsx
import React, { useEffect } from "react";
import playMagicSound from "../../utils/playMagicSound";

interface PhotoThankYouAddOnProps {
  onClose: () => void;
}

const PhotoThankYouAddOn: React.FC<PhotoThankYouAddOnProps> = ({ onClose }) => {
  useEffect(() => {
    playMagicSound();
    window.dispatchEvent(new Event("userPurchaseMade"));
    window.dispatchEvent(new Event("photoCompletedNow"));
    console.log("📸 Photo Styler add-on purchase complete — events dispatched!");
  }, []);

  return (
    <div className="pixie-card pixie-card--modal">
      {/* 🩷 Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src="/assets/icons/pink_ex.png" alt="Close" />
      </button>

      {/* 🌟 Body */}
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <video
          src="/assets/videos/dragon_thanks.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="px-media"
          style={{ maxWidth: 220, margin: "0 auto 1rem" }}
        />

        <h2
          className="px-title"
          style={{
            fontSize: "1.8rem",
            marginBottom: "1rem",
            color: "#2c62ba",
          }}
        >
          Photo Add-On Confirmed!
        </h2>

        <p
          className="px-prose-narrow"
          style={{
            fontSize: "1.05rem",
            lineHeight: 1.6,
            marginBottom: "2rem",
          }}
        >
          Alrighty, Style Seeker! Your new purchases are locked in. ✨
          <br />
          <br />
          You’ll find your updated receipt in your <strong>Docs</strong> folder.
          <br />
          <br />
          Come back to the Photo Styler any time to add more goodies!
        </p>

        <div className="px-cta-col">
          <button className="boutique-primary-btn px-btn-200" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoThankYouAddOn;