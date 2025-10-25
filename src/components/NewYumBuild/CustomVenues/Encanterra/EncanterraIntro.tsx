// src/components/NewYumBuild/CustomVenues/Encanterra/EncanterraIntro.tsx
import React from "react";

interface EncanterraIntroProps {
  venueName?: "Encanterra";
  onContinue: () => void;
  onClose?: () => void;
}

const EncanterraIntro: React.FC<EncanterraIntroProps> = ({
  venueName = "Encanterra",
  onContinue,
  onClose,
}) => {
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
          Welcome to {venueName} Catering
        </h2>

        <div className="px-prose-narrow" style={{ margin: "0 auto 18px", maxWidth: 520 }}>
          <p>
            ✨ Welcome to <strong>{venueName} catering!</strong>
          </p>
          <p>
            You’ll begin by exploring three Diamond tiers — <strong>1 Carat, 2 Carat, and 3 Carat</strong>.
          </p>
          <p>
            After choosing your tier, you’ll select your{" "}
            <strong>hand-passed hors d’oeuvres, salad, entrées, and sides</strong>.
          </p>
          <p>
            🌟 Your selections will also count toward the <strong>$8K food &amp; beverage minimum</strong> required at {venueName}.
          </p>
          <p>
            🍷 A quick note of practicality:{" "}
            <strong>all alcohol and bar packages are booked directly with {venueName}</strong>, in accordance with Arizona state liquor laws.
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

export default EncanterraIntro;