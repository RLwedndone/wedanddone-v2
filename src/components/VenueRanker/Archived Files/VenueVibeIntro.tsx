// src/components/VenueRanker/VenueVibeIntro.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "../../styles/globals/boutique.master.css";

interface Vibe {
  id: string;
  title: string;
  description: string;
  video: string;
}

interface VenueRankerSelections {
  exploreMode: "all" | "vibe";
  vibeSelections: string[];
  rankings: Record<string, number>;
}

interface VenueVibeIntroProps {
  venueRankerSelections: VenueRankerSelections;
  setVenueRankerSelections: React.Dispatch<
    React.SetStateAction<VenueRankerSelections>
  >;

  onContinue: () => void; // proceed to venue list build (requires >=3 vibes)
  onBack: () => void;
  onClose: () => void;
}

const vibes: Vibe[] = [
  {
    id: "desert-dream",
    title: "🌵 Desert Dream ☀️",
    description:
      "Perfectly pristine desert landscaping and authentic desert backdrops. These venues showcase the Sonoran Desert in all its cacti glory.",
    video: `${import.meta.env.BASE_URL}assets/videos/desert_dream.mp4`,
  },
  {
    id: "garden-greenery",
    title: "🌳 Garden Greenery 💐",
    description:
      "An oasis in the desert — lush gardens, grassy spaces, and trees!",
    video: `${import.meta.env.BASE_URL}assets/videos/garden_greenery.mp4`,
  },
  {
    id: "industrial",
    title: "🏗️ Industrial 🧱",
    description: "Clean, minimal, classic, and perfectly pulled together.",
    video: `${import.meta.env.BASE_URL}assets/videos/industrial.mp4`,
  },
  {
    id: "modern",
    title: "🔷 Modern 🔶",
    description: "Fun, sleek, and cool, cool, cool... very cool.",
    video: `${import.meta.env.BASE_URL}assets/videos/modern.mp4`,
  },
  {
    id: "rustic-chic",
    title: "💖 Rustic Yet Chic 💖",
    description: "Classic and cozy spaces that are classed up and party-ready.",
    video: `${import.meta.env.BASE_URL}assets/videos/rustic_chic.mp4`,
  },
  {
    id: "distinctly-arizona",
    title: "🌞 Distinctly Arizona 🏜️",
    description: "The definition of the Southwest's history and present.",
    video: `${import.meta.env.BASE_URL}assets/videos/distinctly_arizona.mp4`,
  },
];

