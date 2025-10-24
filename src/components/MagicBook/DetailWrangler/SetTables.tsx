import React, { useEffect } from "react";

interface SetTablesProps {
  onNext: () => void;
  onBack: () => void;
  goToTOC?: () => void; // ✅ optional, wired from the overlay
}

const SetTables: React.FC<SetTablesProps> = ({ onNext, onBack, goToTOC }) => {
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
    localStorage.setItem("magicStep", "photoVIPIntro");
    onNext();
  };

  const handleBack = () => {
    localStorage.setItem("magicStep", "timeline");
    onBack();
  };

  // Reserve 16:9 space so the video doesn't push content after paint
  const TopVideo: React.FC = () => (
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
          <source src="/assets/videos/Magic_Book/setTable.mp4" type="video/mp4" />
        </video>
      </div>
    </div>
  );

  return (
    // ⬇️ Return a card (the overlay comes from MagicBookOverlay)
    <div
      className="pixie-card"
      style={{
        maxWidth: 700,
        margin: "0 auto",
        padding: "2rem 1.5rem",
        textAlign: "left",
      }}
    >
      {/* 🎥 Top Video */}
      <TopVideo />

      <h2
        style={{
          fontSize: "1.75rem",
          marginBottom: "1rem",
          textAlign: "center",
          color: "#2c62ba",
        }}
      >
        ✨ Set the Table for a Smoother Celebration
      </h2>

      <p>
        No need to shine your silverware (we’ve got that covered), but we <strong>do</strong> recommend
        creating a guest seating plan — even if you're serving a buffet.
      </p>
      <p>
        Assigned seating makes guests feel more thoughtfully welcomed and prevents that moment of chaos when
        the reception doors swing open and everyone rushes the tables.
      </p>
      <p>Here are a few ways to keep it graceful:</p>
      <ul style={{ paddingLeft: "1.25rem", marginTop: "0.5rem" }}>
        <li>Create a simple sign listing guest names and table numbers</li>
        <li>
          Use escort cards that include names + table assignments
          <br />
          <span style={{ fontSize: "0.95rem", color: "#555" }}>
            (alphabetical order = bonus points!)
          </span>
        </li>
        <li>
          Offering entrée choices? You’ll need place cards too — with each guest’s name <em>and</em> their
          meal selection
        </li>
      </ul>

      {/* Buttons (stacked, centered, unified sizing) */}
      <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
        {/* Blue Next */}
        <button
          onClick={handleNext}
          style={{
            width: 180,
            backgroundColor: "#2c62ba",
            color: "#fff",
            fontSize: "1.1rem",
            padding: "0.75rem 1rem",
            borderRadius: 8,
            border: "none",
            cursor: "pointer",
          }}
        >
          Next Chapter →
        </button>

        {/* Pink Back */}
        <div style={{ marginTop: "0.75rem" }}>
          <button
            onClick={handleBack}
            className="boutique-back-btn"
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

export default SetTables;