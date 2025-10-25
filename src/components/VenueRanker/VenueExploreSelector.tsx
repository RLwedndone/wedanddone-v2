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
    <div className="pixie-card">
      {/* 🩷 Pink X */}
      <button
        className="pixie-card__close"
        onClick={onClose}
        aria-label="Close"
      >
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      {/* 📜 Scrollable Body */}
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
      <h2
  className="px-title"
  style={{
    marginBottom: "0.75rem",
    fontSize: "2rem", // 🔹 bump up from default
    lineHeight: 1.25, // optional: keeps it visually balanced
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
  style={{ borderRadius: 16, marginBottom: "1rem", pointerEvents: "none" }}
/>

        {/* 🧚‍♀️ Description */}
        <p className="px-prose-narrow" style={{ marginBottom: "2rem" }}>
          We can help you find your perfect vibe, or you can browse every magical
          venue across Arizona!
        </p>

        {/* 🎯 Button Options */}
        <div className="px-cta-col" style={{ gap: 12 }}>
          <button
            className="boutique-primary-btn"
            onClick={() => onSelectExploreMode("vibe")}
          >
            Find my vibe ✨
          </button>

          <button
  type="button"
  className="boutique-brightblue-btn"
  onClick={() => onSelectExploreMode("all")}
>
  Show me everything! 🏰
</button>
      
      </div>
      </div>
    </div>
  );
};

export default VenueExploreSelector;