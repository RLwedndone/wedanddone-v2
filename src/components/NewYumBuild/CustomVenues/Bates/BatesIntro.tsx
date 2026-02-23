// src/components/NewYumBuild/CustomVenues/Bates/BatesIntro.tsx
import React from "react";

interface BatesIntroProps {
  onContinue: () => void;
  onClose?: () => void;
}

const BatesIntro: React.FC<BatesIntroProps> = ({ onContinue, onClose }) => {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        boxSizing: "border-box",
      }}
    >
      <div
        className="pixie-card pixie-card--modal"
        style={{ maxWidth: 680, position: "relative" }}
      >
        {/* 🩷 Pink X Close */}
        {onClose && (
          <button
            className="pixie-card__close"
            onClick={onClose}
            aria-label="Close"
          >
            <img
              src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
              alt="Close"
            />
          </button>
        )}

        <div
          className="pixie-card__body"
          style={{
            textAlign: "center",
            padding: "2rem 2.5rem",
          }}
        >
          {/* Title */}
          <img
            src={`${import.meta.env.BASE_URL}assets/images/yumyumtitle.png`}
            alt="Yum Yum Title"
            className="px-media"
            style={{
              width: 225,
              maxWidth: "80%",
              margin: "0 auto 12px",
            }}
          />

          {/* Video */}
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
            Welcome to Bates Catering
          </h2>

          <div
            className="px-prose-narrow"
            style={{ margin: "0 auto 18px", maxWidth: 520 }}
          >
            <p>
              ✨ Welcome to your <strong>Bates Mansion catering journey!</strong>
            </p>

            <p>
              Over the next few steps, you’ll choose your butler-passed hors
              d'oeuvres, salad, and entrees to create a beautiful, cohesive
              menu for your celebration. Your Bates catering package is already
              included in your booking—this is where you’ll finalize the details.
            </p>

            <p>
              You’ll also see a few optional add-ons available at an additional
              charge. Everything else is included with your Bates Mansion booking.
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
              We partnered directly with Bates Mansion to make this simple.
              You’re seeing their real menu, real pricing, and exactly what’s
              included — plus desserts.
              <br />
              <br />
              Customize what you need, see the numbers clearly, and book
              without the chaos.”
            </p>
          </div>

          {/* CTA */}
          <div className="px-cta-col" style={{ marginTop: 8 }}>
            <button className="boutique-primary-btn" onClick={onContinue}>
              Build My Bates Feast
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatesIntro;