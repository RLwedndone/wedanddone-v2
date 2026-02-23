// src/components/floral/FloralIntro.tsx
import React from "react";

interface FloralIntroProps {
  onContinue: () => void;
  onClose: () => void;
}

const FloralIntro: React.FC<FloralIntroProps> = ({ onContinue, onClose }) => {
  return (
    <div className="pixie-card wd-page-turn">
      {/* Pink X */}
      <button
        className="pixie-card__close"
        onClick={onClose}
        aria-label="Close"
      >
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      {/* Scrollable body */}
      <div className="pixie-card__body">
        {/* Title Image */}
        <img
          src={`${import.meta.env.BASE_URL}assets/images/FloralTitle.png`}
          alt="Floral Picker"
          className="px-media px-media--md"
        />

        {/* Looping Intro Video */}
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/floral_intro_loop.mp4`}
          autoPlay
          muted
          playsInline
          loop
          className="px-media px-media--lg"
        />

        {/* Description */}
        <h2 className="px-intro-title">Get ready to bloom!</h2>
        <p className="px-prose-narrow">
          In this boutique, you’ll pick a floral palette for your bouquet and
          personal flowers, as well as a style for your reception tables.
          <br />
          Then simply pick how many you need. ✨
        </p>

{/* 💬 Founder Note */}
<div
  style={{
    margin: "1.25rem auto 1.75rem",
    maxWidth: 520,
    textAlign: "left",
    background: "rgba(240,246,255,0.85)",
    borderRadius: 16,
    padding: "14px 16px",
    boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
  }}
>
  {/* Small h2-style title */}
  <h2
    style={{
      fontSize: "1.6rem",
      fontWeight: 900,
      color: "#2c62ba",
      marginBottom: 8,
      display: "flex",
      alignItems: "center",
      gap: 12,
    }}
  >
    <img
      src={`${import.meta.env.BASE_URL}assets/images/KFounder1x1.webp`}
      alt="Karen, co-founder of Wed&Done"
      style={{
        width: 64,
        height: 64,
        borderRadius: 12,
        objectFit: "cover",
        flexShrink: 0,
      }}
    />
    Karen explains why this works
  </h2>

  <p
    style={{
      fontSize: "0.95rem",
      lineHeight: 1.45,
      color: "#333",
      margin: 0,
      fontStyle: "italic",
    }}
  >
    “You don’t need to become a flower expert to have incredible florals.
    <br /><br />
    Our florist is an artist. She designs around your season, your venue, and your budget — so everything looks intentional and breathtaking.
    <br /><br />
    You choose the feeling. We take care of the flowers.”
  </p>
</div>

        {/* Continue CTA */}
        <button
          type="button"
          className="boutique-primary-btn"
          onClick={onContinue}
        >
          Use the Picker!
        </button>
      </div>
    </div>
  );
};

export default FloralIntro;