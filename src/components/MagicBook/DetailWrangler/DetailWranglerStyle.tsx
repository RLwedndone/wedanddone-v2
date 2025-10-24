import React, { useEffect, useRef } from "react";

interface DetailWranglerStyleProps {
  onNext: () => void;
  onBack: () => void;
  goToTOC?: () => void; // ✅ optional: provided by the overlay
}

const DetailWranglerStyle: React.FC<DetailWranglerStyleProps> = ({ onNext, onBack, goToTOC }) => {
  const cardRef = useRef<HTMLDivElement>(null);

  // (Optional) ensure the card starts at the very top on mount
  useEffect(() => {
    try { cardRef.current?.scrollIntoView({ block: "start" }); } catch {}
  }, []);

  /* ---------------- DEBUG HELPERS ---------------- */
  const dbgInfo = (e: React.MouseEvent) => {
    const t = e.currentTarget as HTMLElement;
    const pe = getComputedStyle(t).pointerEvents;
    const z  = getComputedStyle(t).zIndex;
    const atPoint = document.elementFromPoint(
      (e.nativeEvent as MouseEvent).clientX,
      (e.nativeEvent as MouseEvent).clientY
    ) as HTMLElement | null;

    return {
      targetTag: t.tagName,
      targetClass: t.className,
      targetPE: pe,
      targetZ: z,
      atPointTag: atPoint?.tagName,
      atPointClass: atPoint?.className,
      atPointPE: atPoint ? getComputedStyle(atPoint).pointerEvents : undefined,
      atPointZ:  atPoint ? getComputedStyle(atPoint).zIndex : undefined,
    };
  };

  const onNextClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log("[DBG][Style] NEXT click fired", dbgInfo(e));
    onNext?.();
  };

  const onBackClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log("[DBG][Style] BACK click fired", dbgInfo(e));
    onBack?.();
  };

  const onTocClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    console.log("[DBG][Style] TOC click fired", dbgInfo(e));
    // Call through to overlay if provided
    if (goToTOC) goToTOC();
    // If you want to force-set directly for testing, uncomment:
    // localStorage.setItem("magicStep", "toc");
    // window.dispatchEvent(new Event("storage"));
  };
  /* ------------------------------------------------ */

  return (
    <div className="pixie-overlay">
      <div
        ref={cardRef}
        className="pixie-card"
        style={{
          position: "relative",
          padding: 0,
          overflow: "hidden",
          maxWidth: "600px",
          margin: "0 auto",
          height: "auto",
          textAlign: "center",
        }}
      >
        {/* 🌈 Full Background Image */}
        <div style={{ paddingTop: "2rem" }}>
          <img
            src="/assets/images/style_baby.png"
            alt="Style Baby Background"
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              position: "relative",
              zIndex: 1,
            }}
          />
        </div>

        {/* ✍️ (Reserved) Text Overlay – add content if needed */}
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
            pointerEvents: "none", // make sure this overlay never blocks clicks
          }}
        />

        {/* ✨ CTA + Back Buttons */}
        <div style={{ padding: "1rem", position: "relative", zIndex: 3 }}>
          {/* Next / Turn the Page */}
          <button
            onClick={onNextClick}
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

          <br />

          {/* Back */}
          <button
            onClick={onBackClick}
            className="boutique-back-btn"
            style={{
              width: 180,
              padding: "0.75rem 1rem",
              marginTop: "1rem",
              fontSize: "1.1rem",
              fontWeight: 600,
            }}
          >
            ⬅ Back
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
    </div>
  );
};

export default DetailWranglerStyle;