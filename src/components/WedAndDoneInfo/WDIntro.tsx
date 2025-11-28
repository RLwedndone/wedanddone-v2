import React from "react";
import LazyVimeo from "../common/LazyVimeo";

interface WDIntroProps {
  onNext: (screen: "intro" | "ourstory" | "questions" | "partners") => void;
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
    thumbnailSrc={`${import.meta.env.BASE_URL}assets/images/VideoThumbnails/WDintroThumb.jpg`}
    alt="Wed&Done Intro Video"
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
        Welcome to <strong>Wed&Done</strong> —
        <br />
        your shortcut to a magical wedding without the stress.
        <br />
        <br />
        We built this world for couples who want wedding planning to feel
        fun, not frantic. No endless vendor stalking. No ghosted emails.
        No confusing proposals. Just curated pros, dreamy venues, and a
        Pixie-powered planning system that actually works.
        <br />
        <br />
        Whether you're booking a full package or picking just one piece,
        we're here to help you get Wed… and poof! You’re DONE.
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
          Q&A
        </button>
        <button onClick={() => onNext("partners")} style={navButtonStyle}>
          Our Fab Partners
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