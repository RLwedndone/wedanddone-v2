// src/components/floral/FloralThankYouInitial.tsx
import React, { useEffect } from "react";
import playMagicSound from "../../utils/playMagicSound";

interface Props { onClose: () => void; }

const FloralThankYouInitial: React.FC<Props> = ({ onClose }) => {
  useEffect(() => {
    playMagicSound();
    window.dispatchEvent(new Event("purchaseMade"));
    window.dispatchEvent(new Event("floralCompletedNow"));
  }, []);

  return (
    <div className="pixie-card wd-page-turn">
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/unicorn_thankyou.mp4`}
          autoPlay loop muted playsInline
          className="px-media"
          style={{ maxWidth: 260, margin: "16px auto" }}
        />
        <p className="px-prose-narrow" style={{ marginBottom: 22 }}>
          Your floral selections are on their way to the florist!
          <br /><br />
          You’ll find your receipt in the <strong>Docs</strong> folder
          (click the little gold bar in the top-right of your dashboard ✨).
          <br /><br />
          You can always return to the Floral Picker to make additional purchases anytime!
        </p>
        <button className="boutique-primary-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};

export default FloralThankYouInitial;