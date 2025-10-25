import React, { useState, useRef, useEffect } from "react";

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

interface VenueVibeSelectorProps {
  venueRankerSelections: VenueRankerSelections;
  setVenueRankerSelections: React.Dispatch<React.SetStateAction<VenueRankerSelections>>;
  onContinue: () => void;   // advance to next stage after last vibe (>=3 selected)
  onBack: () => void;       // back to Explore when at first vibe
  onClose: () => void;
}

const vibes: Vibe[] = [
  { id: "desert-dream", title: "🌵 Desert Dream ☀️", description: "Perfectly pristine desert landscaping and authentic desert backdrops. These venues showcase the Sonoran Desert in all its cacti glory.", video: `${import.meta.env.BASE_URL}assets/videos/desert_dream.mp4` },
  { id: "garden-greenery", title: "🌳 Garden Greenery 💐", description: "An oasis in the desert, you'll enjoy lush gardens, grassy spaces, and trees!", video: `${import.meta.env.BASE_URL}assets/videos/garden_greenery.mp4` },
  { id: "industrial", title: "🏗️ Industrial 🧱", description: "Clean, minimal, classic, and perfectly pulled together.", video: `${import.meta.env.BASE_URL}assets/videos/industrial.mp4` },
  { id: "modern", title: "🔷 Modern 🔶", description: "Fun, sleek, and cool, cool, cool... very cool.", video: `${import.meta.env.BASE_URL}assets/videos/modern.mp4` },
  { id: "rustic-chic", title: "💖 Rustic Yet Chic 💖", description: "Classic and cozy spaces that are classed up and ready for a party.", video: `${import.meta.env.BASE_URL}assets/videos/rustic_chic.mp4` },
  { id: "distinctly-arizona", title: "🌞 Distinctly Arizona 🏜️", description: "The definition of the Southwest's history and present.", video: `${import.meta.env.BASE_URL}assets/videos/distinctly_arizona.mp4` },
];

const VenueVibeSelector: React.FC<VenueVibeSelectorProps> = ({
  venueRankerSelections,
  setVenueRankerSelections,
  onContinue,
  onBack,
  onClose,
}) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [pendingChoice, setPendingChoice] = useState<"yes" | "no" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const currentVibe = vibes[currentIndex];
  const selectedVibes = venueRankerSelections.vibeSelections || [];
  const isLast = currentIndex === vibes.length - 1;
  const minimumSelected = selectedVibes.length >= 3;

  // Initialize radio from saved state when the index changes
  useEffect(() => {
    const liked = selectedVibes.includes(currentVibe.id);
    const seen = liked || vibes.some(v => v.id === currentVibe.id) && !liked;
    setPendingChoice(liked ? "yes" : selectedVibes.includes(currentVibe.id) ? "yes" : null);
    setError(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex]);

  const saveChoice = (choice: "yes" | "no") => {
    setPendingChoice(choice);
    setError(null);

    setVenueRankerSelections(prev => {
      const cur = prev.vibeSelections || [];
      const has = cur.includes(currentVibe.id);
      if (choice === "yes") {
        return { ...prev, vibeSelections: has ? cur : [...cur, currentVibe.id] };
      }
      // choice === "no" → remove if present
      return { ...prev, vibeSelections: has ? cur.filter(id => id !== currentVibe.id) : cur };
    });
  };

  const handleNext = () => {
    if (!pendingChoice) {
      setError("Please choose an option to continue.");
      return;
    }

    if (!isLast) {
      setCurrentIndex(i => i + 1);
      videoRef.current?.pause();
      setError(null);
      return;
    }

    // Last slide: require at least 3 selections
    if (minimumSelected) onContinue();
    else setError(`Choose at least 3 vibes to continue (${selectedVibes.length}/3).`);
  };

  const handleBack = () => {
    if (currentIndex === 0) {
      onBack();
    } else {
      setCurrentIndex(i => Math.max(0, i - 1));
      videoRef.current?.pause();
      setError(null);
    }
  };

  const liked = selectedVibes.includes(currentVibe.id);

  return (
    <div className="pixie-card">
      {/* 🩷 Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        {/* Title */}
        <h2 className="px-title" style={{ fontSize: "2.6rem", marginBottom: 10 }}>
  {currentVibe.title}
</h2>

        {/* Video */}
        <video
          ref={videoRef}
          src={currentVibe.video}
          autoPlay
          muted
          playsInline
          loop
          className="px-media"
          style={{
            maxWidth: 420,
            borderRadius: 16,
            margin: "0 auto 12px",
            display: "block",
            boxShadow: liked ? "0 0 35px 12px rgba(44, 98, 186, 0.6)" : "none",
            transition: "box-shadow 0.25s ease-in-out",
          }}
        />

        {/* Description */}
        <p className="px-prose-narrow" style={{ marginBottom: 14 }}>
          {currentVibe.description}
        </p>

        {/* Radios */}
        <fieldset
          style={{
            border: "1px solid #eee",
            borderRadius: 12,
            padding: "10px 12px",
            margin: "0 auto 14px",
            maxWidth: 460,
            textAlign: "left",
          }}
        >
          <legend className="sr-only">Choose whether this vibe fits</legend>

          <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 2px" }}>
            <input
              type="radio"
              name={`vibe-${currentVibe.id}`}
              value="yes"
              checked={pendingChoice === "yes"}
              onChange={() => saveChoice("yes")}
            />
            <span>Feels like us!✨</span>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 2px" }}>
            <input
              type="radio"
              name={`vibe-${currentVibe.id}`}
              value="no"
              checked={pendingChoice === "no"}
              onChange={() => saveChoice("no")}
            />
            <span>No thanks 👎 </span>
          </label>
        </fieldset>

        {/* Error / hint */}
        {error && (
          <p style={{ color: "#b30000", fontWeight: 700, marginBottom: 8 }}>
            {error}
          </p>
        )}

        {/* Controls */}
        <div className="px-cta-col" style={{ marginTop: 6 }}>
          <button className="boutique-primary-btn" onClick={handleNext}>
            {isLast ? "Finish" : "Next"}
          </button>
          <button className="boutique-back-btn" onClick={handleBack}>
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default VenueVibeSelector;