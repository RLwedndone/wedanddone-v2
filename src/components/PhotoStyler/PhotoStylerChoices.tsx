import React, { useState, useEffect, useCallback } from "react";
import { useSwipeable } from "react-swipeable";
import { photoStyleImages } from "./photoStyleData";

interface PhotoStylerChoicesProps {
  onContinue: (results: { airy: number; trueToLife: number }) => void;
  onBack: () => void;
  onClose: () => void;
}

const PhotoStylerChoices: React.FC<PhotoStylerChoicesProps> = ({
  onContinue,
  onBack,
  onClose,
  
}) => {
  const [index, setIndex] = useState(0);
  const [airyCount, setAiryCount] = useState(0);
  const [trueToLifeCount, setTrueToLifeCount] = useState(0);
  const [history, setHistory] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const finishIfDone = useCallback(() => {
    if (index >= photoStyleImages.length - 1) {
      onContinue({ airy: airyCount, trueToLife: trueToLifeCount });
      return true;
    }
    return false;
  }, [index, airyCount, trueToLifeCount, onContinue]);

  const handleSwipe = (dir: "left" | "right") => {
    const current = photoStyleImages[index];
    if (dir === "right") {
      if (current.style === "airy") setAiryCount((p) => p + 1);
      if (current.style === "trueToLife") setTrueToLifeCount((p) => p + 1);
      setHistory((p) => [...p, current.style]);
    } else {
      setHistory((p) => [...p, "none"]);
    }

    if (!finishIfDone()) setIndex((i) => i + 1);
  };

  const handleBackSwipe = () => {
    if (index === 0) {
      onBack();
      return;
    }
    const prevStyle = history[history.length - 1];
    if (prevStyle === "airy") setAiryCount((p) => p - 1);
    if (prevStyle === "trueToLife") setTrueToLifeCount((p) => p - 1);
    setHistory((p) => p.slice(0, -1));
    setIndex((i) => i - 1);
  };

  const handlers = useSwipeable({
    onSwipedLeft: () => handleSwipe("left"),
    onSwipedRight: () => handleSwipe("right"),
    preventScrollOnSwipe: true,
    trackTouch: true,
    trackMouse: false,
  });

  const currentImage = photoStyleImages[index];

  return (
    <div className="pixie-card">
      {/* Pink close X */}
      <button className="pixie-card__close" onClick={onBack} aria-label="Close">
        <img src="/assets/icons/pink_ex.png" alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2 className="px-title" style={{ marginBottom: 12 }}>
          Do you like the style of this photo?
        </h2>

        {/* ✨ Mobile swipe directions */}
        {isMobile && (
          <p
            className="px-prose-narrow"
            style={{
              marginTop: -6,
              marginBottom: 12,
              fontStyle: "italic",
              color: "#444",
            }}
          >
            Swipe 👉 right for photos you love, 👈 left for ones you aren’t feeling.
          </p>
        )}

        {/* 🖼️ Image (swipe target) */}
        <div {...(isMobile ? handlers : {})}>
          <img
            src={currentImage.url}
            alt="Style choice"
            className="px-media"
            style={{
              maxWidth: 600,
              maxHeight: "55vh",
              objectFit: "contain",
              borderRadius: 12,
              marginBottom: 16,
              userSelect: "none",
            }}
          />
        </div>

        {/* 💻 Desktop-only button stack */}
        {!isMobile && (
          <div className="px-cta-col" style={{ marginTop: 8 }}>
            <button
              onClick={() => handleSwipe("right")}
              className="boutique-primary-btn px-btn-200"
            >
              Love It 💙
            </button>

            <button
              onClick={() => handleSwipe("left")}
              className="px-btn-200"
              style={{
                background: "#e5e7eb",
                color: "#1f2a44",
                borderRadius: 12,
                fontWeight: 600,
                padding: "var(--pixie-btn-pad-y) var(--pixie-btn-pad-x)",
              }}
            >
              Not My Vibe
            </button>

            <button
              className="boutique-back-btn px-btn-200"
              onClick={handleBackSwipe}
            >
              ⬅ Back
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PhotoStylerChoices;