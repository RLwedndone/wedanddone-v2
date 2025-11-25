// src/components/MenuScreens/PixiePurchaseThankYou.tsx
import React, { useEffect } from "react";
import playMagicSound from "../../utils/playMagicSound";

interface Props {
  onClose: () => void;
}

const PixiePurchaseThankYou: React.FC<Props> = ({ onClose }) => {
  useEffect(() => {
    // Mirror FloralThankYouInitial behaviour
    playMagicSound();

    // (Optional) these are probably already fired in checkout,
    // but they won’t hurt if duplicated:
    window.dispatchEvent(new Event("purchaseMade"));
    window.dispatchEvent(new Event("documentsUpdated"));
    window.dispatchEvent(new Event("budgetUpdated"));
  }, []);

  return (
    <div className="pixie-card">
      <button
        className="pixie-card__close"
        onClick={onClose}
        aria-label="Close"
      >
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/pix_thankyou.mp4`}
          autoPlay
          loop
          muted
          playsInline
          className="px-media"
          style={{ maxWidth: 260, margin: "16px auto" }}
        />
        <p className="px-prose-narrow" style={{ marginBottom: 22 }}>
          Your Pixie Purchase has been paid in full! ✨
          <br />
          <br />
          You’ll find your receipt in the <strong>Docs</strong> folder
          (click the little gold bar in the top-right of your dashboard).
          <br />
          <br />
          You can always come back here if the Pixies cook up something new.
        </p>
        <button className="boutique-primary-btn" onClick={onClose}>
          Back to my dashboard
        </button>
      </div>
    </div>
  );
};

export default PixiePurchaseThankYou;