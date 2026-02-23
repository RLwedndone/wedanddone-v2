// src/components/VenueRanker/ReDesign/RD_MadgeInterviewQ4_Vibe.tsx
import React, { useEffect, useMemo, useState } from "react";
import "../../../styles/globals/boutique.master.css";
import type { VenueVibe } from "./rdVenueTypes";

type InterviewState = {
  vibes?: VenueVibe[];
};

const LS_KEY = "rd_ranker_interview";

/** ✅ If LS is just the overlay “seed defaults”, treat as unanswered (so nothing is pre-selected). */
function isSeedDefault(parsed: any) {
  return (
    parsed &&
    parsed.budgetTier === "notsure" &&
    parsed.collectionLean === "neutral" &&
    typeof parsed.includeCatering !== "boolean" && // null/undefined
    typeof parsed.guestCount !== "number" &&
    Array.isArray(parsed.vibes) &&
    parsed.vibes.length === 0
  );
}

function readInterview(): InterviewState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};

    // ✅ IMPORTANT: don’t hydrate UI from the default seed object
    if (isSeedDefault(parsed)) return {};

    return parsed || {};
  } catch {
    return {};
  }
}

function writeInterview(next: InterviewState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

interface Props {
  onNext: (data: { vibes: VenueVibe[] }) => void;
  onBack: () => void;
  onClose: () => void;
}

type VibeOption = {
  id: VenueVibe | "surprise_me";
  title: string;
  sub: string;
  color: string;
  glow: string;
};

const ALL_VIBES: VenueVibe[] = [
  "desert-dream",
  "garden-greenery",
  "industrial",
  "modern",
  "rustic-chic",
  "distinctly-arizona",
];

const RD_MadgeInterviewQ4_Vibe: React.FC<Props> = ({ onNext, onBack, onClose }) => {
  const existing = useMemo(() => readInterview(), []);

  // ✅ If no prior saved vibes, start with empty array (no auto-selection)
  const [selected, setSelected] = useState<VenueVibe[]>(
    Array.isArray(existing.vibes) ? existing.vibes : []
  );

  // ✅ Save immediately on change
  useEffect(() => {
    const prev = readInterview();

    // ✅ If nothing selected, remove vibes entirely (so reset truly looks blank)
    if (!selected.length) {
      const { vibes: _v, ...rest } = (prev as any) || {};
      writeInterview(rest);
      return;
    }

    writeInterview({
      ...prev,
      vibes: selected,
    });
  }, [selected]);

  const heroSrc = `${import.meta.env.BASE_URL}assets/images/venue-ranker/MadgeQ4Vibe.webp`;

  const vibeOptions: VibeOption[] = useMemo(
    () => [
      {
        id: "desert-dream",
        title: "🌵 Desert Dream ☀️",
        sub: "Perfectly pristine desert landscaping + authentic Sonoran backdrops.",
        color: "#2c62ba",
        glow: "rgba(44, 98, 186, 0.45)",
      },
      {
        id: "garden-greenery",
        title: "🌳 Garden Greenery 💐",
        sub: "An oasis in the desert — lush gardens, grassy spaces, trees.",
        color: "#7a5cff",
        glow: "rgba(122, 92, 255, 0.45)",
      },
      {
        id: "industrial",
        title: "🏗️ Industrial 🧱",
        sub: "Clean, minimal, classic, and perfectly pulled together.",
        color: "#ff7aa2",
        glow: "rgba(255, 122, 162, 0.45)",
      },
      {
        id: "modern",
        title: "🔷 Modern 🔶",
        sub: "Fun, sleek, and cool, cool, cool… very cool.",
        color: "#2c62ba",
        glow: "rgba(44, 98, 186, 0.45)",
      },
      {
        id: "rustic-chic",
        title: "💖 Rustic Yet Chic 💖",
        sub: "Classic + cozy spaces that are classed up and ready for a party.",
        color: "#7a5cff",
        glow: "rgba(122, 92, 255, 0.45)",
      },
      {
        id: "distinctly-arizona",
        title: "🌞 Distinctly Arizona 🏜️",
        sub: "The definition of the Southwest’s history and present.",
        color: "#ff7aa2",
        glow: "rgba(255, 122, 162, 0.45)",
      },
      {
        id: "surprise_me",
        title: "✨ I love it all — surprise me!",
        sub: "No filters. Show me the magical options.",
        color: "#2c62ba",
        glow: "rgba(44, 98, 186, 0.45)",
      },
    ],
    []
  );

  const isSurpriseMode = selected.length === ALL_VIBES.length;

  const isSelected = (id: VibeOption["id"]) => {
    if (id === "surprise_me") return isSurpriseMode;
    return selected.includes(id);
  };

  // active via surprise = all vibes lit up, but we’ll style them softer
  const isSoftSelected = (id: VibeOption["id"]) => id !== "surprise_me" && isSurpriseMode;

  const toggle = (id: VibeOption["id"]) => {
    setSelected((prev) => {
      if (id === "surprise_me") {
        // Surprise me = select all canonical vibes (or clear if already all)
        return prev.length === ALL_VIBES.length ? [] : [...ALL_VIBES];
      }

      if (prev.includes(id)) return prev.filter((x) => x !== id);

      // If they had “all” selected and then click a single vibe, we’ll treat it as “customize”
      const wasAll = prev.length === ALL_VIBES.length;
      if (wasAll) return [id];

      return [...prev, id];
    });
  };

  const canContinue = selected.length > 0;

  return (
    <div className="pixie-card wd-page-turn">
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body">
        <img
          src={heroSrc}
          alt="Madge Vibe Question"
          className="px-media px-media--lg"
          onError={(e) => {
            console.warn("❌ Hero image failed to load:", heroSrc);
            (e.currentTarget as HTMLImageElement).src = "/assets/images/venue-ranker/MadgeQ4Vibe.webp";
          }}
        />

        <h2 className="px-intro-title" style={{ textAlign: "center", fontSize: "2rem" }}>
          Venue vibe time . . .
        </h2>

        <p className="px-prose-narrow" style={{ textAlign: "center" }}>
          What kind of venue vibes are you drawn to?
          <br />
          <br />
          <span style={{ color: "#777" }}>Pick as many as you'd like.</span>
        </p>

        <div style={{ textAlign: "center", margin: "10px 0 18px" }}>
          <span
            style={{
              display: "inline-block",
              padding: "8px 14px",
              borderRadius: 999,
              background: "rgba(44, 98, 186, 0.10)",
              border: "1px solid rgba(44, 98, 186, 0.22)",
              fontWeight: 800,
              color: "#2c62ba",
              fontSize: "0.95rem",
            }}
          >
            {selected.length === 0
              ? "Pick at least one vibe ✨"
              : `${selected.length} vibe${selected.length === 1 ? "" : "s"} selected`}
          </span>
        </div>

        <div style={{ display: "grid", gap: 14, maxWidth: 460, margin: "0 auto" }}>
          {vibeOptions.map((opt) => {
            const active = isSelected(opt.id);
            const soft = isSoftSelected(opt.id);
            const hardActive = active && !soft; // only surprise_me should be “hard” in surprise mode

            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggle(opt.id)}
                style={{
                  width: "100%",
                  borderRadius: 18,
                  border: hardActive
                    ? `2px solid ${opt.color}`
                    : soft
                    ? `2px solid rgba(44, 98, 186, 0.18)`
                    : "1px solid #e6e6ef",
                  background: hardActive
                    ? opt.color
                    : soft
                    ? `linear-gradient(0deg, rgba(44, 98, 186, 0.06), rgba(44, 98, 186, 0.06)), #fff`
                    : "#fff",
                  padding: "16px 14px",
                  textAlign: "center",
                  cursor: "pointer",
                  color: hardActive ? "#fff" : "#222",
                  boxShadow: hardActive ? `0 0 22px ${opt.glow}` : "0 6px 14px rgba(0,0,0,0.05)",
                  transform: hardActive ? "translateY(-2px)" : "none",
                  transition: "all 180ms ease",
                }}
                aria-pressed={active}
              >
                <div style={{ fontWeight: 900, fontSize: "1.12rem" }}>{opt.title}</div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: "0.95rem",
                    opacity: hardActive ? 0.95 : 0.75,
                  }}
                >
                  {opt.sub}
                </div>
              </button>
            );
          })}
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
            className="boutique-primary-btn"
            disabled={!canContinue}
            onClick={() => onNext({ vibes: selected })}
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

export default RD_MadgeInterviewQ4_Vibe;