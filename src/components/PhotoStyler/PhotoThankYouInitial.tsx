// src/components/photo/PhotoThankYouInitial.tsx
import React, { useEffect } from "react";
import playMagicSound from "../../utils/playMagicSound";

interface PhotoThankYouInitialProps {
  onClose: () => void;
}

const PhotoThankYouInitial: React.FC<PhotoThankYouInitialProps> = ({ onClose }) => {
  useEffect(() => {
    playMagicSound();
    window.dispatchEvent(new Event("userPurchaseMade"));
    window.dispatchEvent(new Event("photoCompletedNow"));
    console.log("📸 Initial Photo Styler booking complete — events dispatched!");
  }, []);

  return (
    <div className="pixie-card wd-page-turn">
      {/* 🩷 Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/dragon_thanks.mp4`}
          autoPlay
          loop
          muted
          playsInline
          className="px-media"
          style={{ maxWidth: 260, margin: "16px auto" }}
        />

        <p className="px-prose-narrow" style={{ marginBottom: 22 }}>
          Your photographer is officially booked!
          <br /><br />
          You can view the receipt in your <strong>Docs</strong>, and come back here anytime
          to add an engagement session, albums, or more time.
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

export default PhotoThankYouInitial;