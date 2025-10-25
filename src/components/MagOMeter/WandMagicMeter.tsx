import React from "react";

interface WandMagicMeterProps {
  totalSpent: number;
  totalBudget: number;
  onClick: () => void;
}

const WandMagicMeter: React.FC<WandMagicMeterProps> = ({
  totalSpent,
  totalBudget,
  onClick,
}) => {
  const videoSrc: string | undefined = (() => {
    if (!totalBudget || totalBudget <= 0) return undefined;
    const percent = (totalSpent / totalBudget) * 100;

    if (percent >= 100)
      return `${import.meta.env.BASE_URL}assets/videos/wand/wand_100.webm`;
    if (percent >= 75)
      return `${import.meta.env.BASE_URL}assets/videos/wand/wand_75.webm`;
    if (percent >= 50)
      return `${import.meta.env.BASE_URL}assets/videos/wand/wand_50.webm`;
    if (percent >= 25)
      return `${import.meta.env.BASE_URL}assets/videos/wand/wand_25.webm`;
    if (totalSpent > 0)
      return `${import.meta.env.BASE_URL}assets/videos/wand/wandfirst.webm`;

    return undefined;
  })();

  console.log(
    "🪄 WandMeter Debug → videoSrc:",
    videoSrc,
    " | totalSpent:",
    totalSpent,
    " | totalBudget:",
    totalBudget
  );

  // If we don't have a video for this state, don't render anything here.
  // (Parent can render static wand art instead.)
  if (!videoSrc) return null;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "auto",
        cursor: "pointer",
        zIndex: 1,
        transition: "transform 0.3s ease",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "scale(1.1)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.transform = "scale(1)";
      }}
    >
      <video
        key={videoSrc}
        autoPlay
        muted
        loop
        playsInline
        poster={`${import.meta.env.BASE_URL}assets/images/budget_wand.png`}
        onClick={onClick}
        style={{
          width: "100%",
          height: "auto",
          borderRadius: "12px",
          backgroundColor: "transparent",
          display: "block",
        }}
      >
        <source src={videoSrc} type="video/webm" />
        Your browser does not support the video tag.
      </video>
    </div>
  );
};

export default WandMagicMeter;