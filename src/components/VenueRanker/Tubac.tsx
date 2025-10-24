import React, { useState } from "react";
import { venueToCollection } from "../../utils/venueCollections";
import { venueCollectionDescriptions } from "../../utils/venueCollectionDescriptions";
import { collectionColors } from "../../utils/venueCollections";

interface VenueRankerSelections {
  exploreMode: "all" | "vibe";
  vibeSelections: string[];
  rankings: Record<string, number>;
}

interface TubacProps {
  onContinue: () => void;   // next venue
  onBack: () => void;       // previous venue
  onClose: () => void;      // close overlay
  screenList: string[];
  currentIndex: number;
  venueRankerSelections: VenueRankerSelections;
  setVenueRankerSelections: React.Dispatch<React.SetStateAction<VenueRankerSelections>>;
  goToExplore: () => void;  // Start over → Explore selector
}

const Tubac: React.FC<TubacProps> = ({
  onContinue,
  onBack,
  onClose,
  venueRankerSelections,
  setVenueRankerSelections,
  goToExplore,
}) => {
  const venueId = "tubac";
  const [showError, setShowError] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // ✅ robust guard for possibly undefined props
  const safe = (s?: VenueRankerSelections): VenueRankerSelections => ({
    exploreMode: s?.exploreMode ?? "vibe",
    vibeSelections: s?.vibeSelections ?? [],
    rankings: s?.rankings ?? {},
  });
  const selections = safe(venueRankerSelections);
  const selectedOption = Number(selections.rankings[venueId] ?? 0);

  const handleSelect = (value: number) => {
    setVenueRankerSelections(prev => {
      const p = safe(prev);
      return { ...p, rankings: { ...p.rankings, [venueId]: value } };
    });
    setShowError(false);
  };

  const handleContinue = () => {
    if (!selectedOption) {
      setShowError(true);
      return;
    }
    onContinue();
  };

  const collection = venueToCollection[venueId] ?? "Novel";
  const tooltipText = venueCollectionDescriptions[collection];
  const chipColor = collectionColors[collection] ?? "#4b9cd3";

  return (
    <div className="pixie-card">
      {/* 🩷 Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src="/assets/icons/pink_ex.png" alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        {/* 🏷️ Collection chip */}
        <div style={{ marginBottom: "0.75rem" }}>
          <button
            type="button"
            onClick={() => setShowTooltip(v => !v)}
            style={{
              backgroundColor: chipColor,
              color: "#fff",
              border: "none",
              borderRadius: 20,
              padding: "6px 14px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {collection}
          </button>
          {showTooltip && (
            <div
              style={{
                marginTop: 8,
                background: "#f9f9f9",
                border: "1px solid #ddd",
                borderRadius: 10,
                padding: "10px 12px",
                maxWidth: 520,
                marginInline: "auto",
                textAlign: "left",
              }}
            >
              {tooltipText}
            </div>
          )}
        </div>

        {/* 🏰 Title */}
        <h2 className="px-title px-title--lg" style={{ marginBottom: 10 }}>
          Tubac Golf Resort and Spa
        </h2>

        {/* 🎥 Responsive 16:9 Vimeo (large) */}
<div
  style={{
    position: "relative",
    width: "100%",
    maxWidth: 960,
    margin: "0 auto 1.25rem",
    borderRadius: 12,
    overflow: "hidden",
    background: "#000",
  }}
>
  <div style={{ paddingTop: "56.25%" }} />
  <iframe
    src="https://player.vimeo.com/video/829959547?autoplay=0&muted=0&playsinline=1"
    title="Tubac Golf Resort"
    loading="lazy"
    allow="autoplay; fullscreen; picture-in-picture"
    allowFullScreen
    style={{
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      border: 0,
      display: "block",
    }}
  />
</div>

        <p className="px-prose-narrow" style={{ marginBottom: 12 }}>
          How do you feel about this one?
        </p>

        {/* 🔘 Radio group (unique name) */}
        <div style={{ display: "grid", gap: 10, justifyContent: "center", marginBottom: 12 }}>
          <label>
            <input
              type="radio"
              name="venue-tubac"
              value={3}
              checked={selectedOption === 3}
              onChange={() => handleSelect(3)}
              style={{ marginRight: 8 }}
            />
            a favorite!
          </label>
          <label>
            <input
              type="radio"
              name="venue-tubac"
              value={2}
              checked={selectedOption === 2}
              onChange={() => handleSelect(2)}
              style={{ marginRight: 8 }}
            />
            this could work
          </label>
          <label>
            <input
              type="radio"
              name="venue-tubac"
              value={1}
              checked={selectedOption === 1}
              onChange={() => handleSelect(1)}
              style={{ marginRight: 8 }}
            />
            not for me
          </label>
        </div>

        {showError && (
          <p style={{ color: "#c62828", fontWeight: 600, marginBottom: 12 }}>
            Please select an option to continue.
          </p>
        )}

        {/* CTA stack */}
        <div className="px-cta-col" style={{ marginTop: 8 }}>
          <button className="boutique-primary-btn" onClick={handleContinue}>
            Continue →
          </button>
          <button className="boutique-back-btn" onClick={onBack}>
            ← Back
          </button>
          <button type="button" onClick={goToExplore} className="linklike" style={{ marginTop: 6 }}>
            ⟳ Start over
          </button>
        </div>
      </div>
    </div>
  );
};

export default Tubac;