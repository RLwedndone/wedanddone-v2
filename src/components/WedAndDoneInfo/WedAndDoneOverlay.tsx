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
        zIndex: 3000, // ⬆️ make sure it sits above everything
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden", // only the card scrolls
      }}
    >
      <div
        style={{
          // ⭐ Starry background only on the Questions screen
          background: isQuestions ? "transparent" : "#fff",
          backgroundImage: isQuestions
            ? `url(${import.meta.env.BASE_URL}assets/images/Starry_Night.png)`
            : undefined,
          backgroundRepeat: isQuestions ? "repeat-y" : undefined,
          backgroundSize: isQuestions ? "100% auto" : undefined,
          backgroundPosition: isQuestions ? "center top" : undefined,

          padding: isQuestions ? "0" : "2rem",
          borderRadius: "18px",
          maxWidth: "600px",
          width: "90%",
          maxHeight: "90vh",

          overflowY: "auto",

          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
          position: "relative",
        }}
      >
        {/* 🩷 Branded Pink X Close Button */}
        <button
          onClick={onClose}
          className="pixie-card__close"
          style={{
            position: "absolute",
            top: isQuestions ? "1.2rem" : "1rem",
            right: isQuestions ? "1.2rem" : "1rem",
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            zIndex: 2,
          }}
          aria-label="Close"
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
            alt="Close"
            style={{ width: 32, height: 32, display: "block" }}
          />
        </button>

        {/* 🔄 Screen Content */}
        {screen === "intro" && <WDIntro onNext={handleNext} />}
        {screen === "ourstory" && (
          <OurStory onClose={() => setScreen("intro")} />
        )}
        {screen === "questions" && (
  <WDQuestions
    onClose={onClose}
    onNext={handleNext}    // ⭐ add this
  />
)}
        {screen === "partners" && <WDPartners onClose={onClose} />}
      </div>
    </div>
  );
};

export default WedAndDoneOverlay;