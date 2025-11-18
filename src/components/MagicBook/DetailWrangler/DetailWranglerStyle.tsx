// src/components/MagicBook/DetailWrangler/DetailWranglerStyle.tsx
import React, { useEffect, useRef } from "react";

interface DetailWranglerStyleProps {
  onNext: () => void;
  onBack: () => void;
  goToTOC?: () => void; // ✅ optional: provided by the overlay
}

const DetailWranglerStyle: React.FC<DetailWranglerStyleProps> = ({
  onNext,
  onBack,
  goToTOC,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      cardRef.current?.scrollIntoView({ block: "start" });
    } catch {}
  }, []);

  const dbgInfo = (e: React.MouseEvent) => {
    const t = e.currentTarget as HTMLElement;
    const pe = getComputedStyle(t).pointerEvents;
    const z = getComputedStyle(t).zIndex;
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
      atPointZ: atPoint ? getComputedStyle(atPoint).zIndex : undefined,
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
    if (typeof goToTOC === "function") {
      goToTOC();
      return;
    }
    localStorage.setItem("magicStep", "toc");
    window.dispatchEvent(new Event("magic:gotoTOC"));
  };

  return (
    // ✅ standard pixie card with normal padding and scrollable content
    <div
      ref={cardRef}
      className="pixie-card"
      style={{
        position: "relative",
        maxWidth: 700,
        margin: "0 auto",
        padding: "1.5rem 1.5rem 1.75rem",
        textAlign: "center",
      }}
    >
      {/* Pink X – go back to TOC */}
      <button
        className="pixie-card__close"
        onClick={onTocClick}
        aria-label="Close"
      >
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      {/* 📜 Style Baby artwork inside the card */}
      <div
        style={{
          marginTop: "0.75rem",
          marginBottom: "1.25rem",
        }}
      >
        <img
          src={`${import.meta.env.BASE_URL}assets/images/style_baby.png`}
          alt="Style, Baby!"
          style={{
            width: "100%",
            maxWidth: 640,
            height: "auto",
            display: "block",
            margin: "0 auto",
            borderRadius: 16,
          }}
        />
      </div>

      {/* (No absolute overlay needed; text is baked into the PNG) */}

      {/* ✨ CTA + Back Buttons */}
      <div
        style={{
          marginTop: "0.5rem",
          display: "grid",
          gap: "0.6rem",
          justifyItems: "center",
        }}
      >
        {/* Next / Turn the Page */}
        <button
          onClick={onNextClick}
          style={{
            width: 220,
            backgroundColor: "#2c62ba",
            color: "#fff",
            border: "none",
            borderRadius: 999,
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
          onClick={onBackClick}
          className="boutique-back-btn"
          style={{
            width: 220,
            padding: "0.75rem 1rem",
            fontSize: "1.05rem",
            fontWeight: 600,
          }}
        >
          ⬅ Back
        </button>

        {/* 🪄 Back to TOC (purple) */}
        <button
          onClick={onTocClick}
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
            marginTop: "0.25rem",
          }}
        >
          🪄 Back to TOC
        </button>
      </div>
    </div>
  );
};

export default DetailWranglerStyle;