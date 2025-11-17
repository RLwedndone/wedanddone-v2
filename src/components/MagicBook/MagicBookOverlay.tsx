import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import MagIntro from "./MagIntro";
import DetailWranglerIntro from "./DetailWrangler/DetailWranglerIntro";
import DetailWranglerBasics from "./DetailWrangler/DetailWranglerBasics";
import DetailWranglerStyle from "./DetailWrangler/DetailWranglerStyle";
import DetailWranglerWeddingCosts from "./DetailWrangler/DetailWranglerWeddingCosts";
import MakeItOfficial from "./DetailWrangler/MakeItOfficial";
import SaveTheDatePage from "./DetailWrangler/SaveTheDatePage";
import SetTables from "./DetailWrangler/SetTables";
import MagicCloud from "../MagOMeter/MagicCloud";
import TimeLine from "./DetailWrangler/TimeLine";
import PhotoVIPIntro from "./PhotoVIP/PhotoVIPIntro";
import CoupleInfo from "./PhotoVIP/CoupleInfo";
import PhotoVIPList from "./PhotoVIP/PhotoVIPList";
import PhotoVIPList1 from "./PhotoVIP/PhotoVIPList1";
import PhotoVIPList2 from "./PhotoVIP/PhotoVIPList2";
import PhotoShotList1 from "./PhotoVIP/PhotoShotList1";
import PhotoShotList2 from "./PhotoVIP/PhotoShotList2";
import PhotoShotListCombined from "./PhotoVIP/PhotoShotListCombined";
import MagicBookTOC from "./MagicBookTOC";
import PhotoShotPDF from "./PhotoVIP/PhotoShotPDF";

import { useScrollToTopOnChange } from "../../hooks/useScrollToTop";

type MagicStep =
  | "intro"
  | "dwIntro"
  | "dwBasics"
  | "dwStyle"
  | "dwCosts"
  | "budget"
  | "makeItOfficial"
  | "saveTheDate"
  | "timeline"
  | "setTables"
  | "photoVIPIntro"
  | "coupleInfo"
  | "vip"
  | "photoShotIntro"
  | "vip1"
  | "vip2"
  | "photoShotList1"
  | "photoShotList2"
  | "photoShotListCombined"
  | "photoPDF"
  | "toc";

interface MagicBookOverlayProps {
  setActiveOverlay: (value: any) => void;
  startAt?: MagicStep;
}

