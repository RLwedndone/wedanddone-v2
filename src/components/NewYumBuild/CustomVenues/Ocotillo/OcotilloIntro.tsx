// src/components/NewYumBuild/CustomVenues/Ocotillo/OcotilloIntro.tsx
import React from "react";

interface OcotilloIntroProps {
  onContinue: () => void;
  onClose?: () => void;
}

const OcotilloIntro: React.FC<OcotilloIntroProps> = ({ onContinue }) => {
  const venueName = "Ocotillo";

  return (
    <>
      <img
        src={`${import.meta.env.BASE_URL}assets/images/yumyumtitle.png`}
        alt="Yum Yum Title"
        style={{
          width: "100%",
          maxWidth: "225px",
          margin: "0 auto 1rem",
          display: "block",
        }}
      />

      <video
        src={`${import.meta.env.BASE_URL}assets/videos/yum_intro_loop2.mp4`}
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
          ✨ Welcome to{" "}
          <strong>{venueName} Yum Yum Menu!</strong>
        </p>

        <p>
  You’re about to step into <strong>Ocotillo’s culinary wonderland</strong> —
  a full four-course celebration with{" "}
  <strong>stationed appetizers, crisp salads, savory entrées, and dreamy desserts</strong>.
</p>

<p>
  First, choose your buffet tier to set the tone for your feast.
  Then the fun begins — you’ll hand-pick your favorite bites!
</p>

<p>
  🌟 Each delicious decision also works its magic toward your{" "}
  <strong>food &amp; beverage minimum</strong> at {venueName}.
</p>

<p>
  🍷 And one tiny grown-up note from Madge:{" "}
  <strong>
    all alcohol and bar packages are booked directly with {venueName}
  </strong>{" "}
  — Arizona’s liquor laws insist, darling!
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

export default OcotilloIntro;