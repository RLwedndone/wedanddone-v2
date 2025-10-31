import React, { useEffect } from "react";

interface Props {
  onClose: () => void;
}

const OcotilloDessertThankYou: React.FC<Props> = ({ onClose }) => {
  useEffect(() => {
    // Optional sparkle sound (if file exists)
    const sound = new Audio(`${import.meta.env.BASE_URL}assets/sounds/sparkle.mp3`);
    sound.play().catch(() => {});
  }, []);

  return (
    <div className="pixie-overlay">
      <div
        className="pixie-card"
        style={{
          maxWidth: 720,
          textAlign: "center",
          position: "relative",
        }}
      >
        {/* Pink X close */}
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

        <video
          src={`${import.meta.env.BASE_URL}assets/videos/yum_thanks.mp4`}
          autoPlay
          loop
          muted
          playsInline
          style={{
            width: 180,
            margin: "0 auto 1.5rem",
            borderRadius: 12,
            display: "block",
          }}
        />

        <h2
          style={{
            fontFamily: "'Jenna Sue', cursive",
            fontSize: "2.25rem",
            color: "#2c62ba",
            marginBottom: 10,
          }}
        >
          Sweet Success!
        </h2>

        <p className="px-prose-narrow" style={{ marginBottom: 20 }}>
          Your Ocotillo dessert package is officially booked and added to your wedding plan. 🍰✨
          We’ll notify the catering team so they can coordinate with your menu.
        </p>

        <button
          className="boutique-primary-btn"
          style={{ width: 260 }}
          onClick={onClose}
        >
          Return to Dashboard
        </button>
      </div>
    </div>
  );
};

export default OcotilloDessertThankYou;