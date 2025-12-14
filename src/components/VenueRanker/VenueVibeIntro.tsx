// src/components/VenueRanker/VenueVibeIntro.tsx
import React from "react";
import "../../styles/globals/boutique.master.css";

interface VenueVibeIntroProps {
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
}

const VenueVibeIntro: React.FC<VenueVibeIntroProps> = ({
  onContinue,
  onBack,
  onClose,
}) => {
  return (
    <div className="pixie-card wd-page-turn">
      {/* 🩷 Pink X inside the card */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      {/* Scrollable body */}
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        {/* 🖼️ Title Image (reuse venue title or swap later) */}
        <img
          src={`${import.meta.env.BASE_URL}assets/images/vibe_title.png`}
          alt="Venue Vibes"
          className="px-media px-media--sm"
          style={{ maxWidth: 220, marginBottom: "1rem" }}
        />

        {/* 🎥 Vibe Intro Video (you can swap this filename later) */}
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/vibe_intro_loop.mp4`}
          autoPlay
          muted
          playsInline
          loop
          className="px-media"
          style={{
            maxWidth: 350,
            borderRadius: 20,
            marginBottom: "1rem",
            display: "block",
            marginInline: "auto",
          }}
        />

        {/* ✨ Whimsical Copy */}
        <h2 className="px-intro-title" style={{ marginBottom: 8 }}>
          Let’s dial in your wedding vibe!
        </h2>
        <p className="px-prose-narrow" style={{ marginBottom: 6 }}>
          Before we start ranking castles and barns and ballrooms, we need to
          know what kind of magic you’re dreaming about.
        </p>
        <p className="px-prose-narrow" style={{ marginBottom: 6 }}>
          On the next screen, you’ll see a set of “vibes” — things like Desert
          Dream, Garden Greenery, Modern, and more.
        </p>
        <p className="px-prose-narrow" style={{ marginBottom: 20 }}>
          <strong>Pick at least three vibes</strong> that feel right for your
          day. Once you do, we’ll build a custom list of venues that match your
          style and let you rank them one by one.
        </p>

        {/* 👉 Buttons */}
        <div className="px-cta-col" style={{ gap: 10 }}>
          <button className="boutique-primary-btn" onClick={onContinue}>
            Help Me Pick My Vibe
          </button>

          <button className="boutique-back-btn" onClick={onBack}>
              ← Back
            </button>
        </div>
      </div>
    </div>
  );
};

export default VenueVibeIntro;