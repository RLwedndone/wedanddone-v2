// src/components/planner/PlannerIntro.tsx
import React from "react";

interface PlannerIntroProps {
  onContinue: () => void;       // book planner now
  onGoToVenue?: () => void;     // navigate to venue ranker (optional)
  hasVenue?: boolean;           // already booked a venue via Wed&Done
  hasPlanner?: boolean;         // already booked planner
  guestCount?: number;          // optional: show current tier info
  onClose: () => void;          // ⬅ added to support the pink X
}

const tierFor = (gc: number | undefined) => {
  if (!gc || gc <= 100) return "$1,250 (up to 100 guests)";
  if (gc <= 150) return "$1,550 (up to 150 guests)";
  return "$1,850 (200+ guests)";
};

const PlannerIntro: React.FC<PlannerIntroProps> = ({
  onContinue,
  onGoToVenue,
  hasVenue,
  hasPlanner,
  guestCount,
  onClose,
}) => {
  // Shared media header
  const HeaderMedia = (
    <>
      <img
        src={`${import.meta.env.BASE_URL}assets/images/planner_title.png`}
        alt="Pixie Planner"
        className="px-media px-media--sm"
      />
      <video
        src={`${import.meta.env.BASE_URL}assets/videos/planner_intro.mp4`}
        autoPlay
        muted
        playsInline
        loop
        className="px-media px-media--lg"
      />
    </>
  );

  // ── CASE 1: Venue already booked → planner included
  if (hasVenue) {
    return (
      <div className="pixie-card">
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
        </button>

        <div className="pixie-card__body">
          {HeaderMedia}
          <p className="px-prose-narrow" style={{ marginBottom: "1rem" }}>
            Hooray! You booked your venue through Wed&Done — that{" "}
            <strong>includes full Pixie Planning</strong>. You’re all set here.  
            Check out the other Button Boutiques to keep the magic going! ✨
          </p>

          <button className="boutique-primary-btn" onClick={onClose}>
            Got it!
          </button>
        </div>
      </div>
    );
  }

  // ── CASE 2: Planner already booked → steer to venues
  if (hasPlanner) {
    return (
      <div className="pixie-card">
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
        </button>

        <div className="pixie-card__body">
          {HeaderMedia}
          <p className="px-prose-narrow" style={{ marginBottom: "0.75rem" }}>
            You’re all set with your <strong>Pixie Planner</strong>! When you browse venues, we’ll{" "}
            <strong>automatically remove the planner cost</strong> from venue pricing so you’re never double-charged.
          </p>

          {typeof guestCount === "number" && (
            <p className="px-prose-narrow" style={{ color: "#555", marginBottom: "1rem" }}>
              Current guest count: <strong>{guestCount}</strong> • Planner tier:{" "}
              <strong>{tierFor(guestCount)}</strong>
            </p>
          )}

          {onGoToVenue ? (
            <button className="boutique-primary-btn" onClick={onGoToVenue}>
              Find My Venue
            </button>
          ) : (
            <button className="boutique-primary-btn" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── CASE 3: Neither booked → standard intro with two CTAs
  return (
    <div className="pixie-card">
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body">
        {HeaderMedia}

        <p className="px-prose-narrow">
          <h2 className="px-intro-title">Your calm-before-the-confetti crew ✨</h2>
          Planning a wedding can be a magical mess — our Pixie Planners wrangle timelines,
          vendors, and day-of details so you can stay in your fairy-tale.
        </p>

        <p className="px-prose-narrow" style={{ marginBottom: "1rem" }}>
          <strong>💡 Pro tip:</strong> Every venue booked through Wed&Done{" "}
          <strong>includes Pixie Planning</strong>. If you start planning now and later choose
          your venue with us, we’ll fold the planner package into your venue pricing — no double charges.
        </p>

        {typeof guestCount === "number" && (
          <p className="px-prose-narrow" style={{ color: "#555", marginBottom: "1rem" }}>
            Your current tier would be <strong>{tierFor(guestCount)}</strong>.
          </p>
        )}

        <div className="px-cta-row" style={{ gap: 12 }}>
          <button className="boutique-primary-btn" onClick={onContinue}>
            Book My Planner
          </button>
          {onGoToVenue && (
            <button className="boutique-back-btn" onClick={onGoToVenue}>
              I’ll Book a Venue Instead
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PlannerIntro;