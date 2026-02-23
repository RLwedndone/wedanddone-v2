// src/components/jam/JamIntro.tsx
import React from "react";

interface JamIntroProps {
  onContinue: () => void;
  onClose: () => void;
  includedMode?: boolean;
  hasPdfOnlyGuide?: boolean;
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
    <div className="pixie-card wd-page-turn">
      {/* 🩷 Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      {/* Scrollable body */}
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        {/* Title Image */}
        <img
          src={`${import.meta.env.BASE_URL}assets/images/jam_groove_title.png`}
          alt="Jam & Groove"
          className="px-media px-media--sm"
        />

        {/* Video */}
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

        {/* Headline */}
        <h2 className="px-intro-title" style={{ marginBottom: 6 }}>
          Get ready to boogie on down!
        </h2>

        {includedMode ? (
          <p className="px-prose-narrow" style={{ marginBottom: 20 }}>
            From your aisle walk to the last dance, we’ll help you build the perfect soundtrack.
            <br />
            <strong>Your Rubi House package already includes your DJ!</strong>
            <br />
            So just use this section to pick songs and styles you love, and we’ll handle the magic. 🎶✨
          </p>
        ) : hasPdfOnlyGuide ? (
          <p className="px-prose-narrow" style={{ marginBottom: 20 }}>
            We see you’ve already built a <strong>Groove Guide PDF</strong> with your music vibes.
            You can update it with new choices, or keep everything as-is and just book your DJ.
          </p>
        ) : (
          <p className="px-prose-narrow" style={{ marginBottom: 20 }}>
            From your aisle walk to the last dance, we’ll help you build the perfect soundtrack.
            Pick songs and styles you love, and we’ll handle the magic. 🎶✨
          </p>
        )}

        {/* 💬 Founder Note */}
        {!includedMode && (
          <div
            style={{
              margin: "1.25rem auto 1.5rem",
              maxWidth: 520,
              textAlign: "left",
              background: "rgba(240,246,255,0.85)",
              borderRadius: 16,
              padding: "14px 16px",
              boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
            }}
          >
            <h2
              style={{
                fontSize: "1.5rem",
                fontWeight: 900,
                color: "#2c62ba",
                marginBottom: 8,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <img
                src={`${import.meta.env.BASE_URL}assets/images/KFounder1x1.webp`}
                alt="Karen, co-founder of Wed&Done"
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 10,
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
              “Most DJs send you a stack of forms and ask for multiple meetings.
              <br />
              <br />
              We work with pros we trust — and built a smarter way to prep them.
              <br />
              <br />
              Jam &amp; Groove captures your vibe, must-plays, timeline moments, and
              do-not-play list in one clean flow. Your DJ gets crystal-clear
              direction. You skip the paperwork marathon.”
            </p>
          </div>
        )}

        {/* Buttons */}
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