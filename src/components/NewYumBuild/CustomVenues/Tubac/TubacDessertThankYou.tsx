// src/components/NewYumBuild/CustomVenues/Tubac/TubacDessertThankYou.tsx
import React, { useEffect } from "react";
import { getAuth } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import playMagicSound from "../../../../utils/playMagicSound";

interface Props {
  onClose: () => void;
}

const TubacDessertThankYou: React.FC<Props> = ({ onClose }) => {
  useEffect(() => {
    // 1) ✨ Chime (non-blocking)
    try {
      const res = playMagicSound() as void | Promise<void>;
      Promise.resolve(res).catch(() => {});
    } catch {}

    // 2) Local progress flags + breadcrumb for HUD button
    try {
      // venue-specific
      localStorage.setItem("tubacDessertBooked", "true");
      localStorage.setItem("tubacJustBookedDessert", "true");

      // generic + legacy + "last completed"
      localStorage.setItem("yumDessertBooked", "true");     // ✅ generic
      localStorage.setItem("yumBookedDessert", "true");     // ✅ legacy support
      localStorage.setItem("yumLastCompleted", "dessert");  // ✅ drive HUD Yum image

      localStorage.setItem("yumStep", "tubacDessertThankYou");
    } catch {}

    // 3) Firestore progress + booking flag
    const user = getAuth().currentUser;
    if (user) {
      updateDoc(doc(db, "users", user.uid), {
        "progress.yumYum.step": "tubacDessertThankYou",
        "bookings.dessert": true, // ✅ mark dessert booked
      }).catch(() => {});
    }

    // 4) Fan-out so UI updates instantly
    window.dispatchEvent(new Event("purchaseMade"));
    window.dispatchEvent(new Event("dessertCompletedNow"));
    window.dispatchEvent(new Event("yum:lastCompleted")); // breadcrumb event
    window.dispatchEvent(new CustomEvent("bookingsChanged", { detail: { dessert: true } }));
  }, []);

  // Clear step before closing so manager won’t remount
  const handleClose = () => {
    try {
      localStorage.setItem("yumStep", "home");
      localStorage.removeItem("tubacYumStep"); // harmless if not set
      window.dispatchEvent(new Event("yumStepChanged"));
    } catch {}
    onClose();
  };

  return (
    // Parent overlay supplies the backdrop; we render the card
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 680, position: "relative" }}>
      {/* 🩷 Pink X Close */}
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
          style={{ width: 180, maxWidth: "90%", borderRadius: 12, margin: "0 auto 12px", display: "block" }}
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

export default TubacDessertThankYou;