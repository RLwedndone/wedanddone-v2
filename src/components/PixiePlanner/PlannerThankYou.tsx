// src/components/planner/PlannerThankYou.tsx
import React, { useEffect } from "react";
import playMagicSound from "../../utils/playMagicSound";

interface PlannerThankYouProps {
  onClose: () => void;
}

const PlannerThankYou: React.FC<PlannerThankYouProps> = ({ onClose }) => {
  useEffect(() => {
    playMagicSound();
    window.dispatchEvent(new Event("userPurchaseMade"));
    window.dispatchEvent(new Event("plannerCompletedNow"));
    console.log("🧚 Planner booking complete — events dispatched!");
  }, []);

  return (
    <div className="pixie-card--modal">
      {/* Pink Close X */}
      <button
        className="pixie-card__close"
        onClick={onClose}
        aria-label="Close"
      >
        <img src="/assets/icons/pink_ex.png" alt="Close" />
      </button>

      {/* Body */}
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        {/* ✨ Video */}
<video
  src="/assets/videos/venue_thanks.mp4"
  autoPlay
  loop
  muted
  playsInline
  className="px-media--sm"
  style={{
    display: "block",
    margin: "0 auto 1rem", // centers + adds spacing below
    borderRadius: "12px",  // optional, to match your other thank you screens
  }}
/>

        {/* 🎉 Message */}
        <h2 className="px-title" style={{ marginBottom: "0.75rem" }}>
          You’ve officially booked planning with your very own Pixie! 🪄
        </h2>

        <p className="px-prose-narrow" style={{ marginBottom: "1.5rem" }}>
          You’ll find a copy of your contract in the{" "}
          <strong>Docs</strong> folder of your magical dashboard.
          <br />
          <br />
          Check out the rest of our Button Boutiques to keep the magic going
          and cross off more wedding to-do list items! 💖
        </p>

        {/* CTA */}
        <div className="px-cta-col">
          <button className="boutique-primary-btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlannerThankYou;