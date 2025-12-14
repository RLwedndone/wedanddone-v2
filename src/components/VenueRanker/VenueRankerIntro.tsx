// src/components/VenueRanker/VenueRankerIntro.tsx
import React from "react";
import "../../styles/globals/boutique.master.css";

interface VenueRankerIntroProps {
  onContinue: () => void;
  onClose: () => void;
}

const VenueRankerIntro: React.FC<VenueRankerIntroProps> = ({ onContinue, onClose }) => {
  return (
    <div className="pixie-card wd-page-turn">
      {/* 🩷 Pink X inside the card */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      {/* Scrollable body */}
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        {/* 🖼️ Title Image */}
        <img
          src={`${import.meta.env.BASE_URL}assets/images/venue_title.png`}
          alt="Venue Ranker"
          className="px-media px-media--sm"
          style={{ maxWidth: 200, marginBottom: "1rem" }}
        />

        {/* 🎥 Intro Video */}
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/venue_intro_loop.mp4`}
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
          Find the perfect place for your "I do's"!
        </h2>
        <p className="px-prose-narrow" style={{ marginBottom: 6 }}>
          Peek at all the magical venues across Arizona — or let us help you discover your perfect vibe!
        </p>
        <p className="px-prose-narrow" style={{ marginBottom: 20 }}>
          However you explore, your dream venue is just a few clicks away.
        </p>

        {/* 👉 Continue Button */}
        <div className="px-cta-col" style={{ gap: 10 }}>
          <button className="boutique-primary-btn" onClick={onContinue}>
            Let’s Start Ranking!
          </button>
        </div>
      </div>
    </div>
  );
};

export default VenueRankerIntro;