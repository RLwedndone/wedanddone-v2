// src/components/planner/PlannerIntro.tsx
import React from "react";

interface PlannerIntroProps {
  onContinue: () => void;
  onGoToVenue?: () => void;
  hasVenue?: boolean;
  hasPlanner?: boolean;
  guestCount?: number;
  onClose: () => void;
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

  // ── CASE 1: Venue already booked
  if (hasVenue) {
    return (
      <div className="pixie-card wd-page-turn">
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

  // ── CASE 2: Planner already booked
  if (hasPlanner) {
    return (
      <div className="pixie-card wd-page-turn">
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

  // ── CASE 3: Neither booked
  return (
    <div className="pixie-card wd-page-turn">
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body">
        {HeaderMedia}

        <h2 className="px-intro-title">
          Your calm-before-the-confetti crew ✨
        </h2>

        <p className="px-prose-narrow">
          Planning a wedding can be a magical mess — our Pixie Planners wrangle
          timelines, vendors, and day-of details so you can stay in your fairy-tale.
        </p>

        <p className="px-prose-narrow" style={{ marginBottom: "1rem" }}>
          <strong>💡 Pro tip:</strong> Every venue booked through Wed&Done{" "}
          <strong>includes Pixie Planning</strong>. If you start planning now and later choose
          your venue with us, we’ll fold the planner package into your venue pricing — no double charges.
        </p>

        {/* 💬 Founder Note (Pixie Planning Team) */}
        <div
          style={{
            margin: "1.25rem auto 1.5rem",
            maxWidth: 520,
            textAlign: "left",
            background: "rgba(240,246,255,0.85)",
            borderRadius: 16,
            padding: "14px 16px",
            boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
          }}
        >
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 900,
              color: "#2c62ba",
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/images/KFounder1x1.webp`}
              alt="Pixie Planning Team"
              style={{
                width: 60,
                height: 60,
                borderRadius: 10,
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
            The Pixie Planning team explains why this works
          </h2>

          <p
            style={{
              fontSize: "0.95rem",
              lineHeight: 1.45,
              color: "#333",
              margin: 0,
              fontStyle: "italic",
            }}
          >
            “Planning a wedding is magical… and full of moving parts.
            <br />
            <br />
            The Pixie Planning team is made up of real, experienced humans who handle the timelines,
            vendor communication, contract reviews, and day-of logistics — so you’re not fielding
            questions on your wedding morning.
            <br />
            <br />
            Every venue booked through Wed&Done includes Pixie Planning.
            Whether you start here or book your venue first, you’re covered.”
          </p>
        </div>

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