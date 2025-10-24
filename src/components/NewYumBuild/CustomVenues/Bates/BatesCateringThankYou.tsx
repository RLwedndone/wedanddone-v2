// src/components/NewYumBuild/CustomVenues/Bates/BatesCateringThankYou.tsx
import React, { useEffect, useRef } from "react";
import { getAuth } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import playMagicSound from "../../../../utils/playMagicSound";

interface Props {
  onBookDessertNow?: () => void | Promise<void>;
  onClose: () => void;
}

const BatesCateringThankYou: React.FC<Props> = ({ onBookDessertNow, onClose }) => {

    useEffect(() => {
        // 1) Chime (no gating; mirrors VenueThankYou)
        try {
          const res = playMagicSound() as void | Promise<void>;
          Promise.resolve(res).catch(() => {/* ignore */});
        } catch {/* ignore */}
      
        // 2) Local flags + Firestore progress
        try {
          localStorage.setItem("batesCateringBooked", "true");
          localStorage.setItem("batesJustBookedCatering", "true"); // lets TY show "fresh" copy if you use it
          localStorage.setItem("yumStep", "batesCateringThankYou");
        } catch {}
      
        const user = getAuth().currentUser;
        if (user) {
          updateDoc(doc(db, "users", user.uid), {
            "progress.yumYum.step": "batesCateringThankYou",
          }).catch(() => {});
        }
      
        // 3) Fan-out events (Budget Wand, dashboards, listeners)
        window.dispatchEvent(new Event("purchaseMade"));              // 🪄 Budget Wand
        window.dispatchEvent(new Event("cateringCompletedNow"));      // optional: your custom listeners
        window.dispatchEvent(
          new CustomEvent("bookingsChanged", { detail: { catering: true } })
        );
      }, []);

  const handleBookDesserts = () => {
    // Prefer in-overlay dessert start
    if (onBookDessertNow) {
      try { localStorage.setItem("yumStep", "dessertCart"); } catch {}
      Promise.resolve(onBookDessertNow()).catch(() => {});
      return;
    }
    // Fallback: close & broadcast
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
        <img src="/assets/icons/pink_ex.png" alt="Close" />
      </button>
  
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <video
          src="/assets/videos/yum_thanks.mp4"
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
          Ready to add a sweet finish? Click the little button below to book desserts!
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

export default BatesCateringThankYou;