const VenueVibeIntro: React.FC<VenueVibeIntroProps> = ({
  venueRankerSelections,
  setVenueRankerSelections,
  onContinue,
  onBack,
  onClose,
}) => {
  const selected = venueRankerSelections.vibeSelections || [];
  const canContinue = selected.length >= 3;
  const [error, setError] = useState<string | null>(null);

  // --- Video autoplay-on-visible (muted) ---
  const videoRefs = useRef<Record<string, HTMLVideoElement | null>>({});
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const el = entry.target as HTMLVideoElement;
          if (!el) return;

          if (entry.isIntersecting) el.play().catch(() => {});
          else el.pause();
        });
      },
      { threshold: 0.55 }
    );

    vibes.forEach((v) => {
      const el = videoRefs.current[v.id];
      if (el) observerRef.current?.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  const toggleVibe = (id: string) => {
    setError(null);
    setVenueRankerSelections((prev) => {
      const cur = prev.vibeSelections || [];
      const has = cur.includes(id);
      const next = has ? cur.filter((x) => x !== id) : [...cur, id];
      return { ...prev, vibeSelections: next };
    });
  };

  const handleContinue = () => {
    if (!canContinue) {
      setError(`Pick at least 3 vibes to continue (${selected.length}/3).`);
      return;
    }
    onContinue();
  };

  const microcopy = useMemo(() => {
    if (selected.length === 0)
      return "Pick as many as you like — this helps us personalize your results.";
    if (selected.length < 3)
      return `Keep going — choose ${3 - selected.length} more.`;
    return "Perfect. Your venue lineup is about to get weirdly accurate ✨";
  }, [selected.length]);

  return (
    <div className="pixie-card wd-page-turn">
      {/* 🩷 Pink X inside the card */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      {/* Scrollable body */}
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        {/* 🖼️ Title Image */}
        <img
          src={`${import.meta.env.BASE_URL}assets/images/vibe_title.png`}
          alt="Venue Vibes"
          className="px-media px-media--sm"
          style={{ maxWidth: 190, marginBottom: 10 }}
        />

        {/* 🎥 Vibe Intro Video */}
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/vibe_intro_loop.mp4`}
          autoPlay
          muted
          playsInline
          loop
          className="px-media"
          style={{
            maxWidth: 250,
            borderRadius: 18,
            marginBottom: 10,
            display: "block",
            marginInline: "auto",
            pointerEvents: "none",
          }}
        />

        {/* ✨ Tight intro */}
        <h2
          className="px-intro-title"
          style={{ marginBottom: 6, fontSize: "1.9rem", lineHeight: 1.2 }}
        >
          Let’s dial in your wedding vibe!
        </h2>

        <p className="px-prose-narrow" style={{ marginBottom: 8, fontSize: "0.95rem" }}>
          Scroll down to pick <strong>at least three</strong> vibes. We’ll build your custom venue lineup from there.
        </p>

        <p style={{ margin: "0 0 14px", fontSize: "0.9rem", color: "#666" }}>
          {microcopy}
        </p>

        {/* Vibe Cards */}
        <div style={{ width: "100%", maxWidth: 560, marginInline: "auto" }}>
          {vibes.map((v) => {
            const isSelected = selected.includes(v.id);

            return (
              <div
                key={v.id}
                style={{
                  borderRadius: 18,
                  padding: "14px 14px 16px",
                  marginBottom: 14,
                  background: "rgba(255,255,255,0.72)",
                  boxShadow: isSelected
                    ? "0 0 0 2px rgba(44,98,186,0.35), 0 14px 28px rgba(0,0,0,0.10)"
                    : "0 10px 22px rgba(0,0,0,0.08)",
                  border: isSelected
                    ? "1px solid rgba(44,98,186,0.35)"
                    : "1px solid rgba(0,0,0,0.06)",
                  transition: "box-shadow 0.2s ease, transform 0.2s ease, border 0.2s ease",
                }}
              >
                {/* Title row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 10,
                    marginBottom: 10,
                  }}
                >
                  <h3
  className="px-title"
  style={{
    margin: "0 auto 6px",
    fontSize: "1.7rem",
    lineHeight: 1.15,
    textAlign: "center",
  }}
>
  {v.title}
</h3>

                  {/* Selected badge */}
                </div>

                {/* Video */}
                <video
                  ref={(el) => {
                    videoRefs.current[v.id] = el;
                  }}
                  src={v.video}
                  autoPlay
                  muted
                  playsInline
                  loop
                  className="px-media"
                  style={{
                    maxWidth: 420,
                    borderRadius: 16,
                    margin: "0 auto 10px",
                    display: "block",
                    boxShadow: isSelected ? "0 0 34px 10px rgba(255,255,255,0.95)" : "none",
                    transition: "box-shadow 0.25s ease-in-out",
                  }}
                />

                  {/* Description */}
<p
  className="px-prose-narrow"
  style={{
    margin: "0 auto 14px",
    maxWidth: 420,          // 👈 keeps it tight under the video
    fontSize: "0.95rem",
    textAlign: "center",    // 👈 centers the copy
    lineHeight: 1.45,
    paddingInline: 0,
  }}
>
  {v.description}
</p>

                {/* Pill toggle */}
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <button
                    type="button"
                    onClick={() => toggleVibe(v.id)}
                    style={{
                      border: "none",
                      borderRadius: 999,
                      padding: "10px 14px",
                      cursor: "pointer",
                      fontWeight: 800,
                      fontSize: "0.95rem",
                      background: isSelected ? "#2c62ba" : "rgba(2,165,242,0.14)",
                      color: isSelected ? "#fff" : "#1f4ca1",
                      boxShadow: isSelected ? "0 0 18px rgba(44,98,186,0.35)" : "none",
                      transition: "all 0.18s ease",
                    }}
                    aria-pressed={isSelected}
                  >
                    {isSelected ? "Selected ✨ (tap to remove)" : "Add this vibe ➕"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Error */}
        {error && (
          <p style={{ color: "#b30000", fontWeight: 800, margin: "6px 0 0" }}>
            {error}
          </p>
        )}
      </div>

      {/* ✅ Fixed footer (NOT sticky over content) */}
      <div
        style={{
          padding: "12px 18px 16px",
          borderTop: "1px solid rgba(0,0,0,0.06)",
          background: "#fff",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          alignItems: "center",
        }}
      >
        <button
          className="boutique-primary-btn"
          onClick={handleContinue}
          disabled={!canContinue}
          style={{
            opacity: canContinue ? 1 : 0.55,
            cursor: canContinue ? "pointer" : "not-allowed",
          }}
        >
          Continue with my vibes ({selected.length}/3)
        </button>

        <button className="boutique-back-btn" onClick={onBack}>
          ← Back
        </button>

        <div style={{ fontSize: "0.85rem", color: "#777", textAlign: "center" }}>
          You can change these later.
        </div>
      </div>
    </div>
  );
};

export default VenueVibeIntro;