import React, { useState } from "react";
import { venueToCollection } from "../../utils/venueCollections";
import { venueCollectionDescriptions } from "../../utils/venueCollectionDescriptions";
import { saveVenueSelection } from "../../utils/saveVenueSelection";
import { collectionColors } from "../../utils/venueCollections";

interface VenueRankerSelections {
  exploreMode: "all" | "vibe";
  vibeSelections: string[];
  rankings: Record<string, number>;
}

interface BatesMansionProps {
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
  goToExplore: () => void;
  screenList: string[];
  currentIndex: number;
  venueRankerSelections: VenueRankerSelections;
  setVenueRankerSelections: React.Dispatch<React.SetStateAction<VenueRankerSelections>>;
}

const BatesMansion: React.FC<BatesMansionProps> = ({
  onContinue,
  onBack,
  onClose,
  goToExplore,
  venueRankerSelections,
  setVenueRankerSelections,
}) => {
  const venueId = "batesmansion";
  const [showError, setShowError] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // ---- safe accessors (avoid duplicate keys / overwrites)
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
      return {
        ...p,
        rankings: { ...p.rankings, [venueId]: value },
      };
    });
    setShowError(false);
    try { saveVenueSelection(venueId, value); } catch {}
  };

  const handleContinue = () => {
    if (!selectedOption) {
      setShowError(true);
      return;
    }
    onContinue();
  };

  const collection = venueToCollection[venueId];
  const tooltipText = venueCollectionDescriptions[collection];
  const buttonColor = collectionColors[collection];

  return (
    <div className="pixie-card">
      {/* ✖ Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        {/* 🏷️ Collection chip */}
        <div style={{ marginBottom: "0.75rem" }}>
          <button
            type="button"
            onClick={() => setShowTooltip(v => !v)}
            style={{
              backgroundColor: buttonColor,
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

        {/* Title */}
        <h2 className="px-title" style={{ marginBottom: 10 }}>Bates Mansion</h2>
{/* 🎥 Venue video */}
<div
  style={{
    width: "100%",
    maxWidth: 560,           // keeps it nice inside the card
    margin: "0 auto 1.25rem",
    borderRadius: 12,
    overflow: "hidden",
    background: "#000",
    // give it a stable viewing window:
    position: "relative",
    aspectRatio: "16 / 9",   // modern browsers
    minHeight: 220,          // safety for older/smaller viewports
    maxHeight: 320,          // don't let it get comically tall on huge screens
  }}
>
  <iframe
    src="https://player.vimeo.com/video/829586701?autoplay=0&muted=0&playsinline=1"
    title="Bates Mansion"
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
      objectFit: "cover",
    }}
  />
</div>

        {/* Prompt */}
        <p className="px-prose-narrow" style={{ marginBottom: 12 }}>
          How do you feel about this one?
        </p>

        {/* Radios */}
        <div style={{ display: "grid", gap: 10, justifyContent: "center", marginBottom: 12 }}>
          <label>
            <input
              type="radio"
              name="venue-batesmansion"
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
              name="venue-batesmansion"
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
              name="venue-batesmansion"
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

        {/* CTAs */}
        <div className="px-cta-col" style={{ marginTop: 8 }}>
          <button className="boutique-primary-btn" onClick={handleContinue}>
            Continue →
          </button>
          <button className="boutique-back-btn" onClick={onBack}>
            ← Back
          </button>
          <button
            type="button"
            onClick={goToExplore}
            className="linklike"
            style={{ marginTop: 6 }}
          >
            ⟳ Start over
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatesMansion;