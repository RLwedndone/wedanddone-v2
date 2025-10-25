// src/components/NewYumBuild/CustomVenues/Schnepf/SchnepfBothDoneThankYou.tsx
import React, { useEffect } from "react";

interface Props { onClose: () => void; }

const SchnepfBothDoneThankYou: React.FC<Props> = ({ onClose }) => {

  const handleClose = () => {
    try {
      localStorage.setItem("yumStep", "home");
      window.dispatchEvent(new Event("yumStepChanged"));
    } catch {}
    onClose();
  };

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 680, position: "relative", textAlign: "center" }}>
      {/* 🩷 Pink X Close → dashboard */}
      <button className="pixie-card__close" onClick={handleClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>
  
      <div className="pixie-card__body">
        <div style={{ display: "flex", justifyContent: "center" }}>
          <video
            src={`${import.meta.env.BASE_URL}assets/videos/yum_thanks.mp4`}
            autoPlay
            loop
            muted
            playsInline
            className="px-media"
            style={{ maxWidth: 180, width: "100%", borderRadius: 18 }}
          />
        </div>
  
        <h2 className="px-title-lg" style={{ marginTop: 6 }}>
          Catering &amp; Desserts — All Set! 🎉
        </h2>
  
        <p className="px-prose-narrow" style={{ marginBottom: 6 }}>
          You’re squared away with Schnepf. Your receipts and confirmations live in <em>Documents</em>.
        </p>
        <p className="px-prose-narrow" style={{ marginBottom: 14 }}>
          Keep the magic going—pop into our other boutiques to check off the rest of your list!
        </p>
      </div>
    </div>
  );
};

export default SchnepfBothDoneThankYou;