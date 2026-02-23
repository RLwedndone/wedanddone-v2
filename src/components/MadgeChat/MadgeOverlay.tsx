import React, { useRef, useState } from "react";
import "../../styles/globals/boutique.master.css";

import { useOverlayOpen } from "../../hooks/useOverlayOpen";
import { useScrollToTopOnChange } from "../../hooks/useScrollToTop";

import MadgeHelpCard from "./MadgeHelpCard";
import MadgeChatModal from "./MadgeChatModal";
import AskFounderModal from "./AskFounderModal";
import WalkthroughModal from "./WalkthroughModal";
import WDQuestions from "../WedAndDoneInfo/WDQuestions";

type MadgeStep =
  | "help"
  | "chat"
  | "askFounder"
  | "walkthrough"
  | "faq";

// ✅ Make sure this matches WalkthroughModal’s WalkthroughTarget
type WalkthroughTarget = "venue" | "yum" | "photo" | "floral" | "jam" | "planner";

interface MadgeOverlayProps {
  onClose: () => void;
  startAt?: MadgeStep;
}

const MadgeOverlay: React.FC<MadgeOverlayProps> = ({ onClose, startAt }) => {
  const [step, setStep] = useState<MadgeStep>(startAt ?? "help");

  const cardRef = useRef<HTMLDivElement>(null);
  useOverlayOpen(cardRef);
  useScrollToTopOnChange([step], { targetRef: cardRef });

  // ✅ Walkthrough -> launch the right boutique at intro
  const handleGo = (target: WalkthroughTarget) => {
    const map: Record<WalkthroughTarget, { type: string; startAt: string }> = {
      venue: { type: "venueRanker", startAt: "intro" },
      yum: { type: "yumyum", startAt: "intro" }, // Dashboard routes "yumyum" to MenuController
      photo: { type: "photo", startAt: "intro" },
      floral: { type: "floral", startAt: "intro" },
      planner: { type: "planner", startAt: "intro" },
      jam: { type: "jam", startAt: "intro" },
    };

    const next = map[target];

    window.dispatchEvent(
      new CustomEvent("openOverlay", {
        detail: { type: next.type, startAt: next.startAt },
      })
    );

    // Close Madge overlay so they see where they’re going ✨
    onClose();
  };

  return (
    <div className="pixie-overlay">
      <div ref={cardRef} style={{ width: "100%" }}>
        {step === "help" && (
          <MadgeHelpCard
            onClose={onClose}
            onChatWithMadge={() => setStep("chat")}
            onWalkthrough={() => setStep("walkthrough")}
            onAskFounder={() => setStep("askFounder")}
            onFAQ={() => setStep("faq")}
            onEvent={(name, data) => {
              // optional analytics
              // console.log("[MadgeOverlay event]", name, data);
            }}
          />
        )}

        {step === "chat" && (
          <MadgeChatModal onClose={() => setStep("help")} />
        )}

        {step === "askFounder" && (
          <AskFounderModal onClose={() => setStep("help")} />
        )}

        {step === "walkthrough" && (
          <WalkthroughModal
            onClose={() => setStep("help")}
            onGo={handleGo} // ✅ THIS is the wiring you need
            onEvent={(name, data) => {
              // optional analytics
              // console.log("[Walkthrough event]", name, data);
            }}
          />
        )}
        {step === "faq" && (
  <WDQuestions
    onClose={() => setStep("help")}
    onBack={() => setStep("help")}
    onNext={() => setStep("help")}
  />
)}
      </div>
    </div>
  );
};

export default MadgeOverlay;