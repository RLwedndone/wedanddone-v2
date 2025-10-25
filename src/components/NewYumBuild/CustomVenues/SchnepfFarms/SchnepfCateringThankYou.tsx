// src/components/NewYumBuild/CustomVenues/Schnepf/SchnepfCateringThankYou.tsx
import React, { useEffect } from "react";
import { getAuth } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import playMagicSound from "../../../../utils/playMagicSound";

interface Props {
  onBookDessertNow?: () => void | Promise<void>;
  onClose: () => void;
}

const SchnepfCateringThankYou: React.FC<Props> = ({ onBookDessertNow, onClose }) => {
  useEffect(() => {
    // 1) Chime (fire & forget)
    try {
      const res = playMagicSound() as void | Promise<void>;
      Promise.resolve(res).catch(() => {});
    } catch {}

    // 2) Local flags + Firestore progress
    try {
      localStorage.setItem("schnepfCateringBooked", "true");
      localStorage.setItem("schnepfJustBookedCatering", "true");
      localStorage.setItem("yumStep", "schnepfCateringThankYou");
    } catch {}

    const user = getAuth().currentUser;
    if (user) {
      updateDoc(doc(db, "users", user.uid), {
        "progress.yumYum.step": "schnepfCateringThankYou",
      }).catch(() => {});
    }

    // 3) Fan-out events
    window.dispatchEvent(new Event("purchaseMade"));                  // Budget Wand, etc.
    window.dispatchEvent(new Event("cateringCompletedNow"));
    window.dispatchEvent(new CustomEvent("bookingsChanged", { detail: { catering: true } }));
  }, []);

  const handleBookDesserts = () => {
    if (onBookDessertNow) {
      try { localStorage.setItem("yumStep", "dessertStyle"); } catch {}
      Promise.resolve(onBookDessertNow()).catch(() => {});
      return;
    }
    // fallback: close & broadcast an intent
    onClose?.();
    setTimeout(() => {
      try {
        localStorage.setItem("yumBookingType", "dessert");
        localStorage.setItem("yumActiveBookingType", "dessert");
      } catch {}
      window.dispatchEvent(new CustomEvent("openDesserts", { detail: { vendor: "schnepf" } }));
    }, 0);
  };

  const handleClose = () => {
    try {
      localStorage.setItem("yumStep", "home");
      window.dispatchEvent(new Event("yumStepChanged"));
    } catch {}
    onClose();
  };

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 680, position: "relative" }}>
      {/* 🩷 Pink X Close → Dashboard */}
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
          style={{ width: 180, maxWidth: "90%", borderRadius: 12, margin: "0 auto 12px" }}
        />
  
        <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
          Catering Locked &amp; Confirmed! 💙
        </h2>
  
        <p className="px-prose-narrow" style={{ marginBottom: 6 }}>
          You'll find your receipt and selection confirmation in your <em>Documents</em> folder.
        </p>
        <p className="px-prose-narrow" style={{ marginBottom: 14 }}>
          Ready to add a sweet finish? Click the little button below to book desserts!
        </p>
  
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
          <button
            onClick={handleBookDesserts}
            className="boutique-primary-btn"
            style={{ width: 240, background: "#e98fba", borderColor: "#e98fba" }}
          >
            🍰 Book Desserts
          </button>
  
          <button onClick={handleClose} className="boutique-primary-btn" style={{ width: 240 }}>
            🏠 Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default SchnepfCateringThankYou;