const MagicBookOverlay: React.FC<MagicBookOverlayProps> = ({
  setActiveOverlay,
  startAt,
}) => {
  const [step, setStep] = useState<MagicStep>("intro");
  const overlayRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const handleCloseOverlay = () => {
    setActiveOverlay(null);
  };

  // Centralized "Back to TOC"
  const goToTOC = React.useCallback(() => {
    setStep("toc");
    localStorage.setItem("magicStep", "toc");
  }, []);

  // Listen for global "magic:gotoTOC" events
  useEffect(() => {
    const handler = () => {
      setStep("toc");
      localStorage.setItem("magicStep", "toc");
    };
    window.addEventListener("magic:gotoTOC", handler);
    return () => window.removeEventListener("magic:gotoTOC", handler);
  }, []);

  // Scroll to top whenever step changes
  useScrollToTopOnChange([step], { targetRef: overlayRef });

  // Restore saved step on mount (or use startAt)
  useEffect(() => {
    const savedStep = (startAt || localStorage.getItem("magicStep")) as MagicStep;
    if (savedStep) setStep(savedStep);
  }, [startAt]);

  // Persist current step
  useEffect(() => {
    localStorage.setItem("magicStep", step);
  }, [step]);

  return (
    <div
      className="pixie-overlay"
      ref={overlayRef}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 1000,
        overflowY: "auto",
      }}
    >
      {/* Just a layout wrapper – NO card styles here */}
      <div
        style={{
          width: "100%",
          maxWidth: 900,
          margin: "40px auto",
          padding: "0 16px",
        }}
      >
        {step === "intro" && (
          <MagIntro
            onNext={() => {
              setStep("toc");
              localStorage.setItem("magicStep", "toc");
            }}
            onClose={handleCloseOverlay}
          />
        )}

        {step === "dwIntro" && (
          <DetailWranglerIntro
            onNext={() => setStep("dwBasics")}
            goToTOC={goToTOC}
          />
        )}

        {step === "dwBasics" && (
          <DetailWranglerBasics
            onNext={() => setStep("dwStyle")}
            onBack={() => setStep("dwIntro")}
            goToTOC={goToTOC}
          />
        )}

        {step === "dwStyle" && (
          <DetailWranglerStyle
            onNext={() => setStep("dwCosts")}
            onBack={() => setStep("dwBasics")}
            goToTOC={goToTOC}
          />
        )}

        {step === "dwCosts" && (
          <DetailWranglerWeddingCosts
            onNext={() => setStep("makeItOfficial")}
            onBack={() => setStep("dwStyle")}
            onOpenBudget={() => setStep("budget")}
            goToTOC={goToTOC}
          />
        )}

        {step === "budget" && (
          <MagicCloud
            isMobile={false}
            triggerLogin={() => {}}
            triggerSignupModal={() => {}}
            onClose={() => navigate("/dashboard")}
          />
        )}

        {step === "makeItOfficial" && (
          <MakeItOfficial
            onNext={() => setStep("saveTheDate")}
            onBack={() => setStep("dwCosts")}
            goToTOC={goToTOC}
          />
        )}

        {step === "saveTheDate" && (
          <SaveTheDatePage
            onNext={() => setStep("timeline")}
            onBack={() => setStep("makeItOfficial")}
            goToTOC={goToTOC}
          />
        )}

        {step === "timeline" && (
          <TimeLine
            onNext={() => setStep("setTables")}
            onBack={() => setStep("saveTheDate")}
            goToTOC={goToTOC}
          />
        )}

        {step === "setTables" && (
          <SetTables
            onNext={() => setStep("photoVIPIntro")}
            onBack={() => setStep("timeline")}
            goToTOC={goToTOC}
          />
        )}

        {step === "photoVIPIntro" && (
          <PhotoVIPIntro
            onNext={() => setStep("coupleInfo")}
            onBack={() => setStep("setTables")}
            goToTOC={goToTOC}
          />
        )}

        {step === "coupleInfo" && (
          <CoupleInfo
            onNext={() => setStep("vip")}
            onBack={() => setStep("photoVIPIntro")}
            goToTOC={goToTOC}
          />
        )}

        {step === "vip" && (
          <PhotoVIPList
            onNext={() => setStep("vip1")}
            onBack={() => setStep("coupleInfo")}
            goToTOC={goToTOC}
          />
        )}

        {step === "vip1" && (
          <PhotoVIPList1
            onNext={() => setStep("vip2")}
            onBack={() => setStep("vip")}
            goToTOC={goToTOC}
          />
        )}

        {step === "vip2" && (
          <PhotoVIPList2
            onNext={() => {
              setStep("photoShotList1");
              localStorage.setItem("magicStep", "photoShotList1");
            }}
            onBack={() => setStep("vip1")}
            goToTOC={goToTOC}
          />
        )}

        {step === "photoShotList1" && (
          <PhotoShotList1
            onNext={() => setStep("photoShotList2")}
            onBack={() => setStep("vip2")}
            goToTOC={goToTOC}
          />
        )}

        {step === "photoShotList2" && (
          <PhotoShotList2
            onNext={() => setStep("photoShotListCombined")}
            onBack={() => setStep("photoShotList1")}
            goToTOC={goToTOC}
          />
        )}

        {step === "photoShotListCombined" && (
          <PhotoShotListCombined
            onNext={() => setStep("photoPDF")}
            onBack={() => setStep("photoShotList2")}
            goToTOC={goToTOC}
          />
        )}

        {step === "photoPDF" && (
          <PhotoShotPDF
            onBack={() => {
              setStep("photoShotListCombined");
              localStorage.setItem("magicStep", "photoShotListCombined");
            }}
            goToTOC={goToTOC}
          />
        )}

        {step === "toc" && (
          <MagicBookTOC
            setStep={setStep}
            onClose={handleCloseOverlay}
            resumeMagicBook={() => {
              const savedStep =
                (localStorage.getItem("magicStep") as MagicStep) || "intro";
              setStep(savedStep);
            }}
          />
        )}
      </div>
    </div>
  );
};

export default MagicBookOverlay;