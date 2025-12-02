// src/components/jam/JamIntro.tsx
import React from "react";

interface JamIntroProps {
  onContinue: () => void;
  onClose: () => void; // pink X

  // Rubi House mode (DJ included)
  includedMode?: boolean;

  // NEW: they have a Groove Guide PDF but no DJ booking yet
  hasPdfOnlyGuide?: boolean;

  // NEW: called when user chooses "Use Groove Guide on file"
  onUseExistingGuide?: () => void;
}

const JamIntro: React.FC<JamIntroProps> = ({
  onContinue,
  onClose,
  includedMode,
  hasPdfOnlyGuide = false,
  onUseExistingGuide,
}) => {
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

        {includedMode ? (
          // Rubi House copy
          <p className="px-prose-narrow" style={{ marginBottom: 20 }}>
            From your aisle walk to the last dance, we’ll help you build the perfect soundtrack.
            <br />
            <strong>Your Rubi House package already includes your DJ!</strong>
            <br />
            So just use this section to pick songs and styles you love, and we’ll handle the magic. 🎶✨
          </p>
        ) : hasPdfOnlyGuide ? (
          // They already bought a Groove Guide PDF
          <p className="px-prose-narrow" style={{ marginBottom: 20 }}>
            We see you’ve already built a <strong>Groove Guide PDF</strong> with your music vibes.
            You can update it with new choices, or keep everything as-is and just book your DJ.
          </p>
        ) : (
          // Normal first-time flow
          <p className="px-prose-narrow" style={{ marginBottom: 20 }}>
            From your aisle walk to the last dance, we’ll help you build the perfect soundtrack.
            Pick songs and styles you love, and we’ll handle the magic. 🎶✨
          </p>
        )}

        {/* 👉 Buttons */}
        {includedMode ? (
          <button className="boutique-primary-btn" onClick={onContinue}>
            Let’s Groove!
          </button>
        ) : hasPdfOnlyGuide ? (
          <div className="px-cta-col" style={{ gap: 8 }}>
            <button
              className="boutique-primary-btn"
              onClick={onContinue}
              style={{ minWidth: 210 }}
            >
              Update My Groove Guide
            </button>
            <button
              className="boutique-back-btn"
              onClick={onUseExistingGuide}
              style={{ minWidth: 210 }}
              disabled={!onUseExistingGuide}
            >
              Use Groove Guide On File
            </button>
          </div>
        ) : (
          <button className="boutique-primary-btn" onClick={onContinue}>
            Let’s Groove!
          </button>
        )}
      </div>
    </div>
  );
};

export default JamIntro;