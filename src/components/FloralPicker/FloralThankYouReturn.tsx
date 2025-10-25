import React from "react";

interface Props { onClose: () => void; onAddMore: () => void; }

const FloralThankYouReturn: React.FC<Props> = ({ onClose, onAddMore }) => {
  return (
    <div
      className="pixie-card"
      style={{
        ["--pixie-card-w" as any]: "680px",
        ["--pixie-card-min-h" as any]: "420px",
      }}
    >
      {/* 🩷 Pink X Close */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div
        className="pixie-card__body"
        style={{
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "14px",
        }}
      >
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/unicorn_cart.mp4`}
          autoPlay
          loop
          muted
          playsInline
          className="px-media"
          style={{ maxWidth: 240, margin: "10px auto 4px" }}
        />
        <h3
          className="px-title"
          style={{
            marginBottom: 4,
            color: "#2c62ba",
            fontFamily: "'Jenna Sue', cursive",
          }}
        >
          Hey there! 🌸
        </h3>
        <p
          className="px-prose-narrow"
          style={{
            margin: "0 auto 14px",
            maxWidth: "420px",
          }}
        >
          Need to pick some more posies? Click below to head over to the Floral Picker upgrade cart.
        </p>
        <button
          className="boutique-primary-btn"
          onClick={onAddMore}
          style={{
            marginTop: "10px",
            width: "200px",
            alignSelf: "center",
          }}
        >
          Add Florals
        </button>
      </div>
    </div>
  );
};

export default FloralThankYouReturn;