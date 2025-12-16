// src/components/photo/PhotoStyleResults.tsx
import React, { useState } from "react";

interface PhotoStyleResultsProps {
  airyScore: number;
  trueToLifeScore: number;
  onSwipeAgain: () => void;
  onBookPhotographer: (finalStyle: "Light & Airy" | "True to Life") => void;
  onClose: () => void;
}

const PhotoStyleResults: React.FC<PhotoStyleResultsProps> = ({
  airyScore,
  trueToLifeScore,
  onSwipeAgain,
  onBookPhotographer,
  onClose,
}) => {
  const recommendedStyle: "Light & Airy" | "True to Life" =
    airyScore > trueToLifeScore ? "Light & Airy" : "True to Life";

  const likedAny = airyScore > 0 || trueToLifeScore > 0;

  const [selectedStyle, setSelectedStyle] = useState<"Light & Airy" | "True to Life">(
    recommendedStyle
  );

  return (
    <div className="pixie-card wd-page-turn">
      {/* Pink X closes entire Photo Styler */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      <div className="pixie-card__body px-center">
        {/* 🐉 Dragon video */}
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/dragon_love.mp4`}
          autoPlay
          loop
          muted
          playsInline
          className="px-media"
          style={{ width: 160, marginBottom: 14, borderRadius: 12 }}
        />

        <h2 className="px-title-lg" style={{ marginBottom: 6 }}>
          Your Photo Style Match
        </h2>

        {likedAny ? (
          <>
            {/* “We think you’re…” flow */}
            <p className="px-prose-narrow" style={{ marginBottom: 10 }}>
              Based on your swipes, you’re leaning toward:
            </p>

            {/* Pretty Jenna Sue style result */}
            <div
              style={{
                fontFamily: "'Jenna Sue', cursive",
                fontSize: "2.2rem",
                marginBottom: 8,
              }}
            >
              {recommendedStyle}
            </div>

            <p
              className="px-prose-narrow"
              style={{ fontSize: ".9rem", marginBottom: 14 }}
            >
              Our magic mirror says this is your vibe… but you’re the final authority. Pick your style below!
            </p>

            {/* Manual style selector */}
            <div style={{ marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  justifyContent: "center",
                }}
              >
                <button
                  type="button"
                  className={
                    "px-toggle__btn" +
                    (selectedStyle === "Light & Airy"
                      ? " px-toggle__btn--blue px-toggle__btn--active"
                      : "")
                  }
                  style={{
                    minWidth: 150,
                    padding: "0.6rem 1rem",
                    fontSize: ".9rem",
                    borderRadius: 999,
                  }}
                  onClick={() => setSelectedStyle("Light & Airy")}
                >
                  Light & Airy
                </button>

                <button
                  type="button"
                  className={
                    "px-toggle__btn" +
                    (selectedStyle === "True to Life"
                      ? " px-toggle__btn--pink px-toggle__btn--active"
                      : "")
                  }
                  style={{
                    minWidth: 150,
                    padding: "0.6rem 1rem",
                    fontSize: ".9rem",
                    borderRadius: 999,
                  }}
                  onClick={() => setSelectedStyle("True to Life")}
                >
                  True to Life
                </button>
              </div>
            </div>

            {/* “Disagree with our styler?” explainer + final CTAs */}
            <div
              style={{
                marginTop: 10,
                paddingTop: 14,
                borderTop: "1px dashed #d8d8e6",
                maxWidth: 460,
                marginInline: "auto",
              }}
            >

              <div
                className="px-cta-col"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <button
                  className="boutique-primary-btn px-btn-200"
                  onClick={() => onBookPhotographer(selectedStyle)}
                >
                  Book My Photographer
                </button>

                <button
                  type="button"
                  className="boutique-back-btn"
                  onClick={onSwipeAgain}
                >
                  🔁 Retake the Quiz
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            {/* No likes at all flow */}
            <p className="px-prose-narrow" style={{ marginBottom: 10 }}>
              Didn’t fall in love with <em>any</em> of the photos?
            </p>
            <p
              className="px-prose-narrow"
              style={{ marginBottom: 16, fontSize: ".9rem" }}
            >
              Honestly, we respect the high standards. 💅  
              You can still choose a style below, or swipe again for a second look.
            </p>

            {/* Manual style selector */}
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  justifyContent: "center",
                  marginBottom: 8,
                }}
              >
                <button
                  type="button"
                  className={
                    "px-toggle__btn" +
                    (selectedStyle === "Light & Airy"
                      ? " px-toggle__btn--blue px-toggle__btn--active"
                      : "")
                  }
                  style={{
                    minWidth: 150,
                    padding: "0.6rem 1rem",
                    fontSize: ".9rem",
                    borderRadius: 999,
                  }}
                  onClick={() => setSelectedStyle("Light & Airy")}
                >
                  Light & Airy
                </button>

                <button
                  type="button"
                  className={
                    "px-toggle__btn" +
                    (selectedStyle === "True to Life"
                      ? " px-toggle__btn--pink px-toggle__btn--active"
                      : "")
                  }
                  style={{
                    minWidth: 150,
                    padding: "0.6rem 1rem",
                    fontSize: ".9rem",
                    borderRadius: 999,
                  }}
                  onClick={() => setSelectedStyle("True to Life")}
                >
                  True to Life
                </button>
              </div>

              <p
                className="px-prose-narrow"
                style={{ fontSize: ".9rem", marginBottom: 10 }}
              >
                Pick the one that feels closest to your vision, or keep swiping until
                something makes you go “ohhh, that’s it.”
              </p>
            </div>

            {/* Final CTAs */}
            <div
              className="px-cta-col"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <button
                className="boutique-primary-btn px-btn-200"
                onClick={() => onBookPhotographer(selectedStyle)}
              >
                Book My Photographer
              </button>

              <button
                type="button"
                className="boutique-back-btn"
                onClick={onSwipeAgain}
              >
                🔁 Swipe Again & Retake Quiz
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PhotoStyleResults;