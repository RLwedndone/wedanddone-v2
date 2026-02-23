import React from "react";

type PhotoStylerIntroProps = {
  onContinue: () => void;
  onClose: () => void;             // 👈 add this
};

const PhotoStylerIntro: React.FC<PhotoStylerIntroProps> = ({ onContinue, onClose }) => {
  return (
    <div className="pixie-card wd-page-turn">
      {/* 🩷 Pink X inside the card */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      {/* Scrollable body */}
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        {/* 🖼️ Title Image */}
        <img
          src={`${import.meta.env.BASE_URL}assets/images/PhotoStyleIntro.png`}
          alt="Photo Style Intro"
          className="px-media px-media--md"
        />

        {/* 🎥 Video */}
        <video
  src={`${import.meta.env.BASE_URL}assets/videos/photo_intro_loop.mp4`}
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
        <h2 className="px-intro-title">Let’s find your photo style!</h2>

        <p className="px-prose-narrow" style={{ marginBottom: 18 }}>
          In this button boutique, we’ll show you dreamy wedding images.
          Tell us which ones you love — and which ones aren’t your vibe.
          <br />
          <br />
          At the end, we’ll reveal your wedding photo style and match you
          with one of our trusted photo pros for your big day.
        </p>

        {/* 💬 Founder Note */}
<div
  style={{
    margin: "1.25rem auto 1.75rem",
    maxWidth: 520,
    textAlign: "left",
    background: "rgba(240,246,255,0.85)",
    borderRadius: 16,
    padding: "14px 16px",
    boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
  }}
>
  {/* Small h2-style title */}
  <h2
    style={{
      fontSize: "1.7rem",
      fontWeight: 900,
      color: "#2c62ba",
      marginBottom: 8,
      display: "flex",
      alignItems: "center",
      gap: 10,
    }}
  >
    <img
      src={`${import.meta.env.BASE_URL}assets/images/RFounderGlasses1x1.webp`}
      alt="Rachel, founder of Wed&Done"
      style={{
        width: 60,
        height: 60,
        borderRadius: 10,
        objectFit: "cover",
        flexShrink: 0,
      }}
    />
    Rachel explains why this works
  </h2>

  {/* Exact quote — unchanged */}
  <p
    style={{
      fontSize: "0.95rem",
      lineHeight: 1.45,
      color: "#333",
      margin: 0,
      fontStyle: "italic",
    }}
  >
    “I know what you’re thinking — how can I book a photographer without
    picking the ACTUAL photographer?
    <br />
    <br />
    Because I’ve been doing this for 15 years. I know who consistently
    delivers, who matches which style, and who I trust with real wedding
    days. You get the look you want — without playing vendor roulette.”
  </p>
</div>

        {/* 👉 Continue */}
        <button className="boutique-primary-btn" onClick={onContinue}>
          Let’s Style!
        </button>
      </div>
    </div>
  );
};

export default PhotoStylerIntro;