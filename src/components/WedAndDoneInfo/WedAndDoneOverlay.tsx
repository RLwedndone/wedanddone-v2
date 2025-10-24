import React, { useState } from "react";
import WDIntro from "./WDIntro";
import OurStory from "./OurStory";
import WDQuestions from "./WDQuestions";
import WDPartners from "./WDPartners";

type InfoScreen = "intro" | "ourstory" | "questions" | "partners";

interface WedAndDoneOverlayProps {
  onClose: () => void;
}

const WedAndDoneOverlay: React.FC<WedAndDoneOverlayProps> = ({ onClose }) => {
  const [screen, setScreen] = useState<InfoScreen>("intro");
  const handleNext = (nextScreen: InfoScreen) => setScreen(nextScreen);

  // ✅ we’ll style the card differently for the Q&A screen
  const isQuestions = screen === "questions";

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden", // ✅ only the card will scroll
      }}
    >
      <div
        style={{
          // ⭐ starry background only on the Questions screen
          background: isQuestions ? "transparent" : "#fff",
          backgroundImage: isQuestions ? 'url("/assets/images/Starry_Night.png")' : undefined,
          backgroundRepeat: isQuestions ? "repeat-y" : undefined,
          backgroundSize: isQuestions ? "100% auto" : undefined, // fill width, keep tile ratio
          backgroundPosition: isQuestions ? "center top" : undefined,

          // spacing
          padding: isQuestions ? "0" : "2rem",
          borderRadius: "18px",
          maxWidth: "600px",
          width: "90%",
          maxHeight: "90vh",

          // ✅ the ONLY scrollbar
          overflowY: "auto",

          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
          position: "relative",
        }}
      >
        {/* ✖ Close Button */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            background: "none",
            border: "none",
            fontSize: "1.5rem",
            cursor: "pointer",
            color: isQuestions ? "#fff" : "inherit", // readable on starry bg
            textShadow: isQuestions ? "0 1px 3px rgba(0,0,0,0.5)" : undefined,
            zIndex: 1,
          }}
        >
          ✖
        </button>

        {/* 🔄 Screen Content */}
        {screen === "intro" && <WDIntro onNext={handleNext} />}
        {screen === "ourstory" && <OurStory onClose={() => setScreen("intro")} />}
        {screen === "questions" && <WDQuestions onClose={onClose} />} {/* content-only */}
        {screen === "partners" && <WDPartners onClose={onClose} />}
      </div>
    </div>
  );
};

export default WedAndDoneOverlay;