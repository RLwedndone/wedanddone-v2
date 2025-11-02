// src/components/NewYumBuild/CustomVenues/Bates/BatesIntro.tsx
import React from "react";

interface BatesIntroProps {
  onContinue: () => void;
  onClose?: () => void;
}

const BatesIntro: React.FC<BatesIntroProps> = ({ onContinue, onClose }) => {
  // ===================== RENDER =====================
return (
  <div
    style={{
      minHeight: "100vh",
      width: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "2rem 1rem", // gives breathing room on small screens
      boxSizing: "border-box",
    }}
  >
    <div
      className="pixie-card pixie-card--modal"
      style={{ maxWidth: 680, position: "relative" }}
    >
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

      <div
        className="pixie-card__body"
        style={{
          textAlign: "center",
          padding: "2rem 2.5rem", // adds comfortable spacing inside card
        }}
      >
        <img
          src={`${import.meta.env.BASE_URL}assets/images/yumyumtitle.png`}
          alt="Yum Yum Title"
          className="px-media"
          style={{
            width: 225,
            maxWidth: "80%",
            margin: "0 auto 12px",
          }}
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
          Welcome to Bates Catering
        </h2>

        <div className="px-prose-narrow" style={{ margin: "0 auto 18px", maxWidth: 520 }}>
          <p>
            ✨ Welcome to your <strong>Bates Mansion catering journey!</strong>
          </p>
          <p>
            Over the next few steps, you’ll choose your butler-passed hors d'oeuvres, salad and entrees to create a beautiful, cohesive menu for your celebration. Your Bates catering package is already included in your booking—this is where you’ll finalize the details.
          </p>
          <p>
            You’ll also see a few optional add-ons available at an additional charge. Everything else is included with your Bates Mansion booking.
          </p>
        </div>

        <div className="px-cta-col" style={{ marginTop: 8 }}>
          <button className="boutique-primary-btn" onClick={onContinue}>
            Build My Bates Feast
          </button>
        </div>
      </div>
    </div>
    </div>
  );
};

export default BatesIntro;