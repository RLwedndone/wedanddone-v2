// src/components/NewYumBuild/CustomVenues/Rubi/RubiDessertThankYou.tsx
import React, { useEffect } from "react";
import { getAuth } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import playMagicSound from "../../../../utils/playMagicSound";

interface Props {
  onClose: () => void;
}

const RubiDessertThankYou: React.FC<Props> = ({ onClose }) => {
  useEffect(() => {
    // ✨ Magic chime
    try {
      const res = playMagicSound() as void | Promise<void>;
      Promise.resolve(res).catch(() => {});
    } catch {}

    // Local progress
    try {
      localStorage.setItem("rubiDessertsBooked", "true");
      localStorage.setItem("rubiJustBookedDessert", "true");
      localStorage.setItem("yumStep", "rubiDessertThankYou");
    } catch {}

    // Firestore progress
    const user = getAuth().currentUser;
    if (user) {
      updateDoc(doc(db, "users", user.uid), {
        "progress.yumYum.step": "rubiDessertThankYou",
      }).catch(() => {});
    }

    // Fan-out
    window.dispatchEvent(new Event("purchaseMade"));
    window.dispatchEvent(new Event("dessertCompletedNow"));
    window.dispatchEvent(new CustomEvent("bookingsChanged", { detail: { dessert: true } }));
  }, []);

  // Handle close
  const handleClose = () => {
    try {
      localStorage.setItem("yumStep", "home");
      localStorage.removeItem("rubiYumStep");
      window.dispatchEvent(new Event("yumStepChanged"));
    } catch {}
    onClose();
  };

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 680, position: "relative" }}>
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
          className="px-media"
          style={{
            width: 180,
            maxWidth: "90%",
            borderRadius: 12,
            margin: "0 auto 12px",
          }}
        />

        <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
          Desserts Locked &amp; Confirmed! 💙
        </h2>

        <p className="px-prose-narrow" style={{ marginBottom: 6 }}>
          Your selections and receipt are saved under <em>Documents</em>.
        </p>
        <p className="px-prose-narrow" style={{ marginBottom: 14 }}>
          Now that desserts are handled, check out our other boutiques to keep crossing off the
          wedding to-do list!
        </p>
      </div>
    </div>
  );
};

export default RubiDessertThankYou;