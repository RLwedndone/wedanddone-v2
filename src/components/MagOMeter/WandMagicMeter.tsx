import React from "react";

interface WandMagicMeterProps {
  totalSpent: number;
  totalBudget: number;
  onClick: () => void;

  /** fine-tune position if needed */
  offsetX?: number; // px (positive = move right)
  offsetY?: number; // px (positive = move down)
}

/** Keep the wand’s box the same size everywhere */
const WAND_ASPECT = 0.42; // width / height (tall + skinny)

const WandMagicMeter: React.FC<WandMagicMeterProps & {
  offsetX?: number;
  offsetY?: number;
}> = ({ totalSpent, totalBudget, onClick, offsetX = 0, offsetY = 0 }) => {
  // If we’ve *ever* seen spend, remember it between refreshes
  const hasSpendCached =
    typeof window !== "undefined" &&
    localStorage.getItem("wandHasSpend") === "true";

  const percent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  // Pick the correct clip:
  let videoSrc: string | undefined;
  if (totalBudget > 0) {
    if (percent >= 100) videoSrc = `${import.meta.env.BASE_URL}assets/videos/wand/wand_100.webm`;
    else if (percent >= 75) videoSrc = `${import.meta.env.BASE_URL}assets/videos/wand/wand_75.webm`;
    else if (percent >= 50) videoSrc = `${import.meta.env.BASE_URL}assets/videos/wand/wand_50.webm`;
    else if (percent >= 25) videoSrc = `${import.meta.env.BASE_URL}assets/videos/wand/wand_25.webm`;
    else if (totalSpent > 0 || hasSpendCached)
      videoSrc = `${import.meta.env.BASE_URL}assets/videos/wand/wandfirst.webm`;
  } else if (totalSpent > 0 || hasSpendCached) {
    // No budget yet but we know they’ve spent → show the first wand video
    videoSrc = `${import.meta.env.BASE_URL}assets/videos/wand/wandfirst.webm`;
  }

  // Always render; fall back to PNG if we still don’t know the video yet.
  return (
    <div
      className="wand-slot"
      style={{
        position: "relative",
        width: "var(--wand-w, 120px)",
        aspectRatio: "9 / 32", // tall wand keeps shape
        transform: `translate(${offsetX}px, ${offsetY}px)`,
        cursor: "pointer",
        zIndex: 1,
      }}
      onClick={onClick}
    >
      {videoSrc ? (
        <video
          key={videoSrc}     // forces refresh when the clip changes
          autoPlay
          muted
          loop
          playsInline
          poster={`${import.meta.env.BASE_URL}assets/images/budget_wand.png`}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            objectFit: "contain",
            background: "transparent",
            pointerEvents: "none",
          }}
        >
          <source src={videoSrc} type="video/webm" />
        </video>
      ) : (
        <img
          src={`${import.meta.env.BASE_URL}assets/images/budget_wand.png`}
          alt="Wand"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            display: "block",
          }}
        />
      )}
    </div>
  );
};

export default WandMagicMeter;