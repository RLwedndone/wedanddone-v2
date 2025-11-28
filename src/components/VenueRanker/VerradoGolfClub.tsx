import React, { useState } from "react";
import { venueToCollection } from "../../utils/venueCollections";
import { venueCollectionDescriptions } from "../../utils/venueCollectionDescriptions";
import { saveVenueSelection } from "../../utils/saveVenueSelection";
import { collectionColors } from "../../utils/venueCollections";
import LazyVimeo from "../common/LazyVimeo";
import { VIDEO_THUMBNAILS } from "./videoThumbnails";

interface VenueRankerSelections {
  exploreMode: "all" | "vibe";
  vibeSelections: string[];
  rankings: Record<string, number>;
}

interface VerradoGolfClubProps {
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
  screenList: string[];
  currentIndex: number;
  venueRankerSelections: VenueRankerSelections;
  setVenueRankerSelections: React.Dispatch<
    React.SetStateAction<VenueRankerSelections>
  >;
  goToExplore: () => void;
}

const VerradoGolfClub: React.FC<VerradoGolfClubProps> = ({
  onContinue,
  onBack,
  onClose,
  venueRankerSelections,
  setVenueRankerSelections,
  goToExplore,
}) => {
  const venueId = "verrado";
  const [showError, setShowError] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // guard so we always have exploreMode / vibeSelections / rankings
  const safe = (s?: VenueRankerSelections): VenueRankerSelections => ({
    exploreMode: s?.exploreMode ?? "vibe",
    vibeSelections: s?.vibeSelections ?? [],
    rankings: s?.rankings ?? {},
  });

  const selections = safe(venueRankerSelections);
  const selectedOption = Number(selections.rankings[venueId] ?? 0);

  const handleSelect = (value: number) => {
    setVenueRankerSelections((prev) => {
      const p = safe(prev);
      return {
        ...p,
        rankings: { ...p.rankings, [venueId]: value },
      };
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
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        {/* 🏷️ Collection chip */}
        <div style={{ marginBottom: "0.75rem" }}>
          <button
            type="button"
            onClick={() => setShowTooltip((v) => !v)}
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
          Verrado Golf Club
        </h2>

        {/* 🎥 Venue video */}
        <LazyVimeo
  videoId="829968623"
  title="Verrado Golf Club"
  thumbnail={VIDEO_THUMBNAILS.Verrado}
/>

        {/* Prompt */}
<p
  className="px-prose-narrow"
  style={{ marginTop: "1.25rem", marginBottom: 12 }}
>
  How do you feel about this one?
</p>

        {/* 🔘 Radio group (unique group name) */}
        <div
          style={{
            display: "grid",
            gap: 10,
            justifyContent: "center",
            marginBottom: 12,
          }}
        >
          <label>
            <input
              type="radio"
              name="venue-verrado"
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
              name="venue-verrado"
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
              name="venue-verrado"
              value={1}
              checked={selectedOption === 1}
              onChange={() => handleSelect(1)}
              style={{ marginRight: 8 }}
            />
            not for me
          </label>
        </div>

        {showError && (
          <p
            style={{
              color: "#c62828",
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
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

export default VerradoGolfClub;