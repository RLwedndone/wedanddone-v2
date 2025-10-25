// src/components/NewYumBuild/CustomVenues/Tubac/TubacCateringThankYou.tsx
import React, { useEffect } from "react";
import { getAuth } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import playMagicSound from "../../../../utils/playMagicSound";

interface Props {
  onBookDessertNow?: () => void | Promise<void>;
  onClose: () => void;
}

const TubacCateringThankYou: React.FC<Props> = ({ onBookDessertNow, onClose }) => {
  useEffect(() => {
    // 1) Chime
    try {
      const res = playMagicSound() as void | Promise<void>;
      Promise.resolve(res).catch(() => {});
    } catch {}

    // 2) Local flags + Firestore progress
    try {
      localStorage.setItem("tubacCateringBooked", "true");
      localStorage.setItem("tubacJustBookedCatering", "true");
      localStorage.setItem("yumStep", "tubacCateringThankYou");
    } catch {}

    const user = getAuth().currentUser;
    if (user) {
      updateDoc(doc(db, "users", user.uid), {
        "progress.yumYum.step": "tubacCateringThankYou",
      }).catch(() => {});
    }

    // 3) Fan-out events
    window.dispatchEvent(new Event("purchaseMade"));
    window.dispatchEvent(new Event("cateringCompletedNow"));
    window.dispatchEvent(new CustomEvent("bookingsChanged", { detail: { catering: true } }));
  }, []);

  const handleBookDesserts = () => {
    // Prefer continuing inside this overlay
    if (onBookDessertNow) {
      try { localStorage.setItem("yumStep", "dessertCart"); } catch {}
      Promise.resolve(onBookDessertNow()).catch(() => {});
      return;
    }
    // Fallback: close overlay and broadcast an event the shell can catch
    onClose?.();
    setTimeout(() => {
      try {
        localStorage.setItem("yumBookingType", "dessert");
        localStorage.setItem("yumActiveBookingType", "dessert");
      } catch {}
      window.dispatchEvent(new CustomEvent("openDesserts", { detail: { vendor: "whiskAndPaddle" } }));
    }, 0);
  };

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 700 }}>
      {/* 🩷 Pink X Close */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
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
          style={{ maxWidth: 180, margin: "0 auto 12px", borderRadius: 12 }}
        />

        <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
          Catering Locked &amp; Confirmed!
        </h2>

        <p className="px-prose-narrow" style={{ marginBottom: 8 }}>
          You'll find your receipt and selection confirmation in your <em>Documents</em> folder.
        </p>
        <p className="px-prose-narrow" style={{ marginBottom: 14 }}>
          Ready to add a sweet finish? Tap below to book desserts.
        </p>

        <div className="px-cta-col" style={{ marginTop: 6 }}>
          <button
            className="boutique-primary-btn"
            onClick={handleBookDesserts}
            style={{ width: 240 }}
          >
            🍰 Book Desserts
          </button>
        </div>
      </div>
    </div>
  );
};

export default TubacCateringThankYou;