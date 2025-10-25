import React, { useEffect, useState } from "react";

interface PhotoVIPListProps {
  onNext: () => void;
  onBack: () => void;
  goToTOC?: () => void; // ✅ optional TOC handler
}

const PhotoVIPList: React.FC<PhotoVIPListProps> = ({ onNext, onBack, goToTOC }) => {
  const [loveBird1Name, setLoveBird1Name] = useState<string>("");
  const [loveBird2Name, setLoveBird2Name] = useState<string>("");

  useEffect(() => {
    const coupleData = localStorage.getItem("magicBookCoupleInfo");
    if (!coupleData) return;
    try {
      const parsed = JSON.parse(coupleData);
      if (parsed?.loveBird1?.first) setLoveBird1Name(parsed.loveBird1.first);
      if (parsed?.loveBird2?.first) setLoveBird2Name(parsed.loveBird2.first);
    } catch {}
  }, []);

  const handleNext = () => {
    // next screen in overlay: vip1
    localStorage.setItem("magicStep", "vip1");
    onNext();
  };

  const handleBack = () => {
    // previous screen in overlay: coupleInfo
    localStorage.setItem("magicStep", "coupleInfo");
    onBack();
  };

  return (
    // ✅ use the white card container; overlay wrapper is provided by MagicBookOverlay
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
      {/* 🎥 Centered Video with reserved 16:9 */}
      <div style={{ width: "75%", margin: "0 auto 1.5rem" }}>
        <div style={{ position: "relative", paddingTop: "56.25%" }}>
          <video
            src={`${import.meta.env.BASE_URL}assets/videos/Magic_Book/red_carpet.mp4`}
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
              borderRadius: 12,
              display: "block",
            }}
          />
        </div>
      </div>

      {/* 📜 Explainer Text */}
      <h2
        style={{
          fontSize: "2rem",
          textAlign: "center",
          marginBottom: "1rem",
          color: "#2c62ba",
        }}
      >
        Let’s Roll Out the Red Carpet!
      </h2>

      <p style={{ maxWidth: 700, textAlign: "center", margin: "0 auto 1rem" }}>
        It’s time to build your VIP lists. You’ll enter each side of the family separately — one clipboard
        for <strong>{loveBird1Name || "Love Bird #1"}</strong>, one for{" "}
        <strong>{loveBird2Name || "Love Bird #2"}</strong>.
      </p>
      <p style={{ maxWidth: 700, textAlign: "center", margin: "0 auto 2rem" }}>
        Start by adding close family, wedding party members, and anyone you’d like to include in your formal
        photos. These names will auto-magically appear in your photo shot list later!
      </p>

      {/* Buttons */}
      <div
        style={{
          textAlign: "center",
          marginTop: "2rem",
          display: "grid",
          gap: "0.6rem",
          justifyItems: "center",
        }}
      >
        {/* Continue */}
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
          Let’s Build the VIP Lists →
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

export default PhotoVIPList;