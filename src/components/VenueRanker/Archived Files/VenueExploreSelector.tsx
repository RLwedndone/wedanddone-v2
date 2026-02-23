// src/components/VenueRanker/VenueExploreSelector.tsx
import React from "react";

interface VenueExploreSelectorProps {
  onSelectExploreMode: (mode: "all" | "vibe") => void;
  onClose: () => void;
}

const VenueExploreSelector: React.FC<VenueExploreSelectorProps> = ({
  onSelectExploreMode,
  onClose,
}) => {
  return (
    <div className="pixie-card wd-page-turn">
      {/* 🩷 Pink X */}
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

      {/* 📜 Scrollable Body */}
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2
          className="px-title"
          style={{
            marginBottom: "0.75rem",
            fontSize: "2rem",
            lineHeight: 1.25,
          }}
        >
          How would you like to explore venues?
        </h2>

        <video
          src={`${import.meta.env.BASE_URL}assets/videos/vibe_explore.mp4`}
          autoPlay
          loop
          muted
          playsInline
          className="px-media"
          style={{
            borderRadius: 16,
            marginBottom: "1rem",
            pointerEvents: "none",
          }}
        />

        {/* 🧚‍♀️ Description */}
        <p className="px-prose-narrow" style={{ marginBottom: "1.5rem" }}>
          We can help you find your perfect vibe, or you can browse every magical
          venue we partner with across Arizona!
        </p>

        {/* 🎯 Button Options */}
        <div className="px-cta-col" style={{ gap: 18 }}>
          {/* Option 1 (Primary) */}
          <div
            style={{
              width: "100%",
              maxWidth: 260,
              marginInline: "auto",
            }}
          >
            <button
              className="boutique-primary-btn"
              onClick={() => onSelectExploreMode("vibe")}
              style={{ width: "100%" }}
            >
              Find my vibe ✨
            </button>
            <div style={{ marginTop: 6, fontSize: "0.9rem", color: "#777" }}>
              Answer a few fun questions and we’ll narrow it down for you
            </div>
          </div>

          {/* Option 2 (Secondary) */}
          <div
            style={{
              width: "100%",
              maxWidth: 240,
              marginInline: "auto",
            }}
          >
            <button
              type="button"
              className="boutique-brightblue-btn"
              onClick={() => onSelectExploreMode("all")}
              style={{
                width: "100%",
                opacity: 0.9,
              }}
            >
              Show me everything 🏰
            </button>
            <div style={{ marginTop: 6, fontSize: "0.9rem", color: "#777" }}>
              Browse all our venues at your own pace
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VenueExploreSelector;