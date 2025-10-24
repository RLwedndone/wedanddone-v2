import React from "react";

interface PhotoVIPIntroProps {
  onNext: () => void;
  onBack: () => void;
  goToTOC?: () => void; // ✅ add TOC handler
}

const PhotoVIPIntro: React.FC<PhotoVIPIntroProps> = ({ onNext, onBack, goToTOC }) => {
  const handleNext = () => {
    localStorage.setItem("magicStep", "coupleInfo");
    onNext();
  };

  const handleBack = () => {
    // previous screen in your overlay flow
    localStorage.setItem("magicStep", "setTables");
    onBack();
  };

  return (
    // ✅ use a card (the overlay wrapper is provided by MagicBookOverlay)
    <div
      className="pixie-card"
      style={{
        backgroundColor: "#fff",
        maxWidth: 700,
        margin: "0 auto",
        padding: "2rem 1.5rem",
        textAlign: "left",
      }}
    >
      {/* 🎥 Top Video */}
      <div style={{ width: "75%", margin: "0 auto 1.5rem" }}>
        <div style={{ position: "relative", paddingTop: "56.25%" }}>
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="metadata"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              borderRadius: 16,
              display: "block",
              WebkitMaskImage: `
                linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%),
                linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)
              `,
              maskImage: `
                linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%),
                linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)
              `,
              WebkitMaskComposite: "intersect",
              maskComposite: "intersect",
              WebkitMaskRepeat: "no-repeat",
              maskRepeat: "no-repeat",
              WebkitMaskSize: "100% 100%",
              maskSize: "100% 100%",
              backgroundColor: "#fff",
            }}
          >
            <source src="/assets/videos/Magic_Book/love_birds.mp4" type="video/mp4" />
          </video>
        </div>
      </div>

      {/* ✨ Explainer Text */}
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <h2
          style={{
            fontSize: "1.75rem",
            marginBottom: "1rem",
            textAlign: "center",
            color: "#2c62ba",
          }}
        >
          Welcome to the Photo Deets & VIP Chapter!
        </h2>

        <p>These pages will help you plan the perfect formal shot list for your big day!</p>
        <p><strong>In the next few pages, you’ll:</strong></p>
        <ul style={{ paddingLeft: "1.2rem", marginBottom: "1rem" }}>
          <li>Tell us about you, as a couple 💕</li>
          <li>Share your VIPs (Parents, Wedding Party, etc.)</li>
          <li>Customize your shot list</li>
        </ul>
        <p>
          Don’t worry — you can skip or change anything along the way. This is your love story,
          after all. Let’s make it picture-perfect!
        </p>
      </div>

      {/* 📘 Navigation Buttons */}
      <div style={{ textAlign: "center", marginTop: "2rem", display: "grid", gap: "0.6rem", justifyItems: "center" }}>
        {/* Next */}
        <button
          onClick={handleNext}
          style={{
            backgroundColor: "#2c62ba",
            color: "#fff",
            fontSize: "1.1rem",
            padding: "0.75rem 2rem",
            borderRadius: 999,
            border: "none",
            cursor: "pointer",
            width: 250,
          }}
        >
          Turn the Page →
        </button>

        {/* Back */}
        <button
          onClick={handleBack}
          className="boutique-back-btn"
          style={{ width: 250, padding: "0.75rem 1rem" }}
        >
          ⬅ Previous Page
        </button>

        {/* 🪄 Back to TOC (purple) */}
        <button
  onClick={() => {
    console.log("[DBG][Style] TOC click – has goToTOC?", typeof goToTOC === "function");
    if (typeof goToTOC === "function") {
      goToTOC();
      return;
    }
    // Fallback: set intent + tell overlay to navigate
    localStorage.setItem("magicStep", "toc");
    window.dispatchEvent(new Event("magic:gotoTOC"));
  }}
  style={{
    backgroundColor: "#7b4bd8",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "0.75rem 1rem",
    fontSize: "1.05rem",
    fontWeight: 600,
    cursor: "pointer",
    width: 180,
    marginTop: "0.5rem",
  }}
>
  🪄 Back to TOC
</button>
      </div>
    </div>
  );
};

export default PhotoVIPIntro;