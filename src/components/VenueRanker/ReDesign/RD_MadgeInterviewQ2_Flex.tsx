// src/components/VenueRanker/ReDesign/RD_MadgeInterviewQ2_Flex.tsx
import React, { useEffect, useMemo, useState } from "react";
import "../../../styles/globals/boutique.master.css";

import type { CollectionLean, RDInterviewState } from "./rdVenueTypes";

const LS_KEY = "rd_ranker_interview";

const EMPTY_INTERVIEW: RDInterviewState = {
  budgetTier: null,
  includeCatering: null,
  collectionLean: null,
  guestCount: null,
  vibes: [],
};

// ✅ Treat your overlay defaults as "unanswered" so nothing auto-highlights
function isSeedDefault(parsed: Partial<RDInterviewState>) {
  return (
    parsed.budgetTier === "notsure" &&
    parsed.collectionLean === "neutral" &&
    typeof parsed.includeCatering !== "boolean" && // null/undefined
    typeof (parsed as any).guestCount !== "number" &&
    Array.isArray(parsed.vibes) &&
    parsed.vibes.length === 0
  );
}

// ✅ canonical read/write using RDInterviewState shape
function readInterview(): RDInterviewState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<RDInterviewState>) : {};

    // ✅ If this is just the system "seed" state, return empty so UI shows no selections
    if (isSeedDefault(parsed)) return EMPTY_INTERVIEW;

    return {
      budgetTier: (parsed.budgetTier as any) ?? null,
      includeCatering:
        typeof parsed.includeCatering === "boolean" ? parsed.includeCatering : null,
      collectionLean: (parsed.collectionLean as CollectionLean) ?? null,
      guestCount:
        typeof (parsed as any).guestCount === "number" ? (parsed as any).guestCount : null,
      vibes: Array.isArray(parsed.vibes) ? parsed.vibes : [],
    };
  } catch {
    return EMPTY_INTERVIEW;
  }
}

function writeInterview(next: RDInterviewState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

interface Props {
  onNext: (data: { collectionLean: CollectionLean }) => void;
  onBack: () => void;
  onClose: () => void;
}

const RD_MadgeInterviewQ2_Flex: React.FC<Props> = ({ onNext, onBack, onClose }) => {
  const existing = useMemo(() => readInterview(), []);

  const [collectionLean, setCollectionLean] = useState<CollectionLean | null>(
    existing.collectionLean ?? null
  );

  // ✅ keep LS synced, but keep the rest of the interview state intact
  // ✅ (and avoid writing the overlay's default "neutral" as if the user chose it)
  useEffect(() => {
    const prev = readInterview();

    // If we have no saved answers yet, don't auto-write a default selection.
    // We only persist when the user actually selects something (non-null).
    if (!collectionLean) return;

    writeInterview({
      ...prev,
      collectionLean,
    });
  }, [collectionLean]);

  const canContinue = !!collectionLean;

  const heroSrc = `${import.meta.env.BASE_URL}assets/images/venue-ranker/MadgeQ2Flex.webp`;

  const options = useMemo(
    () => [
      {
        id: "novel" as const,
        title:
          "I’m flexible — I’d travel, consider weekdays, or adjust details for the right price",
        color: "#2c62ba",
        glow: "rgba(44, 98, 186, 0.45)",
      },
      {
        id: "fable" as const,
        title:
          "I want a great balance — I’m open to some flexibility if it really pays off",
        color: "#7a5cff",
        glow: "rgba(122, 92, 255, 0.45)",
      },
      {
        id: "romance" as const,
        title:
          "I have a specific vision — the venue needs to feel just right, even if it costs more",
        color: "#ff7aa2",
        glow: "rgba(255, 122, 162, 0.45)",
      },
      {
        // ✅ Option A: match rdVenueTypes.ts ("neutral")
        id: "neutral" as const,
        title: "Not sure yet — I’m still figuring it out",
        color: "#2c62ba",
        glow: "rgba(44, 98, 186, 0.35)",
      },
    ],
    []
  );

  return (
    <div className="pixie-card wd-page-turn">
      {/* Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body">
        {/* HERO */}
        <img
          src={heroSrc}
          alt="Madge Venue Flexibility Question"
          className="px-media px-media--lg"
          onError={(e) => {
            console.warn("❌ Hero image failed to load:", heroSrc);
            (e.currentTarget as HTMLImageElement).src =
              "/assets/images/venue-ranker/MadgeQ2Flex.webp";
          }}
        />

        <h2 className="px-intro-title" style={{ textAlign: "center", fontSize: "2rem" }}>
          Venue Flexibility
        </h2>

        <p className="px-prose-narrow" style={{ textAlign: "center" }}>
          When it comes to choosing your venue, which feels most like you?
        </p>

        {/* Options rail — same width as Q1 */}
        <div
          style={{
            display: "grid",
            gap: 14,
            width: "100%",
            maxWidth: 460,
            margin: "0 auto",
          }}
        >
          {options.map((opt) => {
            // ✅ If this is the overlay seed/default state, show no highlight
            const active = collectionLean === opt.id;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setCollectionLean(opt.id)}
                style={{
                  display: "block",
                  width: "100%",
                  maxWidth: 460,
                  margin: "0 auto",
                  boxSizing: "border-box",
                  borderRadius: 18,
                  border: active ? `2px solid ${opt.color}` : "1px solid #e6e6ef",
                  background: active ? opt.color : "#fff",
                  padding: "16px 14px",
                  textAlign: "center",
                  cursor: "pointer",
                  color: active ? "#fff" : "#222",
                  boxShadow: active
                    ? `0 0 22px ${opt.glow}`
                    : "0 6px 14px rgba(0,0,0,0.05)",
                  transform: active ? "translateY(-2px)" : "none",
                  transition: "all 180ms ease",
                  whiteSpace: "normal",
                }}
                aria-pressed={active}
              >
                <div style={{ fontWeight: 900, fontSize: "1.05rem" }}>{opt.title}</div>
                <div style={{ marginTop: 8, fontSize: "0.95rem", opacity: active ? 0.95 : 0.75 }}>
                  {/* intentionally blank */}
                </div>
              </button>
            );
          })}
        </div>

        {/* Continue + Back */}
        <div
          style={{
            textAlign: "center",
            marginTop: 30,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 14,
          }}
        >
          <button
            type="button"
            onClick={() => {
              if (!collectionLean) return;
              onNext({ collectionLean });
            }}
            className="boutique-primary-btn"
            disabled={!canContinue}
            style={{
              opacity: canContinue ? 1 : 0.5,
              cursor: canContinue ? "pointer" : "not-allowed",
            }}
          >
            Continue
          </button>

          <button type="button" onClick={onBack} className="boutique-back-btn">
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default RD_MadgeInterviewQ2_Flex;