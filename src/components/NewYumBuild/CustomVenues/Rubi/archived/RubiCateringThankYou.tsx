// src/components/NewYumBuild/CustomVenues/Rubi/RubiCateringThankYou.tsx
import React, { useEffect } from "react";
import { getAuth } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import playMagicSound from "../../../../utils/playMagicSound";

type Props = {
  onContinueDesserts: () => void | Promise<void>;
  onClose: () => void;
};

const RubiCateringThankYou: React.FC<Props> = ({ onContinueDesserts, onClose }) => {
  useEffect(() => {
    // 1) ✨ Chime (non-blocking)
    try {
      const r = playMagicSound() as void | Promise<void>;
      Promise.resolve(r).catch(() => {});
    } catch {}

    // 2) Local flags + breadcrumb for HUD + progress step
    try {
      localStorage.setItem("rubiCateringBooked", "true");     // venue-specific
      localStorage.setItem("rubiJustBookedCatering", "true");

      localStorage.setItem("yumCateringBooked", "true");      // ✅ generic
      localStorage.setItem("yumBookedCatering", "true");      // ✅ legacy support
      localStorage.setItem("yumLastCompleted", "catering");   // ✅ drives HUD image

      localStorage.setItem("yumStep", "rubiCateringThankYou");
    } catch {}

    // 3) Firestore progress + booking flag (if logged in)
    const user = getAuth().currentUser;
    if (user) {
      updateDoc(doc(db, "users", user.uid), {
        "progress.yumYum.step": "rubiCateringThankYou",
        "bookings.catering": true, // ✅ mark catering booked
      }).catch(() => {});
    }

    // 4) Fan-out events so UI updates immediately
    window.dispatchEvent(new Event("purchaseMade"));
    window.dispatchEvent(new Event("cateringCompletedNow")); // explicit catering event
    window.dispatchEvent(new Event("yum:lastCompleted"));    // breadcrumb event
    window.dispatchEvent(new CustomEvent("bookingsChanged", { detail: { catering: true } }));
  }, []);

  const handleBookDesserts = async () => {
    // Move into Rubi dessert selector
    try {
      localStorage.setItem("yumStep", "rubiDessertSelector");
    } catch {}

    const user = getAuth().currentUser;
    if (user) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          "progress.yumYum.step": "rubiDessertSelector",
        });
      } catch {
        /* ignore */
      }
    }

    try {
      await Promise.resolve(onContinueDesserts?.());
    } catch { /* ignore */ }
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
          style={{ maxWidth: 180, margin: "0 auto 12px", borderRadius: 12, display: "block" }}
        />

        <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
          Catering Locked &amp; Confirmed!
        </h2>

        <p className="px-prose-narrow" style={{ marginBottom: 8 }}>
          You'll find your receipt and selection confirmation in your <em>Documents</em> folder.
        </p>
        <p className="px-prose-narrow" style={{ marginBottom: 14 }}>
          Want to add more sweets? Click the button below to book a wedding cake or a goodies table!
        </p>

        <div className="px-cta-col" style={{ marginTop: 6 }}>
          <button className="boutique-primary-btn" onClick={handleBookDesserts} style={{ width: 240 }}>
            🍰 Book Desserts
          </button>
          <button className="boutique-back-btn" onClick={onClose} style={{ width: 240 }}>
            🏠 Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default RubiCateringThankYou;