// src/components/NewYumBuild/CustomVenues/SchnepfFarms/SchnepfIntro.tsx
import React from "react";

interface SchnepfIntroProps {
  venueName: "The Meadow" | "The Farmhouse" | "The Big Red Barn";
  onContinue: () => void;
  onClose?: () => void;
}

const SchnepfIntro: React.FC<SchnepfIntroProps> = ({
  venueName,
  onContinue,
  onClose,
}) => {
  const venueBrand = "Schnepf Farms";

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 680 }}>
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

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <img
          src={`${import.meta.env.BASE_URL}assets/images/yumyumtitle.png`}
          alt="Yum Yum Title"
          className="px-media"
          style={{ width: 225, maxWidth: "80%", margin: "0 auto 12px" }}
        />

        <video
          src={`${import.meta.env.BASE_URL}assets/videos/yum_intro_loop2.mp4`}
          autoPlay
          muted
          playsInline
          loop
          className="px-media"
          style={{
            width: 312,
            maxWidth: "95%",
            borderRadius: 12,
            margin: "0 auto 24px",
            display: "block",
          }}
        />

        <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
          Welcome to Schnepf Farms Catering
        </h2>

        <div
          className="px-prose-narrow"
          style={{ margin: "0 auto 18px", maxWidth: 540 }}
        >
          <p>
            ✨ Welcome to your <strong>{venueBrand}</strong> catering journey at{" "}
            <strong>{venueName}</strong>!
          </p>

          <p>
            We’ll start by choosing your <strong>appetizers</strong> so your
            guest experience begins with the perfect first bite.
          </p>

          <p>
            Next, you’ll <strong>choose a cuisine</strong> (BBQ Dinner, Taco Bar,
            Rustic Italian, Classic Chicken Dinner, Live-Action Pasta Bar,
            Wood-Fired Pizza Bar, or Prime Rib), then pick your{" "}
            <strong>salad, sides, and entrées</strong>.
          </p>

          <p style={{ fontSize: ".95rem", color: "#444" }}>
            Heads-up: some menus include a <em>chef fee</em>.
          </p>

          <p style={{ fontSize: ".95rem", color: "#444" }}>
            🍷 Alcohol and bar packages (if applicable) are handled directly
            with the venue.
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
            We partnered directly with {venueBrand} to make this simple. You’re
            seeing their real menus, real pricing, and exactly what’s included —
            plus desserts.
            <br />
            <br />
            Choose your cuisine, customize your courses, and book without the
            back-and-forth.”
          </p>
        </div>

        <div className="px-cta-col" style={{ marginTop: 8 }}>
          <button className="boutique-primary-btn" onClick={onContinue}>
            Make My Menu ✨
          </button>
        </div>
      </div>
    </div>
  );
};

export default SchnepfIntro;