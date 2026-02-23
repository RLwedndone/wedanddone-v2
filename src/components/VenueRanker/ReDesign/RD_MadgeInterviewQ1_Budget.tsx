// src/components/VenueRanker/ReDesign/RD_MadgeInterviewQ1_Budget.tsx
import React, { useEffect, useMemo, useState } from "react";
import "../../../styles/globals/boutique.master.css";

import type { BudgetTier, RDInterviewState } from "./rdVenueTypes";

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
      collectionLean: (parsed.collectionLean as any) ?? null,
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
  // ✅ includeCatering can be true/false/null ("still deciding")
  onNext: (data: { budgetTier: BudgetTier; includeCatering: boolean | null }) => void;
  onBack: () => void;
  onClose: () => void;
}

const RD_MadgeInterviewQ1_Budget: React.FC<Props> = ({ onNext, onBack, onClose }) => {
  const existing = useMemo(() => readInterview(), []);

  const [budgetTier, setBudgetTier] = useState<BudgetTier | null>(
    existing.budgetTier ?? null
  );

  // tri-state UI: true / false / null ("still deciding") / undefined ("unanswered")
  const [includeCatering, setIncludeCatering] = useState<boolean | null | undefined>(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return undefined;

      const parsed = JSON.parse(raw) as Partial<RDInterviewState>;

      // ✅ If this is the default seed state, treat as unanswered (no default highlight)
      if (isSeedDefault(parsed)) return undefined;

      // ✅ If the key was never set, treat as unanswered (no default highlight)
      if (!Object.prototype.hasOwnProperty.call(parsed, "includeCatering")) return undefined;

      // ✅ If it exists, it can be boolean or null ("still deciding")
      return typeof (parsed as any).includeCatering === "boolean"
        ? (parsed as any).includeCatering
        : null;
    } catch {
      return undefined;
    }
  });

  useEffect(() => {
    const prev = readInterview();

    // ✅ Only persist includeCatering after the user has actually chosen an option
    const next: any = {
      ...prev,
      budgetTier,
    };

    if (includeCatering !== undefined) {
      next.includeCatering = includeCatering; // true/false/null
    }

    writeInterview(next);
  }, [budgetTier, includeCatering]);

  // ✅ allow continue if they picked a budget (catering can be unanswered)
  const canContinue = !!budgetTier;

  const heroSrc = `${import.meta.env.BASE_URL}assets/images/venue-ranker/MadgeQ1Budget.webp`;

  const budgetOptions = useMemo(
    () => [
      {
        id: "under10" as const,
        title: "Under $10,000",
        sub: "Intimate + intentional.",
        color: "#2c62ba",
        glow: "rgba(44, 98, 186, 0.45)",
      },
      {
        id: "10to18" as const,
        title: "$10,000–$18,000",
        sub: "Solid options, thoughtful spend.",
        color: "#7a5cff",
        glow: "rgba(122, 92, 255, 0.45)",
      },
      {
        id: "18to25" as const,
        title: "$18,000–$25,000",
        sub: "More flexibility + style.",
        color: "#ff7aa2",
        glow: "rgba(255, 122, 162, 0.45)",
      },
      {
        id: "25plus" as const,
        title: "$25,000+",
        sub: "Luxury territory ✨",
        color: "#2c62ba",
        glow: "rgba(44, 98, 186, 0.45)",
      },
      {
        id: "notsure" as const,
        title: "Not sure yet",
        sub: "Still figuring it out.",
        color: "#7a5cff",
        glow: "rgba(122, 92, 255, 0.45)",
      },
    ],
    []
  );

  return (
    <div className="pixie-card wd-page-turn">
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body">
        <img
          src={heroSrc}
          alt="Madge Budget Question"
          className="px-media px-media--lg"
          onError={(e) => {
            console.warn("❌ Hero image failed to load:", heroSrc);
            (e.currentTarget as HTMLImageElement).src =
              "/assets/images/venue-ranker/MadgeQ1Budget.webp";
          }}
        />

        <h2 className="px-intro-title" style={{ textAlign: "center", fontSize: "2rem" }}>
          Let’s talk budget.
        </h2>

        <p className="px-prose-narrow" style={{ textAlign: "center" }}>
          What’s your budget range for your <strong>venue?</strong>
        </p>

        <div style={{ display: "grid", gap: 14, maxWidth: 460, margin: "0 auto" }}>
          {budgetOptions.map((opt) => {
            const active = budgetTier === opt.id;

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setBudgetTier(opt.id)}
                style={{
                  width: "100%",
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
                }}
                aria-pressed={active}
              >
                <div style={{ fontWeight: 900, fontSize: "1.15rem" }}>{opt.title}</div>
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

        <div style={{ marginTop: 28 }}>
          <p style={{ textAlign: "center", color: "#444", marginBottom: 14 }}>
            Should your venue include catering?
            <br />
            <span style={{ color: "#777" }}>
              Some venues offer all-inclusive packages with catering built in. Others give you more
              flexibility to choose your own food team (and catering budget).
            </span>
          </p>

          <div
            style={{
              display: "grid",
              gap: 14,
              width: "100%",
              maxWidth: 460,
              margin: "0 auto",
            }}
          >
            {[
              {
                id: "yes",
                title: "All-inclusive sounds great",
                value: true as const,
                color: "#2c62ba",
                glow: "rgba(44, 98, 186, 0.45)",
              },
              {
                id: "no",
                title: "I prefer venue only",
                value: false as const,
                color: "#7a5cff",
                glow: "rgba(122, 92, 255, 0.45)",
              },
              {
                id: "unsure",
                title: "Still deciding",
                value: null,
                color: "#ff7aa2",
                glow: "rgba(255, 122, 162, 0.45)",
              },
            ].map((opt) => {
              const active = includeCatering === opt.value;

              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setIncludeCatering(opt.value)}
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
                </button>
              );
            })}
          </div>
        </div>

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
              if (!budgetTier) return;

              // ✅ If user never answered catering, pass null (but we did NOT auto-select it in the UI)
              onNext({
                budgetTier,
                includeCatering: includeCatering === undefined ? null : includeCatering,
              });
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

export default RD_MadgeInterviewQ1_Budget;