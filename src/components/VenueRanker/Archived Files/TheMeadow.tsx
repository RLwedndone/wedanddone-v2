import React, { useMemo, useState } from "react";
import { venueToCollection } from "../../../utils/venueCollections";
import { venueCollectionDescriptions } from "../../../utils/venueCollectionDescriptions";
import { saveVenueSelection } from "../../../utils/saveVenueSelection";
import { collectionColors } from "../../../utils/venueCollections";
import SaveProgressMini from "../SaveProgressMini";
import LazyVimeo from "../../common/LazyVimeo";
import { VIDEO_THUMBNAILS } from "../videoThumbnails";
import { auth } from "../../../firebase/firebaseConfig";

interface VenueRankerSelections {
  exploreMode: "all" | "vibe";
  vibeSelections: string[];
  rankings: Record<string, number>;
}

interface TheMeadowProps {
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;

  goToExplore: () => void;
  onSaveProgress: () => void;

  screenList: string[];
  currentIndex: number;

  venueRankerSelections: VenueRankerSelections;
  setVenueRankerSelections: React.Dispatch<
    React.SetStateAction<VenueRankerSelections>
  >;
}

const TheMeadow: React.FC<TheMeadowProps> = ({
  onContinue,
  onBack,
  onClose,
  goToExplore,
  onSaveProgress,
  screenList,
  currentIndex,
  venueRankerSelections,
  setVenueRankerSelections,
}) => {
  const venueId = "themeadow";
  const [showError, setShowError] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  const isAuthed = !!auth.currentUser;

  // ---- safe accessors (avoid undefined + accidental overwrites)
  const safe = (s?: VenueRankerSelections): VenueRankerSelections => ({
    exploreMode: s?.exploreMode ?? "vibe",
    vibeSelections: s?.vibeSelections ?? [],
    rankings: s?.rankings ?? {},
  });

  const selections = safe(venueRankerSelections);
  const selectedOption = (selections.rankings[venueId] ?? null) as number | null;

  const handleSelect = (value: number) => {
    setVenueRankerSelections((prev) => {
      const p = safe(prev);
      return {
        ...p,
        rankings: { ...p.rankings, [venueId]: value },
      };
    });

    setShowError(false);

    try {
      saveVenueSelection(venueId, value);
    } catch {}
  };

  const handleContinue = () => {
    if (selectedOption === null) {
      setShowError(true);
      return;
    }
    onContinue();
  };

  const collection = venueToCollection[venueId];
  const tooltipText = venueCollectionDescriptions[collection];
  const buttonColor = collectionColors[collection];

  // ✅ Progress helpers
  const totalVenues = Array.isArray(screenList) ? screenList.length : 0;
  const venueNumber = typeof currentIndex === "number" ? currentIndex + 1 : 1;
  const venuesLeft = Math.max(0, totalVenues - venueNumber);

  const rankOptions = useMemo(
    () => [
      {
        value: 3,
        title: "⭐ A favorite!",
        sub: "Top tier. Sparks joy. No notes.",
        color: "#2c62ba", // primary blue
        glow: "rgba(44, 98, 186, 0.45)",
      },
      {
        value: 2,
        title: "👍 This could work",
        sub: "Solid contender. Keep it in the mix.",
        color: "#7a5cff", // purple
        glow: "rgba(122, 92, 255, 0.45)",
      },
      {
        value: 1,
        title: "🚫 Not for me",
        sub: "Respectfully… no thank you.",
        color: "#ff7aa2", // pink
        glow: "rgba(255, 122, 162, 0.45)",
      },
    ],
    []
  );

  return (
    <div className="pixie-card wd-page-turn">
      {/* ✖ Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      {/* ✅ prevent weird mobile sideways scroll */}
      <div className="pixie-card__body" style={{ overflowX: "hidden" }}>
        <div
          style={{
            textAlign: "center",
            width: "100%",
            maxWidth: 720,
            margin: "0 auto",
            position: "relative",
          }}
        >
          {/* 🏷️ Collection chip */}
          <div style={{ marginBottom: "0.75rem" }}>
            <button
              type="button"
              onClick={() => setShowTooltip((v) => !v)}
              style={{
                backgroundColor: buttonColor,
                color: "#fff",
                border: "none",
                borderRadius: 999,
                padding: "6px 14px",
                fontWeight: 800,
                cursor: "pointer",
              }}
              aria-expanded={showTooltip}
            >
              {collection}
            </button>

            {showTooltip && (
              <div
                style={{
                  marginTop: 8,
                  background: "#f9f9f9",
                  border: "1px solid #ddd",
                  borderRadius: 12,
                  padding: "10px 12px",
                  maxWidth: 560,
                  marginInline: "auto",
                  textAlign: "left",
                }}
              >
                {tooltipText}
              </div>
            )}
          </div>

          {/* Title */}
          <h2 className="px-title px-title--lg" style={{ marginBottom: 12 }}>
            Schnepf’s Farm — The Meadow
          </h2>

          {/* 🎥 Venue video */}
          <div style={{ marginBottom: "1.25rem" }}>
            <LazyVimeo
              videoId="829575414"
              title="The Meadow"
              thumbnail={VIDEO_THUMBNAILS.Meadow}
            />
          </div>

          {/* Prompt */}
          <p className="px-prose-narrow" style={{ marginBottom: 10 }}>
            How do you feel about this one?
          </p>

          {/* Tap-to-rank options */}
          <div
            style={{
              display: "grid",
              gap: 12,
              marginBottom: 10,
              width: "100%",
              maxWidth: 320,
              marginInline: "auto",
              justifyItems: "center",
            }}
          >
            {rankOptions.map((opt) => {
              const active = selectedOption === opt.value;

              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  style={{
                    width: "100%",
                    borderRadius: 18,
                    border: active ? `2px solid ${opt.color}` : "1px solid #e6e6ef",
                    background: active ? opt.color : "#fff",
                    padding: "18px 16px",
                    textAlign: "center",
                    cursor: "pointer",
                    color: active ? "#fff" : "#222",
                    boxShadow: active
                      ? `0 0 28px ${opt.glow}`
                      : "0 8px 16px rgba(0,0,0,0.06)",
                    transform: active ? "translateY(-2px)" : "none",
                    transition: "all 180ms ease",
                  }}
                  aria-pressed={active}
                >
                  <div style={{ fontWeight: 900, fontSize: "1.15rem" }}>
                    {opt.title}
                  </div>

                  <div
                    style={{
                      marginTop: 6,
                      fontSize: "0.95rem",
                      opacity: active ? 0.95 : 0.75,
                    }}
                  >
                    {opt.sub}
                  </div>
                </button>
              );
            })}
          </div>

          {/* ✅ Progress + save (moved here) */}
          <div
            style={{
              textAlign: "center",
              marginTop: 16,
              marginBottom: 22,
            }}
          >
            <div
              style={{
                fontSize: "0.92rem",
                color: "#666",
                fontWeight: 700,
                lineHeight: 1.45,
              }}
            >
              <div>
                This is Venue #{venueNumber} in your list of {totalVenues} venues.
              </div>
              <div style={{ marginTop: 2 }}>
                You have {venuesLeft} left to review + rank.
              </div>
            </div>

            <div style={{ marginTop: 6 }}>
              <SaveProgressMini onClick={onSaveProgress} />
            </div>

            {!isAuthed && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: "0.84rem",
                  color: "#777",
                  lineHeight: 1.35,
                }}
              >
                Save your spot and come back anytime.
              </div>
            )}
          </div>

          {showError && (
            <p style={{ color: "#c62828", fontWeight: 700, marginBottom: 10 }}>
              Please select an option to continue.
            </p>
          )}

          {/* CTAs */}
          <div className="px-cta-col" style={{ marginTop: 8 }}>
            <button
              className="boutique-primary-btn"
              onClick={handleContinue}
              disabled={selectedOption === null}
              style={{
                opacity: selectedOption === null ? 0.55 : 1,
                cursor: selectedOption === null ? "not-allowed" : "pointer",
              }}
            >
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
    </div>
  );
};

export default TheMeadow;