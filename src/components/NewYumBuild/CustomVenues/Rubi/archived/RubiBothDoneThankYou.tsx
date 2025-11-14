// src/components/NewYumBuild/CustomVenues/Rubi/RubiBothDoneThankYou.tsx
import React, { useEffect } from "react";
import { getAuth } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

interface Props {
  onClose: () => void;
}

const RubiBothDoneThankYou: React.FC<Props> = ({ onClose }) => {
  useEffect(() => {
    try {
      localStorage.setItem("yumStep", "rubiBothDoneThankYou");
    } catch {}
    const user = getAuth().currentUser;
    if (user) {
      updateDoc(doc(db, "users", user.uid), {
        "progress.yumYum.step": "rubiBothDoneThankYou",
      }).catch(() => {});
    }
  }, []);

  const handleClose = () => {
    try {
      localStorage.setItem("yumStep", "home");
      localStorage.removeItem("rubiYumStep");
      window.dispatchEvent(new Event("yumStepChanged"));
    } catch {}
    onClose();
  };

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 680 }}>
      <button className="pixie-card__close" onClick={handleClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/yum_thanks.mp4`}
          autoPlay
          loop
          muted
          playsInline
          style={{
            maxWidth: 220,
            width: "100%",
            margin: "0 auto 1.25rem",
            borderRadius: 12,
            display: "block",
          }}
        />

        <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
          Hey there, culinary champ! 🧁
        </h2>

        <p className="px-prose-narrow" style={{ marginBottom: "0.75rem" }}>
          You’re all set for <strong>catering and desserts</strong>!
        </p>

        <p className="px-prose-narrow" style={{ marginBottom: "0.75rem" }}>
          Your receipts and contracts are saved under <em>Documents</em> in your menu bar.
        </p>

        <p className="px-prose-narrow" style={{ marginBottom: "1.5rem" }}>
          Keep a look out for the <strong>Guest Count Scroll</strong> — it’ll appear about{" "}
          <strong>45 days before your wedding</strong> so you can make any updates.
        </p>

        <div className="px-cta-col" style={{ marginTop: 8 }}>
          <button className="boutique-primary-btn" onClick={handleClose} style={{ width: 250 }}>
            🏠 Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default RubiBothDoneThankYou;