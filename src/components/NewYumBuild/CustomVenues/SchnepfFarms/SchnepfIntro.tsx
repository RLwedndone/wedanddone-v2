// src/components/NewYumBuild/CustomVenues/SchnepfFarms/SchnepfIntro.tsx
import React from "react";

interface SchnepfIntroProps {
  venueName: "The Meadow" | "The Farmhouse" | "The Big Red Barn";
  onContinue: () => void;
  onClose?: () => void;
}

const SchnepfIntro: React.FC<SchnepfIntroProps> = ({ venueName, onContinue, onClose }) => {
  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 680 }}>
      {/* 🩷 Pink X Close */}
      {onClose && (
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
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
          style={{ width: 312, maxWidth: "95%", borderRadius: 12, margin: "0 auto 24px", display: "block" }}
        />

        <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
          Welcome to Schnepf Farms Catering
        </h2>

        <div className="px-prose-narrow" style={{ margin: "0 auto 18px", maxWidth: 540 }}>
          <p>
            ✨ Welcome to your <strong>Schnepf Farms</strong> catering journey at{" "}
            <strong>{venueName}</strong>!
          </p>

          <p>
            We’ll start by choosing your <strong>appetizers</strong> so your guest experience begins
            with a perfect first bite.
          </p>

          <p>
            Next, you’ll <strong>choose a cuisine</strong> (BBQ Dinner, Taco Bar, Rustic Italian,
            Classic Chicken Dinner, Live-Action Pasta Bar, Wood-Fired Pizza Bar, or Prime Rib),
            then pick your <strong>salad, sides, and entrées</strong>.
          </p>

          <p style={{ fontSize: ".95rem", color: "#444" }}>
            Heads-up: some menus include a <em>chef fee</em>.
          </p>

          <p style={{ fontSize: ".95rem", color: "#444" }}>
            🍷 Alcohol and bar packages (if applicable) are handled directly with the venue.
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