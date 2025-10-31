import React, { useState } from "react";

interface WDQuestionsProps {
  onClose: () => void;
}

const CARD_WIDTH = 600;  // (still matches overlay card)
const CLOUD_WIDTH = 220;

const faqList = [
  {
    q: "What “big ticket” items are NOT included in my Wed&Done wedding?",
    a: "We can’t handle your bar tab — state liquor laws mean alcohol purchases have to be handled directly by you (or your venue). If your venue includes a bar as part of its food & beverage minimum, we’ll note the details in your contract."
  },
  {
    q: "When should I book my Wed&Done vendors?",
    a: "Venues in Arizona often book 14–18 months in advance, so sooner is better if you have your eye on a specific spot. Other vendors can be booked closer to your date, but we always recommend locking in the biggies early."
  },
  {
    q: "What if I already have a venue booked?",
    a: "If you’ve already booked one of our partner venues, let us know and we’ll update the system so everything magically adjusts for you. If your venue is not a partner, check whether they allow outside vendors — if they do, you can still shop our boutique for everything else you need."
  },
  {
    q: "What if I already have a photographer, DJ, baker, or florist?",
    a: "Totally fine! Wed&Done is built so you can book only what you need. You can still use our boutique for everything else, or we can fill in just the gaps."
  },
  {
    q: "Will I be choosing from a huge list of every vendor?",
    a: "Nope — one of the best parts of Wed&Done is that we’ve done the vetting for you. Each boutique has a small, curated set of all-pro vendors with room for upgrades or custom requests if you want something extra."
  },
  {
    q: "I’m not seeing hair & makeup — what’s the deal?",
    a: "Bridal beauty isn’t a built-in boutique yet. It’s deeply personal (and some of our couples are pros themselves!). But our Pixie Planners have fantastic recommendations — just ask and we’ll share our favorites."
  },
  {
    q: "When should I complete each boutique?",
    a: "Book your venue and photographer first — those are the vendors that book up fastest. In Arizona, venues are often reserved 14–18 months out, so don’t wait if you have your heart set on a specific date. Catering, music, florals, and desserts can be done later, but don’t leave them until the last minute — venues usually need final counts 30 days before your wedding."
  }
];

const CLOUD_IMAGES = [
  `${import.meta.env.BASE_URL}assets/images/cloud1.png`,
  `${import.meta.env.BASE_URL}assets/images/cloud2.png`,
  `${import.meta.env.BASE_URL}assets/images/cloud3.png`,
  `${import.meta.env.BASE_URL}assets/images/cloud4.png`,
];

const SKY_BG = `${import.meta.env.BASE_URL}assets/images/assets/images/Starry_Night.png`;

const WDQuestions: React.FC<WDQuestionsProps> = ({ onClose }) => {
  const [active, setActive] = useState<{ q: string; a: string } | null>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth <= 600;

  // make the bubble and inner card taller so we don't need scrolling
const bubble = isMobile
? { width: 380, height: 620, cardTop: 190, cardBottom: 72, side: 24, close: 10 }
: { width: 600, height: 780, cardTop: 270, cardBottom: 120, side: 40, close: 12 };

return (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      minHeight: "100%",
      backgroundImage: `url(${SKY_BG})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    }}
  >
    {/* Header */}
      <div style={{ padding: "1.25rem 1.25rem 0.5rem 1.25rem" }}>
        <h2
          style={{
            textAlign: "center",
            fontSize: "2.5rem",
            margin: 0,
            color: "#fff",
            textShadow: "0 1px 3px rgba(0,0,0,0.5)",
          }}
        >
          Questions? We’ve Got Answers . . .
        </h2>
        <p
          style={{
            fontSize: "1.20rem",
            lineHeight: 1.5,
            textAlign: "center",
            margin: "0.5rem 0 1rem",
            color: "#f6f6f6",
            textShadow: "0 1px 2px rgba(0,0,0,0.4)",
          }}
        >
          Tap a cloud to see Madge’s answer.
        </p>
      </div>

      {/* Cloud column */}
      <div
        style={{
          padding: "1.5rem",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "2.5rem",
        }}
      >
        {faqList.map((item, i) => (
          <button
            key={i}
            onClick={() => setActive(item)}
            style={{
              position: "relative",
              width: "380px",
              maxWidth: "95%",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "0.75rem",
            }}
          >
            <img
              src={CLOUD_IMAGES[i % CLOUD_IMAGES.length]}
              alt=""
              aria-hidden="true"
              style={{
                width: "100%",
                height: "auto",
                display: "block",
                filter: "drop-shadow(0 4px 10px rgba(0,0,0,0.15))",
                animation: `floatAnim ${3 + (i % 3)}s ease-in-out infinite`,
                transition: "transform 0.2s ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
              onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
            />

            {/* Wrapped, glowing question text */}
            <span
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                pointerEvents: "none",
              }}
            >
              <span
                style={{
                  maxWidth: "68%",
                  textAlign: "center",
                  lineHeight: 1.18,
                  fontWeight: 800,
                  fontSize: "clamp(1rem, 2.4vw, 1.35rem)",
                  letterSpacing: "0.2px",
                  color: "#fff",
                  textShadow:
                    "0 0 6px rgba(20,40,90,0.6), 0 0 12px rgba(20,40,90,0.45), 0 1px 2px rgba(20,40,90,0.5)",
                  whiteSpace: "normal",
                  overflowWrap: "normal",
                  wordBreak: "keep-all",
                  padding: "0 .15rem",
                }}
              >
                {item.q}
              </span>
            </span>
          </button>
        ))}
      </div>

      {/* =========================
          Madge Bubble Answer Modal
          (fixed overlay, centered)
      ========================== */}
      {active && (
  <>
    {/* Dark backdrop */}
    <div
      onClick={() => setActive(null)}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 2000,
      }}
    />

    {/* Bubble container */}
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: bubble.width,
        height: bubble.height,            // ⬅️ taller bubble
        backgroundImage: 'url(`${import.meta.env.BASE_URL}assets/images/madge_bubble.png`)',
        backgroundSize: "contain",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        zIndex: 2001,
        pointerEvents: "auto",
        overscrollBehavior: "contain",
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Close button */}
      <button
        onClick={() => setActive(null)}
        aria-label="Close answer"
        style={{
          position: "absolute",
          top: bubble.close,
          right: bubble.close,
          background: "none",
          border: "none",
          fontSize: isMobile ? "1.4rem" : "1.6rem",
          color: "#2c62ba",
          fontWeight: 800,
          cursor: "pointer",
        }}
      >
        ✕
      </button>

      {/* White answer card—now taller, no inner scrollbar */}
      <div
        style={{
          position: "absolute",
          top: bubble.cardTop,            // ⬅️ sits lower under Madge’s arms
          left: bubble.side,
          right: bubble.side,
          bottom: bubble.cardBottom,      // ⬅️ leaves space above the bubble tail
          background: "rgba(255,255,255,0.96)",
          borderRadius: 16,
          boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
          padding: isMobile ? "1rem 1.1rem" : "1.25rem 1.35rem",
          overflow: "visible",            // ⬅️ no scrolling inside the card
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
        }}
      >
        <div style={{ fontWeight: 800, marginBottom: 10, textAlign: "center", fontSize: isMobile ? "1.05rem" : "1.15rem" }}>
          {active.q}
        </div>
        <div style={{ lineHeight: 1.6, textAlign: "center", fontSize: isMobile ? "0.98rem" : "1.05rem" }}>
          {active.a}
        </div>
      </div>
    </div>
  </>
)}

      <style>{`
        @keyframes floatAnim {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
};

export default WDQuestions;