// src/components/NewYumBuild/CustomVenues/Tubac/TubacIntro.tsx
import React from "react";

interface TubacIntroProps {
  onContinue: () => void;
  onClose?: () => void;
}

const TubacIntro: React.FC<TubacIntroProps> = ({ onContinue, onClose }) => {
  const venueName = "Tubac Golf Resort";

  return (
    <div className="pixie-card wd-page-turn">
      {/* 🩷 Pink X Close */}
      {onClose && (
        <button
          className="pixie-card__close"
          onClick={onClose}
          aria-label="Close"
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
            alt="Close"
          />
        </button>
      )}

      {/* 🌸 Card Body */}
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        {/* 🧁 Title Image */}
        <img
          src={`${import.meta.env.BASE_URL}assets/images/yumyumtitle.png`}
          alt="Yum Yum Title"
          className="px-media px-media--md"
          style={{
            margin: "0 auto 12px",
            display: "block",
            width: "100%",
            maxWidth: "250px",
          }}
        />

        {/* 🎥 Intro Video */}
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/yum_intro_loop2.mp4`}
          autoPlay
          muted
          playsInline
          loop
          className="px-media px-media--lg"
          style={{
            borderRadius: 12,
            margin: "0 auto 24px",
            display: "block",
            width: "100%",
            maxWidth: "350px",
          }}
        />

        {/* 🐷 Title Text */}
        <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
          Welcome to Tubac Catering
        </h2>

        {/* 📜 Intro Paragraphs */}
        <div
          className="px-prose-narrow"
          style={{ margin: "0 auto 18px", maxWidth: 520 }}
        >
          <p>
            ✨ Welcome to your{" "}
            <strong>{venueName} catering journey!</strong>
          </p>

          <p>
            You’ll start by selecting your hand-passed and displayed
            hors d’oeuvres, then choose your service style —
            <strong> Plated Dinners or Buffet</strong>.
          </p>

          <p>
            After that, you’ll pick a tier within your service and build
            your menu with appetizers, salads, entrées, and sides matched
            to your selection.
          </p>

          <p>
            You’ll also see a few optional add-ons available at an additional
            charge. Everything shown under your chosen tier is included in
            your Tubac package.
          </p>
        </div>

        {/* 💬 Founder Note (Karen) */}
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
              alt="Karen, co-founder of Wed&Done"
              style={{
                width: 60,
                height: 60,
                borderRadius: 10,
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
            Karen explains why this works
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
            “Catering usually means inquiry forms, email threads, and menu
            revisions that somehow multiply overnight.
            <br />
            <br />
            We partnered directly with {venueName} to make this simple.
            You’re seeing their real menu, real pricing, and exactly what’s
            included — plus desserts.
            <br />
            <br />
            Choose your service style, customize your selections, and book
            without the back-and-forth.”
          </p>
        </div>

        {/* 💙 Continue Button */}
        <div className="px-cta-col" style={{ marginTop: 8 }}>
          <button className="boutique-primary-btn" onClick={onContinue}>
            Let’s Get Started!
          </button>
        </div>
      </div>
    </div>
  );
};

export default TubacIntro;