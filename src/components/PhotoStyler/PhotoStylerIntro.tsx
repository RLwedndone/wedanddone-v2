import React from "react";

type PhotoStylerIntroProps = {
  onContinue: () => void;
  onClose: () => void;             // 👈 add this
};

const PhotoStylerIntro: React.FC<PhotoStylerIntroProps> = ({ onContinue, onClose }) => {
  return (
    <div className="pixie-card">
      {/* 🩷 Pink X inside the card */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src="/assets/icons/pink_ex.png" alt="Close" />
      </button>

      {/* Scrollable body */}
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        {/* 🖼️ Title Image */}
        <img
          src="/assets/images/PhotoStyleIntro.png"
          alt="Photo Style Intro"
          className="px-media px-media--md"
        />

        {/* 🎥 Video */}
        <video
  src="/assets/videos/photo_intro_loop.mp4"
  autoPlay
  muted
  playsInline
  loop
  className="px-media"
  style={{
    display: "block",
    width: "100%",
    maxWidth: "300px", // 💖 same size as Floral
    margin: "0 auto 1rem",
    borderRadius: "16px",
    objectFit: "contain",
  }}
/>

        {/* 📝 Description */}
        <p className="px-prose-narrow" style={{ marginBottom: 22 }}>
        <h2 className="px-intro-title">Let’s find your photo style!</h2>
          In this button boutique, We’ll show you some dreamy wedding images. Tell us which ones you love and which aren't your style.
          <br></br>
          <br></br>
          At the end, we’ll reveal your wedding photo vibe and you can book one of our photog artists for your big day!
        </p>

        {/* 👉 Continue */}
        <button className="boutique-primary-btn" onClick={onContinue}>
          Let’s Style!
        </button>
      </div>
    </div>
  );
};

export default PhotoStylerIntro;