// src/components/floral/FloralThankYouAddOn.tsx
import React, { useEffect } from "react";
import playMagicSound from "../../utils/playMagicSound";

interface FloralThankYouAddOnProps {
  onClose: () => void;
}

const FloralThankYouAddOn: React.FC<FloralThankYouAddOnProps> = ({ onClose }) => {
  useEffect(() => {
    playMagicSound();
    window.dispatchEvent(new Event("userPurchaseMade"));
    window.dispatchEvent(new Event("floralCompletedNow"));
    console.log("🌸 Floral add-on booking complete — events dispatched!");
  }, []);

  return (
    <div className="pixie-card">
      {/* ✨ Pink X close button */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      {/* 🌸 Card body */}
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        {/* 🎥 Thank-you animation */}
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/unicorn_thankyou.mp4`}
          autoPlay
          loop
          muted
          playsInline
          className="px-media"
          style={{
            maxWidth: "260px",
            borderRadius: "12px",
            marginBottom: "1.75rem",
          }}
        />

        {/* 🌸 Message text */}
        <p
          className="px-prose-narrow"
          style={{
            fontSize: "1rem",
            lineHeight: "1.6",
            marginBottom: "2rem",
            maxWidth: "480px",
          }}
        >
          Your floral add-ons are on their way to the florist!
          <br />
          <br />
          You’ll find your new receipt in the <strong>Docs</strong> folder of your magical dashboard.
          <br />
          <br />
          You can return to the Floral Picker any time to add more items.
        </p>

        {/* 💙 Close button */}
        <button className="boutique-primary-btn" onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
};

export default FloralThankYouAddOn;