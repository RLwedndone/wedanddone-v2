// src/components/photo/PhotoStyleResults.tsx
import React from "react";

type Props = {
  airyScore: number;
  trueToLifeScore: number;
  onSwipeAgain: () => void;
  onBookPhotographer: (finalStyle: string) => void;
  onClose: () => void; // ✅ added
};

const PhotoStyleResults: React.FC<Props> = ({
  airyScore,
  trueToLifeScore,
  onSwipeAgain,
  onBookPhotographer,
  onClose,
}) => {
  const isLightAiry = airyScore > trueToLifeScore;
  const finalStyle = isLightAiry ? "Light & Airy" : "True to Life";

  return (
    <div className="pixie-card">
      {/* Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        {/* Header */}
        <h2 className="px-title" style={{ marginBottom: 10 }}>
          Your perfect photo style is…
        </h2>

        {/* Dragon animation */}
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/dragon_love.mp4`}
          autoPlay
          loop
          muted
          playsInline
          className="px-media"
          style={{ maxWidth: 260, margin: "10px auto 12px" }}
        />

        {/* Result name */}
        <h3 className="px-title" style={{ marginTop: 6, marginBottom: 8 }}>
          {finalStyle}
        </h3>

        {/* Description */}
        <p className="px-prose-narrow" style={{ marginBottom: 18 }}>
          {isLightAiry ? (
            <>
              <em>Dreamy, delicate, and drenched in light.</em> <br />
              Soft, pastel tones with creamy skin and gentle contrast—like a scene
              from <strong>Pride & Prejudice</strong>.
            </>
          ) : (
            <>
              <em>Bold, emotional, and full of color.</em> <br />
              Rich contrast and saturated tones—more like a still from{" "}
              <strong>The Notebook</strong>, true to how the day felt.
            </>
          )}
        </p>

        {/* CTAs (standard sizes) */}
        <div className="px-cta-col">
          <button
            className="boutique-primary-btn px-btn-200"
            onClick={() => onBookPhotographer(finalStyle)}
          >
            Book My Photographer
          </button>
          <button
            className="boutique-back-btn px-btn-200"
            onClick={onSwipeAgain}
          >
            Swipe Again
          </button>
        </div>
      </div>
    </div>
  );
};

export default PhotoStyleResults;