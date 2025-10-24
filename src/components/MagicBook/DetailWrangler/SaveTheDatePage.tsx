import React, { useEffect, useRef } from "react";

interface SaveTheDatePageProps {
  onNext: () => void;
  onBack: () => void;
  goToTOC?: () => void; // ✅ allow overlay to wire Back to TOC
}

const SaveTheDatePage: React.FC<SaveTheDatePageProps> = ({ onNext, onBack, goToTOC }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Hard reset scroll when this screen mounts
  useEffect(() => {
    try { cardRef.current?.scrollIntoView({ block: "start" }); } catch {}
  }, []);

  const handleNext = () => {
    localStorage.setItem("magicBookStep", "saveTheDate");
    onNext();
  };

  const handleBack = () => {
    localStorage.setItem("magicBookStep", "makeitofficial");
    onBack();
  };

  return (
    <div className="pixie-overlay">
      <div
        ref={cardRef}
        className="pixie-card"
        style={{
          position: "relative",
          padding: 0,
          overflow: "hidden",
          maxWidth: 600,
          margin: "0 auto",
        }}
      >
        {/* 📷 Full-bleed image */}
        <div style={{ paddingTop: "2rem", textAlign: "center" }}>
          <img
            src="/assets/images/save_date.png"
            alt="Save the Date"
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              position: "relative",
              zIndex: 1,
            }}
          />
        </div>

        {/* (Optional) overlay text area if you add copy later */}
        <div
          style={{
            position: "absolute",
            top: "26%",
            left: "8%",
            width: "84%",
            zIndex: 2,
            textAlign: "center",
            color: "#2c2c2c",
            fontSize: "1rem",
            lineHeight: 1.6,
            fontWeight: 500,
            pointerEvents: "none",
          }}
        />

        {/* ✨ Buttons (stacked, centered) */}
        <div style={{ padding: "1rem 0 1.25rem", textAlign: "center", position: "relative", zIndex: 3 }}>
          {/* Blue: Turn the Page */}
          <button
            onClick={handleNext}
            style={{
              width: 180,
              marginTop: "0.5rem",
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

          {/* Pink: Back */}
          <div style={{ marginTop: "0.75rem" }}>
            <button
              onClick={handleBack}
              className="boutique-back-btn"
              style={{ width: 180, padding: "0.75rem 1rem", fontSize: "1.1rem", fontWeight: 600 }}
            >
              ⬅ Back
            </button>
          </div>

          {/* Purple: Back to TOC */}
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
    </div>
  );
};

export default SaveTheDatePage;