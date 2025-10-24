import React, { useEffect, useRef } from "react";

interface MakeItOfficialProps {
  onNext: () => void;
  onBack: () => void;
  goToTOC?: () => void; // ✅ added so the overlay can wire "Back to TOC"
}

const MakeItOfficial: React.FC<MakeItOfficialProps> = ({ onNext, onBack, goToTOC }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // Ensure the card starts at the very top when this screen mounts
  useEffect(() => {
    try { cardRef.current?.scrollIntoView({ block: "start" }); } catch {}
  }, []);

  return (
    <div className="pixie-overlay">
      <div
        ref={cardRef}
        className="pixie-card"
        style={{ textAlign: "center", padding: "2rem 1.5rem", maxWidth: 600, margin: "0 auto" }}
      >
        {/* Title Image */}
        <img
          src="/assets/images/officiant.png"
          alt="Make It Official"
          style={{
            width: "100%",
            maxWidth: 325,
            margin: "0 auto 1.5rem",
            display: "block",
          }}
        />

        {/* Text Section */}
        <div style={{ fontSize: "1rem", lineHeight: 1.6, color: "#333", padding: "0 1rem" }}>
          <p>
            To legally tie the knot, you'll need an <strong>ordained officiant</strong> to perform your ceremony and sign your marriage license.
          </p>
          <p>
            If you’re asking a friend or family member to take on this role, make sure they complete the online ordination process — it’s quick and easy. We recommend doing this <strong>3–6 months</strong> before the wedding, just to be safe.
          </p>
          <p>
            And don’t forget the <strong>marriage license</strong> itself. In Arizona, it’s valid for <strong>up to one year</strong>, so there’s no need to wait until the last minute. You can apply online or book an appointment in person — just keep in mind, the online version takes longer to arrive.
          </p>
        </div>

        {/* Looping Video */}
        <video
          src="/assets/videos/Magic_Book/marriage_license.mp4"
          autoPlay
          loop
          muted
          playsInline
          preload="metadata"
          style={{ width: "100%", maxWidth: 400, margin: "2rem auto 1.5rem", display: "block", borderRadius: 16 }}
        />

        {/* Buttons (stacked, centered, consistent widths) */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
          {/* Turn the Page (Blue) */}
          <button
            onClick={onNext}
            style={{
              width: 180,
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

          {/* Back (Pink style via class) */}
          <button
            onClick={onBack}
            className="boutique-back-btn"
            style={{ width: 180, padding: "0.75rem 1rem", fontSize: "1.1rem", fontWeight: 600 }}
          >
            ⬅ Back
          </button>

          {/* Back to TOC (Purple) */}
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

export default MakeItOfficial;