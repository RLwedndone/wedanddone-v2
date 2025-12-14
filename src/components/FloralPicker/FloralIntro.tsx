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
        <p className="px-prose-narrow">
        <h2 className="px-intro-title">Get ready to bloom!</h2>
          In this boutique, you’ll pick a floral palette for your bouquet and
          personal flowers, as well as a style for your reception tables.
          <br />
          Then simply pick how many you need. ✨
        </p>

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