// src/components/NewYumBuild/CustomVenues/Tubac/TubacIntro.tsx
import React from "react";

interface TubacIntroProps {
  onContinue: () => void;
  onClose?: () => void;
}

const TubacIntro: React.FC<TubacIntroProps> = ({ onContinue, onClose }) => {
  return (
    <div className="pixie-card">
      {/* 🩷 Pink X Close (consistent with other boutiques) */}
      {onClose && (
        <button
          className="pixie-card__close"
          onClick={onClose}
          aria-label="Close"
        >
          <img src="/assets/icons/pink_ex.png" alt="Close" />
        </button>
      )}

      {/* 🌸 Card Body */}
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        {/* 🧁 Title Image — editable size */}
        <img
          src="/assets/images/yumyumtitle.png"
          alt="Yum Yum Title"
          className="px-media px-media--md"
          style={{
            margin: "0 auto 12px",
            display: "block",
            width: "100%",
            maxWidth: "250px", // 💡 edit this to resize title PNG
          }}
        />

        {/* 🎥 Intro Video — editable size */}
        <video
          src="/assets/videos/yum_intro_loop2.mp4"
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
            maxWidth: "350px", // 💡 edit this to resize video
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
            ✨ Welcome to your <strong>Tubac Golf Resort catering journey!</strong>
          </p>
          <p>
          You’ll start by selecting your hand-passed and displayed hors d’oeuvres, then choose your service style — Plated Dinners or Buffet.
          </p>
          <p>
          After that, you’ll pick a tier within your service and build your menu with appetizers, salads, entrées, and sides matched to your selection.
          </p>
          <p>You’ll also see a few optional add-ons available at an additional charge. Everything else shown under your chosen tier is included in your Tubac package.</p>
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