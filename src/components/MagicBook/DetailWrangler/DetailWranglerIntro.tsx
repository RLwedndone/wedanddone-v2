// src/components/MagicBook/DetailWrangler/DetailWranglerIntro.tsx
import React from "react";

interface DetailWranglerIntroProps {
  onNext: () => void;
  goToTOC: () => void; // provided by overlay
}

const DetailWranglerIntro: React.FC<DetailWranglerIntroProps> = ({
  onNext,
  goToTOC,
}) => {
  return (
    <div
      className="pixie-card"
      style={{
        maxWidth: "600px",
        margin: "0 auto",
        textAlign: "center",
        padding: "2rem 1.5rem",
      }}
    >
      {/* Pink X – go back to TOC */}
      <button
        className="pixie-card__close"
        onClick={goToTOC}
        aria-label="Close"
      >
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      {/* Treasure Chest Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        style={{
          width: "75%",
          borderRadius: "16px",
          marginBottom: "1.5rem",
          display: "block",
          marginLeft: "auto",
          marginRight: "auto",
          WebkitMaskImage: `
            linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%),
            linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)
          `,
          maskImage: `
            linear-gradient(to right, transparent 0%, black 10%, black 90%, transparent 100%),
            linear-gradient(to bottom, transparent 0%, black 10%, black 90%, transparent 100%)
          `,
          WebkitMaskComposite: "intersect",
          maskComposite: "intersect",
          WebkitMaskRepeat: "no-repeat",
          maskRepeat: "no-repeat",
          WebkitMaskSize: "100% 100%",
          maskSize: "100% 100%",
          backgroundColor: "#fff",
        }}
      >
        <source
          src={`${import.meta.env.BASE_URL}assets/videos/Magic_Book/detail_intro.mp4`}
          type="video/mp4"
        />
      </video>

      <h2
        className="boutique-title"
        style={{
          color: "#2c62ba",
          fontSize: "2rem",
          fontWeight: "bold",
          marginBottom: "1.5rem",
        }}
      >
        You've Unlocked the Detail Wrangler!
      </h2>

      <p
        style={{
          fontSize: "1rem",
          lineHeight: "1.6",
          marginBottom: "2rem",
        }}
      >
        <strong>You've unlocked the secret to stress-free wedding planning!</strong>
        <br />
        <br />
        Because you booked through Wed&Done, our magical planning Pixies are now
        at your service.
        <br />
        <br />
        This special chapter — the <em>Detail Wrangler</em> — is packed with wisdom
        from seasoned wedding pros. Inside, you’ll find:
        <br />
        • Budgeting shortcuts
        <br />
        • Style-setting inspo
        <br />
        • Ceremony + RSVP timing
        <br />
        • Seating sorcery
        <br />
        • And more ✨
        <br />
        <br />
        Think of this like a cheat code for wedding planning. You’re not doing
        this alone anymore.
        <br />
        <br />
        <em>Ready to see what our Pixies have prepared?</em>
      </p>

      {/* ✨ CTA + Back-to-TOC */}
      <div
        style={{
          padding: "1rem",
          textAlign: "center",
          position: "relative",
          zIndex: 3,
        }}
      >
        <button
          onClick={onNext}
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
        <br />
        <button
          onClick={goToTOC}
          className="boutique-back-btn"
          style={{
            width: 180,
            padding: "0.75rem 1rem",
            marginTop: "1rem",
            fontSize: "1.1rem",
            fontWeight: 600,
          }}
        >
          🪄 Back to TOC
        </button>
      </div>
    </div>
  );
};

export default DetailWranglerIntro;