import React from "react";

interface WandMagicMeterProps {
  totalSpent: number;
  totalBudget: number;
  onClick: () => void;
}

const WandMagicMeter: React.FC<WandMagicMeterProps> = ({ totalSpent, totalBudget, onClick }) => {
  const videoSrc = (() => {
    if (!totalBudget || totalBudget <= 0) return undefined;
    const percent = (totalSpent / totalBudget) * 100;

    if (percent >= 100) return "/assets/videos/wand/wand_100.webm";
    if (percent >= 75)  return "/assets/videos/wand/wand_75.webm";
    if (percent >= 50)  return "/assets/videos/wand/wand_50.webm";
    if (percent >= 25)  return "/assets/videos/wand/wand_25.webm";
    if (totalSpent > 0) return "/assets/videos/wand/wandfirst.webm";

    return undefined;
  })();

  console.log("🪄 WandMeter Debug → videoSrc:", videoSrc, " | totalSpent:", totalSpent, " | totalBudget:", totalBudget);

  // No fallback image here — PNG is handled by DashboardButtons when videoOn=false
  if (!videoSrc) return null;

  return (
    <div
      // ✨ no absolute, no top/left here — parent handles placement & size
      style={{
        position: "relative",   // or "static" — either is fine
        width: "100%",          // takes the width you set from the parent
        height: "auto",
        cursor: "pointer",
        zIndex: 1,              // child zIndex doesn’t matter now
        transition: "transform 0.3s ease",
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1.1)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "scale(1)"; }}
    >
      {videoSrc ? (
        <video
          key={videoSrc}
          autoPlay
          muted
          loop
          playsInline
          poster="/assets/images/budget_wand.png"
          onClick={onClick}
          style={{ width: "100%", height: "auto", borderRadius: "12px", backgroundColor: "transparent", display: "block" }}
        >
          <source src={videoSrc} type="video/webm" />
          Your browser does not support the video tag.
        </video>
      ) : (
        <img
          src="/assets/images/budget_wand.png"
          alt="Magic Wand Static"
          onClick={onClick}
          style={{ width: "100%", height: "auto", borderRadius: "12px" }}
        />
      )}
    </div>
  );
};

export default WandMagicMeter;