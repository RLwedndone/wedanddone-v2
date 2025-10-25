import React, { useEffect } from "react";

interface TimeLineProps {
  onNext: () => void;
  onBack: () => void;
  goToTOC?: () => void; // ✅ optional, passed from overlay
}

const TimeLine: React.FC<TimeLineProps> = ({ onNext, onBack, goToTOC }) => {
  // 🔝 Always start at the very top when this screen mounts
  useEffect(() => {
    const scrollTop = () => {
      const overlay = document.querySelector<HTMLElement>(".pixie-overlay");
      overlay?.scrollTo({ top: 0, left: 0, behavior: "auto" });
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };
    scrollTop();
    const id1 = requestAnimationFrame(scrollTop);
    const id2 = requestAnimationFrame(scrollTop);
    const to = setTimeout(scrollTop, 0);
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
      clearTimeout(to as unknown as number);
    };
  }, []);

  const handleNext = () => {
    // moving forward from Timeline -> SetTables
    localStorage.setItem("magicStep", "setTables");
    onNext();
  };

  const handleBack = () => {
    // going back to Save The Date
    localStorage.setItem("magicStep", "saveTheDate");
    onBack();
  };

  // Reserve 16:9 space for videos (prevents layout jump)
  const Vid: React.FC<{ src: string }> = ({ src }) => (
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
          <source src={src} type="video/mp4" />
        </video>
      </div>
    </div>
  );

  return (
    // ⬇️ card only; the overlay is provided by MagicBookOverlay
    <div
      className="pixie-card"
      style={{
        maxWidth: 700,
        margin: "0 auto",
        padding: "2rem 1.5rem",
        textAlign: "center",
      }}
    >
      {/* 🎥 Top Video */}
      <Vid src={`${import.meta.env.BASE_URL}assets/videos/Magic_Book/time_line.mp4`} />

      <h2
        className="boutique-title"
        style={{ color: "#2c62ba", fontSize: "2rem", fontWeight: "bold", marginBottom: "1.5rem" }}
      >
        Timeline
      </h2>

      <p style={{ fontSize: "1rem", lineHeight: 1.6, marginBottom: "1rem" }}>
        Your W&amp;D Planning Pixies will assemble a tailored timeline for your wedding day, but you might
        need a little bit of info sooner.
      </p>

      <p style={{ fontSize: "1rem", lineHeight: 1.6, marginBottom: "1.5rem" }}>
        Here are our recommendations for creating a preliminary timeline:
      </p>

      <ul
        style={{
          fontSize: "1rem",
          lineHeight: 1.8,
          paddingLeft: "1rem",
          marginBottom: "2rem",
          textAlign: "left",
        }}
      >
        <li style={{ marginBottom: "0.75rem" }}>
          ⭐ Set your ceremony time at least an hour and a half before the sun sets
        </li>
        <li style={{ marginBottom: "0.75rem" }}>
          ⭐ Your invitation should state that the ceremony begins at least 15 minutes before you actually plan to start
        </li>
        <li style={{ marginBottom: "0.75rem" }}>
          ⭐ Decide if you and your fiancé will be doing a “first look.” Plan extra time before or after the ceremony depending on your answer
        </li>
        <li style={{ marginBottom: "0.75rem" }}>
          ⭐ Makeup and hair should be completed at least 30 minutes before your photographer begins
        </li>
      </ul>

      {/* 🎥 Bottom Video */}
      <div style={{ marginBottom: "2rem", textAlign: "center" }}>
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/Magic_Book/icon_parade_final.mp4`}
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          style={{ width: "100%", borderRadius: 16 }}
        />
      </div>

      {/* Buttons (stacked, centered, unified) */}
      <div style={{ textAlign: "center" }}>
        {/* Blue Next */}
        <button
          onClick={handleNext}
          style={{
            width: 180,
            backgroundColor: "#2c62ba",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            padding: "0.75rem 1rem",
            fontSize: "1.1rem",
            cursor: "pointer",
          }}
        >
          Turn the Page →
        </button>

        {/* Pink Back */}
        <div style={{ marginTop: "0.75rem" }}>
          <button
            className="boutique-back-btn"
            onClick={handleBack}
            style={{ width: 180, padding: "0.75rem 1rem", fontSize: "1.1rem", fontWeight: 600 }}
          >
            ⬅ Back
          </button>
        </div>

        {/* Purple Back to TOC */}
        <div style={{ marginTop: "0.5rem" }}>
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
    </div>
  );
};

export default TimeLine;