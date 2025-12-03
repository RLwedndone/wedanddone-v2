// src/components/MagicBook/MagIntro.tsx
import React from "react";

interface MagIntroProps {
  onNext: () => void;
  onClose: () => void;
}

const MagIntro: React.FC<MagIntroProps> = ({ onNext, onClose }) => {
  return (
    <div className="pixie-card">
      {/* Pink X */}
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

      <div className="pixie-card__body">
        {/* Title Image */}
        <img
          src={`${import.meta.env.BASE_URL}assets/images/MagicBookTextIntro.png`}
          alt="Magic Book Intro Title"
          className="px-media px-media--md"
          style={{ marginBottom: "1.5rem" }}
        />

        {/* Looping Intro Video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          className="px-media px-media--md"
          style={{ borderRadius: "12px", marginBottom: "1.5rem" }}
        >
          <source
            src={`${import.meta.env.BASE_URL}assets/videos/Magic_Book/Mag_Book_Intro.mp4`}
            type="video/mp4"
          />
        </video>

        {/* Explainer Text */}
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              fontSize: "1rem",
              lineHeight: "1.6",
              marginBottom: "1.5rem",
            }}
          >
            Welcome to your <strong>Magical Book of Deets!</strong>
            <br />
            <br />
            This is your enchanted planning space for all things weddingy and
            wonderful. Inside you'll find:
            <br />
            <br />
            <span className="emoji" role="img" aria-label="magic sparkle">
              ✨
            </span>{" "}
            <strong>The Detail Wrangler</strong> — your secret stash of expert tips,
            timelines, and planning spells.
            <br />
            <br />
            📸 <strong>The VIP & Photos Chapter</strong> — create your VIP list and
            build a custom shot list for your photographer (with adorable
            Polaroids!).
          </p>

          <button
  onClick={onNext}
  className="boutique-primary-btn"
  style={{
    padding: "0.75rem 1.5rem",
    fontSize: "1.1rem",
    borderRadius: "8px",
    color: "#fff",
    border: "none",
    cursor: "pointer",
  }}
>
  start your story
</button>
        </div>
      </div>
    </div>
  );
};

export default MagIntro;