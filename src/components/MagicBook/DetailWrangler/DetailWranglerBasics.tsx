// src/components/MagicBook/DetailWrangler/DetailWranglerBasics.tsx
import React, { useEffect, useRef } from "react";

interface DetailWranglerBasicsProps {
  onNext: () => void;
  onBack: () => void;
  /** Provided by the overlay; navigates to the TOC */
  goToTOC?: () => void;
}

const DetailWranglerBasics: React.FC<DetailWranglerBasicsProps> = ({
  onNext,
  onBack,
  goToTOC,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Hard reset scroll when this screen mounts
  useEffect(() => {
    document.querySelectorAll<HTMLElement>(".pixie-overlay").forEach((el) => {
      try {
        el.scrollTo({ top: 0, left: 0, behavior: "auto" });
      } catch {}
    });
    try {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
      (document.scrollingElement || document.documentElement).scrollTop = 0;
      document.body.scrollTop = 0;
    } catch {}
    try {
      cardRef.current?.scrollIntoView({ block: "start", inline: "nearest" });
    } catch {}
  }, []);

  const handleBackToTOC = () => {
    console.log(
      "[DBG][Basics] TOC click – has goToTOC?",
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
        maxWidth: "600px",
        margin: "0 auto",
        padding: "2rem 1.5rem",
        textAlign: "center",
      }}
    >
      {/* Pink X */}
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

      {/* 🎥 Step 1: Budget */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        style={videoStyle}
      >
        <source
          src={`${import.meta.env.BASE_URL}assets/videos/Magic_Book/Step_One.mp4`}
          type="video/mp4"
        />
      </video>

      <h2
        className="boutique-title"
        style={{
          color: "#2c62ba",
          fontSize: "2rem",
          fontWeight: "bold",
          marginBottom: "1.5rem",
        }}
      >
        Step 1: Set a Budget (with a little wiggle room)
      </h2>
      <p
        style={{
          fontSize: "1rem",
          lineHeight: "1.6",
          marginBottom: "2rem",
        }}
      >
        Before you dive into cake tastings and Pinterest boards, set an
        approximate wedding budget.
        <br />
        <br />
        We recommend adding a buffer of <strong>10–15%</strong> for unexpected
        expenses (because something <em>always</em> pops up — trust us!).
        <br />
        <br />
        💡 <em>Good news!</em> Wed&Done helps you plan for nearly{" "}
        <strong>all</strong> your costs up front, so you won’t be surprised down
        the aisle.
      </p>

      {/* 🎥 Step 2: Calendar */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        style={videoStyle}
      >
        <source
          src={`${import.meta.env.BASE_URL}assets/videos/Magic_Book/Step_Two.mp4`}
          type="video/mp4"
        />
      </video>

      <h2
        className="boutique-title"
        style={{
          color: "#2c62ba",
          fontSize: "2rem",
          fontWeight: "bold",
          marginBottom: "1.5rem",
        }}
      >
        Step 2: Pick a Date...ish
      </h2>
      <p
        style={{
          fontSize: "1rem",
          lineHeight: "1.6",
          marginBottom: "2rem",
        }}
      >
        No need to carve it in stone just yet — even choosing a{" "}
        <strong>season</strong> or <strong>year</strong> can work wonders.
        <br />
        <br />
        ✨ Your venue, your vendors, and your whole magical timeline will orbit
        around this choice. Start early and you’ll thank yourself later.
      </p>

      {/* 🎥 Step 3: Team Building */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        style={videoStyle}
      >
        <source
          src={`${import.meta.env.BASE_URL}assets/videos/Magic_Book/Step_Three.mp4`}
          type="video/mp4"
        />
      </video>

      <h2
        className="boutique-title"
        style={{
          color: "#2c62ba",
          fontSize: "2rem",
          fontWeight: "bold",
          marginBottom: "1.5rem",
        }}
      >
        Step 3: Build Your Team
      </h2>
      <p
        style={{
          fontSize: "1rem",
          lineHeight: "1.6",
          marginBottom: "2rem",
        }}
      >
        It’s time to gather your people — your bridal party, your vendor dream
        team, and any honorary VIPs.
        <br />
        <br />
        Don’t worry — if you're booking through Wed&Done, our pros can help with
        vendor matchmaking and planning support.
        <br />
        <br />
        We’ve got a team of magic-makers standing by.
      </p>

      {/* 🎥 Step 4: Attire */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="metadata"
        style={videoStyle}
      >
        <source
          src={`${import.meta.env.BASE_URL}assets/videos/Magic_Book/Step_Four.mp4`}
          type="video/mp4"
        />
      </video>

      <h2
        className="boutique-title"
        style={{
          color: "#2c62ba",
          fontSize: "2rem",
          fontWeight: "bold",
          marginBottom: "1.5rem",
        }}
      >
        Step 4: Say Yes to the Dress (and the Suit)
      </h2>
      <p
        style={{
          fontSize: "1rem",
          lineHeight: "1.6",
          marginBottom: "2rem",
        }}
      >
        Start early when it comes to attire — especially bridal gowns, which can
        take up to a year to order and tailor.
        <br />
        <br />
        This goes for tuxes and suits too (especially custom ones). Better to
        feel fabulous <em>and</em> on time.
      </p>

      {/* Buttons */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
        }}
      >
        {/* Next */}
        <button
          onClick={onNext}
          style={{
            width: 180,
            marginTop: "1rem",
            backgroundColor: "#2c62ba",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "0.75rem 1rem",
            fontSize: "1.1rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Turn the Page ➡
        </button>

        {/* Back */}
        <button
          onClick={onBack}
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

        {/* Back to TOC (purple) */}
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

export default DetailWranglerBasics;