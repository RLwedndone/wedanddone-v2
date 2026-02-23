import React from "react";

interface RubiIntroProps {
  onContinue: () => void;
  onClose?: () => void;
}

const RubiIntro: React.FC<RubiIntroProps> = ({ onContinue, onClose }) => {
  const venueName = "Rubi House";

  return (
    <div className="pixie-card wd-page-turn">
      {/* 🩷 Pink X Close */}
      {onClose && (
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
            alt="Close"
          />
        </button>
      )}

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <img
          src={`${import.meta.env.BASE_URL}assets/images/yumyumtitle.png`}
          alt="Yum Yum Title"
          className="px-media"
          style={{ width: 225, maxWidth: "80%", margin: "0 auto 12px" }}
        />

        <video
          src={`${import.meta.env.BASE_URL}assets/videos/yum_intro_loop2.mp4`}
          autoPlay
          muted
          playsInline
          loop
          className="px-media"
          style={{
            width: 312,
            maxWidth: "95%",
            borderRadius: 12,
            margin: "0 auto 24px",
            display: "block",
          }}
        />

        <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
          Welcome to {venueName} Catering
        </h2>

        <div
          className="px-prose-narrow"
          style={{ margin: "0 auto 18px", maxWidth: 520 }}
        >
          <p>
            ✨ Welcome to your <strong>{venueName} catering journey!</strong>
          </p>

          <p>
            First, you’ll choose a <strong>restaurant menu</strong> — pick from
            our two delectable options.
          </p>

          <p>
            Then you’ll build your celebration by selecting courses and dishes
            within that restaurant concept.
          </p>
        </div>

        {/* 💬 Founder Note (Karen) */}
        <div
          style={{
            margin: "1.25rem auto 1.5rem",
            maxWidth: 520,
            textAlign: "left",
            background: "rgba(240,246,255,0.85)",
            borderRadius: 16,
            padding: "14px 16px",
            boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
          }}
        >
          <h2
            style={{
              fontSize: "1.5rem",
              fontWeight: 900,
              color: "#2c62ba",
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/images/KFounder1x1.webp`}
              alt="Karen, co-founder of Wed&Done"
              style={{
                width: 60,
                height: 60,
                borderRadius: 10,
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
            Karen explains why this works
          </h2>

          <p
            style={{
              fontSize: "0.95rem",
              lineHeight: 1.45,
              color: "#333",
              margin: 0,
              fontStyle: "italic",
            }}
          >
            “Catering usually means inquiry forms, email threads, and menu
            revisions that somehow multiply overnight.
            <br />
            <br />
            We partnered directly with {venueName} to simplify it. You’re
            seeing their real restaurant concepts, real pricing, and exactly
            what’s included — plus desserts.
            <br />
            <br />
            Choose your concept, customize your courses, and book without the
            back-and-forth.”
          </p>
        </div>

        <div className="px-cta-col" style={{ marginTop: 8 }}>
          <button className="boutique-primary-btn" onClick={onContinue}>
            Start My Rubi House Menu
          </button>
        </div>
      </div>
    </div>
  );
};

export default RubiIntro;