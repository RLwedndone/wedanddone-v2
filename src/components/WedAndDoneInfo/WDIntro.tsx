// src/components/WedAndDoneInfo/WDIntro.tsx
import React from "react";
import LazyVimeo from "../common/LazyVimeo";

interface WDIntroProps {
  onNext: (
    screen: "intro" | "ourstory" | "questions" | "weddingwisdom" | "partners" | "legal"
  ) => void;
}

const WDIntro: React.FC<WDIntroProps> = ({ onNext }) => {
  return (
    <div style={{ textAlign: "center" }}>
      {/* Logo */}
      <img
        src={`${import.meta.env.BASE_URL}assets/images/WD_Gold_3D_Logo.png`}
        alt="Wed&Done Logo"
        style={{
          width: "100%",
          maxWidth: "300px",
          margin: "0 auto 1.5rem",
          display: "block",
        }}
      />

      {/* Vimeo Video */}
      <div style={{ marginBottom: "1.5rem" }}>
        <LazyVimeo
          videoId="1106994127"
          title="Wed&Done Intro Video"
          thumbnail={`${import.meta.env.BASE_URL}assets/images/VideoThumbnails/WDintroThumb.jpg`}
        />
      </div>

      {/* Explainer Text */}
      <p
        style={{
          fontSize: "1rem",
          lineHeight: "1.6",
          marginBottom: "1.5rem",
          padding: "1.5rem 2rem",
        }}
      >
  Welcome to <strong>Wed&Done!</strong>
  <br />
  <br />

  <strong>The easiest way to book your wedding without the chaos.</strong>
  <br />
  <br />

  We built this world for couples who want to skip endless vendor stalking and actually get things booked. No ghosted emails. No confusing proposals. Here, you can book real wedding venues and vendors directly, with clear pricing and guided steps that make sense.
  <br />
  <br />

  Whether you’re booking one vendor or your entire wedding experience, Wed&Done brings everything together in one Pixie-powered system — so you can book confidently and move on.
  <br />
  <br />

  Get Wed… and poof! You’re <strong>Done.</strong> ✨
</p>

      {/* Navigation Buttons */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          maxWidth: "300px",
          margin: "1.5rem auto 0",
        }}
      >
        <button onClick={() => onNext("ourstory")} style={navButtonStyle}>
          Our Story
        </button>

        <button onClick={() => onNext("questions")} style={navButtonStyle}>
          Q&amp;A
        </button>

        {/* ⭐ NEW: Wedding Wisdom link */}
        <button onClick={() => onNext("weddingwisdom")} style={navButtonStyle}>
          Wedding Wisdom
        </button>

        <button onClick={() => onNext("partners")} style={navButtonStyle}>
          Our Fab Partners
        </button>

        {/* New Legal Stuff button */}
        <button onClick={() => onNext("legal")} style={navButtonStyle}>
          Legal Stuff
        </button>
      </div>
    </div>
  );
};

const navButtonStyle: React.CSSProperties = {
  padding: "0.75rem 1.5rem",
  fontSize: "1.1rem",
  borderRadius: "8px",
  backgroundColor: "#2c62ba",
  color: "#fff",
  border: "none",
  cursor: "pointer",
};

export default WDIntro;