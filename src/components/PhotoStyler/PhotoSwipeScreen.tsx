import React, { useState } from "react";
import { useSwipeable } from "react-swipeable";
import { photoStyleImages } from "./photoStyleData.ts";

interface PhotoSwipeScreenProps {
  isMobile: boolean;
  onComplete: (results: { airy: number; trueToLife: number }) => void;
  goBackToIntro: () => void;
}

const PhotoSwipeScreen: React.FC<PhotoSwipeScreenProps> = ({
  onComplete,
  isMobile,
  goBackToIntro,
}) => {
  const [index, setIndex] = useState(0);
  const [airyCount, setAiryCount] = useState(0);
  const [trueToLifeCount, setTrueToLifeCount] = useState(0);
  const [history, setHistory] = useState<string[]>([]);

  const handleSwipe = (dir: "left" | "right") => {
    const current = photoStyleImages[index];
    let newAiryCount = airyCount;
    let newTrueToLifeCount = trueToLifeCount;
  
    if (dir === "right") {
      if (current.style === "airy") newAiryCount += 1;
      if (current.style === "trueToLife") newTrueToLifeCount += 1;
    }
  
    setHistory((prev) => [...prev, dir === "right" ? current.style : "none"]);
  
    if (index < photoStyleImages.length - 1) {
      setAiryCount(newAiryCount);
      setTrueToLifeCount(newTrueToLifeCount);
      setIndex(index + 1);
    } else {
      // Now accurate final score
      onComplete({ airy: newAiryCount, trueToLife: newTrueToLifeCount });
    }
  };

  const handleBack = () => {
    if (index === 0) {
      goBackToIntro();
      return;
    }

    const previousIndex = index - 1;
    const previousStyle = history[history.length - 1];

    if (previousStyle === "airy") setAiryCount((prev) => prev - 1);
    if (previousStyle === "trueToLife") setTrueToLifeCount((prev) => prev - 1);

    setHistory((prev) => prev.slice(0, -1));
    setIndex(previousIndex);
  };

  const handlers = useSwipeable({
    onSwipedLeft: () => handleSwipe("left"),
    onSwipedRight: () => handleSwipe("right"),
    preventScrollOnSwipe: true,
    trackTouch: true,
    trackMouse: true,
  });

  const currentImage = photoStyleImages[index];

  return (
    <div style={{ textAlign: "center" }} {...handlers}>
      <div
        className="photo-style-question"
        style={{
          fontFamily: "'Jenna Sue', cursive",
          color: "#2c62ba",
          fontSize: "2.6rem",
          marginBottom: "1rem",
        }}
      >
        How do you feel about this image?
      </div>

      <img
        src={currentImage.url}
        alt="Style choice"
        style={{
          width: "100%",
          maxWidth: "600px",
          height: "auto",
          maxHeight: "50vh",
          objectFit: "contain",
          borderRadius: "12px",
          marginBottom: "1rem",
          display: "block",
          marginLeft: "auto",
          marginRight: "auto",
        }}
      />

      {isMobile ? (
        <p className="swipe-hint">
          Swipe right if it speaks to you 💖 — left if it’s not your vibe.
        </p>
      ) : (
        <div
          className="desktop-vote-buttons"
          style={{
            marginTop: "1rem",
            display: "flex",
            gap: "1rem",
            justifyContent: "center",
          }}
        >
          <button
            onClick={() => handleSwipe("left")}
            style={{
              backgroundColor: "#f78cb4",
              color: "#fff",
              padding: "0.6rem 1.2rem",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Not My Vibe
          </button>

          <button
            onClick={() => handleSwipe("right")}
            style={{
              backgroundColor: "#2c62ba",
              color: "#fff",
              padding: "0.6rem 1.2rem",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              fontSize: "1rem",
            }}
          >
            Love It
          </button>
        </div>
      )}

      <button
        onClick={handleBack}
        style={{
          marginTop: "1.5rem",
          backgroundColor: "#fbd9e1",
          color: "#000",
          padding: "0.6rem 1.2rem",
          border: "none",
          borderRadius: "8px",
          fontSize: "1rem",
          cursor: "pointer",
        }}
      >
        ⬅ Back
      </button>
    </div>
  );
};

export default PhotoSwipeScreen;