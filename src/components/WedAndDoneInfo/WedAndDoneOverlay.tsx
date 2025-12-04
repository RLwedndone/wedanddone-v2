// src/components/WedAndDoneInfo/WedAndDoneOverlay.tsx
import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import WDIntro from "./WDIntro";
import OurStory from "./OurStory";
import WDQuestions from "./WDQuestions";
import WDPartners from "./WDPartners";
import LegalStuff from "./LegalStuff";

type InfoScreen =
  | "intro"
  | "ourstory"
  | "questions"
  | "weddingwisdom"
  | "partners"
  | "legal";

interface WedAndDoneOverlayProps {
  onClose: () => void;
}

const WedAndDoneOverlay: React.FC<WedAndDoneOverlayProps> = ({ onClose }) => {
  const [screen, setScreen] = useState<InfoScreen>("intro");
  const navigate = useNavigate();
  const goBackToIntro = () => setScreen("intro");

  // 👉 ref to the scrollable white card
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const handleNext = (nextScreen: InfoScreen) => {
    if (nextScreen === "weddingwisdom") {
      navigate("/blog");
      onClose();
      return;
    }
    setScreen(nextScreen);
  };

  const isQuestions = screen === "questions";

  // ✅ whenever the overlay screen changes, reset the card’s scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [screen]);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 3000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "hidden",
      }}
    >
      <div
        ref={scrollRef}
        style={{
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
          overflowY: "auto",        // the scroller we reset
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
          position: "relative",
        }}
      >
        {/* 🩷 Pink X */}
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
  <OurStory onBack={goBackToIntro} />
)}

{screen === "questions" && (
  <WDQuestions
    onClose={onClose}        // pink X closes overlay
    onNext={handleNext}
    onBack={goBackToIntro}   // new back button
  />
)}

{screen === "partners" && (
  <WDPartners onBack={goBackToIntro} />
)}

{screen === "legal" && (
  <LegalStuff onBack={goBackToIntro} />
)}
      </div>
    </div>
  );
};

export default WedAndDoneOverlay;