// src/components/WedAndDoneInfo/WDIntro.tsx
import React from "react";
import { useNavigate } from "react-router-dom";

interface WDIntroProps {
  onNext: (screen: "intro" | "ourstory" | "questions" | "partners") => void;
}

const WDIntro: React.FC<WDIntroProps> = ({ onNext }) => {
  const navigate = useNavigate();

  return (
    <div className="pixie-overlay">
      <div className="pixie-card">
        {/* ✖ Close Button */}
        <button
          onClick={() => navigate("/dashboard")}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            background: "none",
            border: "none",
            fontSize: "1.5rem",
            cursor: "pointer",
          }}
        >
          ✖
        </button>

        {/* Logo Image */}
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

        {/* 🎥 Embedded Vimeo Video */}
        <div style={{ marginBottom: "1.5rem" }}>
          <iframe
            src="https://player.vimeo.com/video/1106994127"
            width="100%"
            height="250"
            frameBorder="0"
            allow="autoplay; fullscreen"
            allowFullScreen
            style={{ borderRadius: "12px" }}
          ></iframe>
        </div>

        {/* Explainer Text */}
        <div style={{ textAlign: "center" }}>
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
            fun, not frantic. No endless vendor stalking. No ghosted emails. No
            confusing proposals and quotes. Just dreamy venues, curated pros,
            and a Pixie-powered planning system that actually works.
            <br />
            <br />
            Whether you're booking a full package or picking just one piece,
            we're here to help you get Wed... and poof! You're DONE.
            <br />
            <br />
          </p>

          {/* Navigation Buttons */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
              marginTop: "1.5rem",
              maxWidth: "300px",
              marginLeft: "auto",
              marginRight: "auto",
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