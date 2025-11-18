// src/components/MagicBook/DetailWrangler/DetailWranglerWeddingCosts.tsx
import React, { useEffect, useRef } from "react";

interface DetailWranglerWeddingCostsProps {
  onNext: () => void;
  onOpenBudget: () => void;
  onBack: () => void;
  goToTOC?: () => void; // ✅ optional: provided by the overlay
}

const DetailWranglerWeddingCosts: React.FC<DetailWranglerWeddingCostsProps> = ({
  onNext,
  onOpenBudget,
  onBack,
  goToTOC,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Make sure we start at the very top when this screen mounts
  useEffect(() => {
    try {
      cardRef.current?.scrollIntoView({ block: "start" });
    } catch {}
  }, []);

  const handleNext = () => {
    // localStorage.setItem("magicBookStep", "makeItOfficial"); // keep if you still need it
    onNext();
  };

  const handleBack = () => {
    // localStorage.setItem("magicBookStep", "style"); // keep if you still need it
    onBack();
  };

  const handleBackToTOC = () => {
    console.log(
      "[DBG][WeddingCosts] TOC click – has goToTOC?",
      typeof goToTOC === "function"
    );
    if (typeof goToTOC === "function") {
      goToTOC();
      return;
    }
    // Fallback: set intent + tell overlay to navigate
    localStorage.setItem("magicStep", "toc");
    window.dispatchEvent(new Event("magic:gotoTOC"));
  };

  const videoStyle: React.CSSProperties = {
    width: "75%",
    borderRadius: "16px",
    marginBottom: "1.5rem",
    display: "block",
    marginLeft: "auto",
    marginRight: "auto",
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
  };

  return (
    <div
      ref={cardRef}
      className="pixie-card"
      style={{
        padding: "2rem 3.5rem", 
        position: "relative",
        textAlign: "center",
        maxWidth: "640px",
        margin: "0 auto",
      }}
    >
      {/* Pink X – back to TOC */}
      <button
        className="pixie-card__close"
        onClick={handleBackToTOC}
        aria-label="Close"
      >
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      {/* 🎥 Video 1 */}
      <div style={{ marginBottom: "1.5rem" }}>
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          style={videoStyle}
        >
          <source
            src={`${import.meta.env.BASE_URL}assets/videos/Magic_Book/wedding_costs.mp4`}
            type="video/mp4"
          />
        </video>
      </div>

      {/* 📝 Text */}
      <p
        style={{
          fontSize: "1.05rem",
          lineHeight: 1.7,
          color: "#333",
          marginBottom: "2rem",
        }}
      >
        Wedding costs can add up fast — but you’re already one step ahead.
        <br />
        <br />
        Most of the big-ticket vendors — like venue, catering, photography,
        music, and planning — can be booked right here through our magical
        boutique buttons ✨
        <br />
        <br />
        But we know there are other important purchases, like your wedding
        dress, beauty team, or travel plans. That’s why we’ve built a special
        Budget Wand that lets you track <em>all</em> your expenses in one place —
        even the ones outside of Wed&Done.
      </p>

      {/* 🎥 Video 2 */}
      <div style={{ marginBottom: "1.5rem" }}>
        <video
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          style={{ ...videoStyle, width: "45%" }}
        >
          <source
            src={`${import.meta.env.BASE_URL}assets/videos/Magic_Book/piggy_bank.mp4`}
            type="video/mp4"
          />
        </video>
      </div>

      {/* Buttons (stacked, centered, consistent widths) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: "1.5rem",
          gap: "0.75rem",
        }}
      >
        {/* 💸 Budget Wand - Purple */}
        <button
          onClick={onOpenBudget}
          style={{
            backgroundColor: "#7b4bd8",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "0.75rem 1rem",
            fontSize: "1rem",
            width: 180,
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          Check Out the Budget Wand 💸
        </button>

        {/* 📖 Turn the Page - Blue */}
        <button
          onClick={handleNext}
          style={{
            backgroundColor: "#2c62ba",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "0.75rem 1rem",
            fontSize: "1.1rem",
            width: 180,
            cursor: "pointer",
            fontWeight: 600,
            marginTop: "0.25rem",
          }}
        >
          Turn the Page ➡
        </button>

        {/* ⬅️ Back - Pink */}
        <button
          onClick={handleBack}
          className="boutique-back-btn"
          style={{
            width: 180,
            padding: "0.75rem 1rem",
            fontSize: "1.1rem",
            fontWeight: 600,
          }}
        >
          ⬅ Back
        </button>

        {/* 🪄 Back to TOC (Purple) */}
        <button
          onClick={handleBackToTOC}
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

export default DetailWranglerWeddingCosts;