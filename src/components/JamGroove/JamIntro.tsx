// src/components/jam/JamIntro.tsx
import React from "react";

interface JamIntroProps {
  onContinue: () => void;
  onClose: () => void; // 👈 added for the pink X
}

const JamIntro: React.FC<JamIntroProps> = ({ onContinue, onClose }) => {
  return (
    <div className="pixie-card">
      {/* 🩷 Pink X inside the card */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      {/* Scrollable body */}
      <div className="pixie-card_ßbody" style={{ textAlign: "center" }}>
        {/* 🖼️ Title Image */}
<img
  src={`${import.meta.env.BASE_URL}assets/images/jam_groove_title.png`}
  alt="Jam & Groove"
  className="px-media px-media--sm"
/>

        {/* 🎥 Video */}
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/jam_intro_loop.mp4`}
          autoPlay
          muted
          playsInline
          loop
          className="px-media"
          style={{
            display: "block",
            width: "100%",
            maxWidth: 300,
            margin: "0 auto 1rem",
            borderRadius: 16,
            objectFit: "contain",
          }}
        />

        {/* 📝 Description */}
        <h2 className="px-intro-title" style={{ marginBottom: 6 }}>
          Get ready to boogie on down!
        </h2>
        <p className="px-prose-narrow" style={{ marginBottom: 20 }}>
          From your aisle walk to the last dance, we’ll help you build the perfect soundtrack. 
          Pick songs and styles you love, and we’ll handle the magic. 🎶✨
        </p>

        {/* 👉 Continue */}
        <button className="boutique-primary-btn" onClick={onContinue}>
          Let’s Groove!
        </button>
      </div>
    </div>
  );
};

export default JamIntro;