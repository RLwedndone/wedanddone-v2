// src/components/photo/PhotoStyleResults.tsx
import React, { useEffect, useMemo, useState } from "react";

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

  // ✅ keep in sync if scores change (rare, but prevents weirdness)
  useEffect(() => {
    setSelectedStyle(recommendedStyle);
  }, [recommendedStyle]);

  // ⭐ Photographer trust slider (stable across renders)
  const PROS = useMemo(
    () => [
      {
        name: "Twin Lens Studios — Amanda Reeves",
        headshot: `${import.meta.env.BASE_URL}assets/images/photographers/AmandaHead.webp`,
        hero: `${import.meta.env.BASE_URL}assets/images/photographers/AmandaHero.webp`,
        quote:
          "“Nothing short of amazing — professional, easy to work with, and made everything feel natural.”",
      },
      {
        name: "Step On Me Photography — Steph Wahlig",
        headshot: `${import.meta.env.BASE_URL}assets/images/photographers/StepHead.webp`,
        hero: `${import.meta.env.BASE_URL}assets/images/photographers/StepHero.webp`,
        quote:
          "“We have nothing but amazing things to say about the Step On Me team. Extremely professional, timely, and responsive — and our photos were delivered so fast. The editing is stunning and the quality is unreal. We recommend them to everyone who wants gorgeous wedding photos.”",
      },
      {
        name: "Harley Bonham Photography — Harley Bonham",
        headshot: `${import.meta.env.BASE_URL}assets/images/photographers/harleyHead.webp`,
        hero: `${import.meta.env.BASE_URL}assets/images/photographers/HarleyHero.webp`,
        quote:
          "“Harley and his entire team were nothing short of amazing. They kept us on track with the timeline, captured everything on our shot list, and made it feel like we relived every moment of our day when we saw the full album and videos. Truly magic.”",
      },
      {
        name: "Lee Media — James Lee",
        headshot: `${import.meta.env.BASE_URL}assets/images/photographers/LeeHead.webp`,
        hero: `${import.meta.env.BASE_URL}assets/images/photographers/LeeHero.webp`,
        quote:
          "“Hiring Lee Media was one of the best decisions we made for our wedding. We loved having two photographers — it meant multiple angles and so many incredible moments captured. James and Amanda were amazing, and we’re so grateful to have these photos of such a sacred, special day.”",
      },
    ],
    []
  );

  const [proIndex, setProIndex] = useState(0);
  const [pausePros, setPausePros] = useState(false);

  // ✅ auto-rotate (won’t churn because PROS is memoized)
  useEffect(() => {
    if (pausePros) return;
    if (PROS.length <= 1) return;

    const t = window.setInterval(() => {
      setProIndex((i) => (i + 1) % PROS.length);
    }, 4500);

    return () => window.clearInterval(t);
  }, [pausePros, PROS.length]);

  // ✅ if user taps (mobile), pause briefly then resume (prevents “stuck paused”)
  useEffect(() => {
    if (!pausePros) return;
    const t = window.setTimeout(() => setPausePros(false), 6000);
    return () => window.clearTimeout(t);
  }, [pausePros]);

  return (
    <div
      className="pixie-card wd-page-turn"
      style={{
        width: "min(92vw, 560px)",
        marginInline: "auto",
        boxSizing: "border-box",
      }}
    >
      {/* Pink X closes entire Photo Styler */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div
        className="pixie-card__body px-center"
        style={{ paddingInline: 16, boxSizing: "border-box" }}
      >
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
            <p className="px-prose-narrow" style={{ marginBottom: 10 }}>
              Based on your swipes, you’re leaning toward:
            </p>

            <div
              style={{
                fontFamily: "'Jenna Sue', cursive",
                fontSize: "2.2rem",
                marginBottom: 8,
              }}
            >
              {recommendedStyle}
            </div>

            <p className="px-prose-narrow" style={{ fontSize: ".9rem", marginBottom: 14 }}>
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

            <div
              style={{
                marginTop: 10,
                paddingTop: 14,
                borderTop: "1px dashed #d8d8e6",
                maxWidth: 460,
                marginInline: "auto",
              }}
            >
              {/* ⭐ Trust slider */}
              <div
                onMouseEnter={() => setPausePros(true)}
                onMouseLeave={() => setPausePros(false)}
                onTouchStart={() => setPausePros(true)}
                style={{
                  margin: "6px auto 14px",
                  maxWidth: 420,
                  background: "rgba(255,255,255,0.86)",
                  borderRadius: 16,
                  padding: "12px 12px 10px",
                  boxShadow: "0 10px 22px rgba(0,0,0,0.10)",
                  border: "1px solid rgba(44,98,186,0.14)",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    fontWeight: 900,
                    color: "#2c62ba",
                    marginBottom: 10,
                    textAlign: "center",
                    fontSize: "1.1rem",
                  }}
                >
                  Meet our photo pros! ✨
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {/* Back */}
                  <button
                    type="button"
                    aria-label="Previous photographer"
                    onClick={() => {
                      setPausePros(true);
                      setProIndex((i) => (i - 1 + PROS.length) % PROS.length);
                    }}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      border: "1px solid rgba(0,0,0,0.12)",
                      background: "rgba(255,255,255,0.9)",
                      cursor: "pointer",
                      fontWeight: 900,
                      lineHeight: "34px",
                      flexShrink: 0,
                    }}
                  >
                    ←
                  </button>

                  {/* Card */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Header row */}
                    <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
                      <img
                        src={PROS[proIndex].headshot}
                        alt={`${PROS[proIndex].name} headshot`}
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 12, // ✅ square-ish avatar feels more “brand card”
                          objectFit: "cover",
                          border: "2px solid rgba(44,98,186,0.20)",
                          flexShrink: 0,
                        }}
                      />

                      {/* ✅ name wraps to 2 lines */}
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 900,
                            color: "#222",
                            fontSize: "1.05rem",
                            lineHeight: 1.15,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                          }}
                        >
                          {PROS[proIndex].name}
                        </div>
                      </div>

                      {/* Stars */}
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div
                          style={{
                            letterSpacing: 1,
                            fontSize: "0.95rem",
                            color: "#f5b301",
                            textShadow: "0 1px 1px rgba(0,0,0,0.15)",
                          }}
                        >
                          ★★★★★
                        </div>
                        <div style={{ fontSize: "0.74rem", color: "#666", fontWeight: 800 }}>5.0</div>
                      </div>
                    </div>

                    {/* Hero image — square */}
                    <div
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        borderRadius: 14,
                        overflow: "hidden",
                        background: "#f3f4f6",
                        marginBottom: 10,
                        border: "1px solid rgba(0,0,0,0.08)",
                      }}
                    >
                      <img
                        src={PROS[proIndex].hero}
                        alt={`${PROS[proIndex].name} sample work`}
                        loading="lazy"
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    </div>

                    <div style={{ fontSize: "0.92rem", color: "#333", fontStyle: "italic", lineHeight: 1.35 }}>
                      {PROS[proIndex].quote}
                    </div>

                    {/* Dots */}
                    <div style={{ display: "flex", justifyContent: "center", gap: 6, marginTop: 12 }}>
                      {PROS.map((_, idx) => (
                        <div
                          key={idx}
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 999,
                            opacity: idx === proIndex ? 1 : 0.25,
                            background: "#2c62ba",
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Next */}
                  <button
                    type="button"
                    aria-label="Next photographer"
                    onClick={() => {
                      setPausePros(true);
                      setProIndex((i) => (i + 1) % PROS.length);
                    }}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 999,
                      border: "1px solid rgba(0,0,0,0.12)",
                      background: "rgba(255,255,255,0.9)",
                      cursor: "pointer",
                      fontWeight: 900,
                      lineHeight: "34px",
                      flexShrink: 0,
                    }}
                  >
                    →
                  </button>
                </div>
              </div>

              <div
                className="px-cta-col"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  marginBottom: 16,
                }}
              >
                <button className="boutique-primary-btn px-btn-200" onClick={() => onBookPhotographer(selectedStyle)}>
                  Book My Photographer
                </button>

                <button type="button" className="boutique-back-btn" onClick={onSwipeAgain}>
                  🔁 Retake the Quiz
                </button>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="px-prose-narrow" style={{ marginBottom: 10 }}>
              Didn’t fall in love with <em>any</em> of the photos?
            </p>
            <p className="px-prose-narrow" style={{ marginBottom: 16, fontSize: ".9rem" }}>
              Honestly, we respect the high standards. 💅 You can still choose a style below, or swipe again for a second
              look.
            </p>

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

              <p className="px-prose-narrow" style={{ fontSize: ".9rem", marginBottom: 10 }}>
                Pick the one that feels closest to your vision, or keep swiping until something makes you go “ohhh, that’s
                it.”
              </p>
            </div>

            <div
              className="px-cta-col"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                marginBottom: 16,
              }}
            >
              <button className="boutique-primary-btn px-btn-200" onClick={() => onBookPhotographer(selectedStyle)}>
                Book My Photographer
              </button>

              <button type="button" className="boutique-back-btn" onClick={onSwipeAgain}>
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