// src/components/NewYumBuild/CustomVenues/VicandVerrado/VicVerradoIntro.tsx
import React from "react";

interface VicVerradoIntroProps {
  venueName: "The Vic" | "The Verrado";
  onContinue: () => void;
  onClose?: () => void;
}

const VicVerradoIntro: React.FC<VicVerradoIntroProps> = ({
  venueName,
  onContinue,
}) => {
  return (
    <>
      <img
        src="/assets/images/yumyumtitle.png"
        alt="Yum Yum Title"
        style={{
          width: "100%",
          maxWidth: "225px",
          margin: "0 auto 1rem",
          display: "block",
        }}
      />

      <video
        src="/assets/videos/yum_intro_loop2.mp4"
        autoPlay
        muted
        playsInline
        loop
        style={{
          width: "100%",
          maxWidth: "312px",
          height: "auto",
          borderRadius: "12px",
          margin: "0 auto 2.5rem",
          display: "block",
        }}
      />

      <div
        style={{
          maxWidth: "500px",
          margin: "2rem auto",
          textAlign: "center",
          padding: "0 1.5rem",
          fontFamily: "'Nunito', sans-serif",
        }}
      >
        <p>
          ✨ Welcome to {" "}
          <strong>{venueName} catering journey!</strong>
        </p>

        <p>
          You’ll begin by exploring four enchanting menu tiers —{" "}
          <strong>The Sunflower, The Rose, The Lily, and The Dahlia</strong>.
        </p>

        <p>
          Once you’ve chosen your tier, you’ll move on to select your
          hors d'oeuvres, crisp salads, and elegant entrées.
        </p>

        <p>
          🌟 Your selections will also count toward the{" "}
          <strong>food &amp; beverage minimum</strong> required at{" "}
          {venueName}. (unless you booked a day where the minimum is waived)
        </p>

        <p>
          🍷 A quick note of practicality:{" "}
          <strong>all alcohol and bar packages are booked directly with{" "}
          {venueName}</strong>, in accordance with Arizona state liquor laws.
        </p>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          marginTop: "2rem",
        }}
      >
        <button
          className="boutique-primary-btn"
          style={{
            width: "250px",
            padding: "0.75rem 1rem",
            fontSize: "1rem",
            borderRadius: "12px",
          }}
          onClick={onContinue}
        >
          Make My Menu ✨
        </button>
      </div>
    </>
  );
};

export default VicVerradoIntro;