// src/components/NewYumBuild/CustomVenues/Encanterra/EncanterraCateringThankYou.tsx
import React, { useEffect } from "react";
import { getAuth } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import playMagicSound from "../../../../utils/playMagicSound";

type Props = {
  onContinueDesserts: () => void | Promise<void>;
  onClose: () => void;
};

const EncanterraCateringThankYou: React.FC<Props> = ({ onContinueDesserts, onClose }) => {
  useEffect(() => {
    // 1) Chime (non-blocking)
    try {
      const r = playMagicSound() as void | Promise<void>;
      Promise.resolve(r).catch(() => {});
    } catch {}

    // 2) Local flags (guest-safe) + breadcrumb
    try {
      localStorage.setItem("encCateringBooked", "true");     // venue-specific
      localStorage.setItem("encJustBookedCatering", "true");
      localStorage.setItem("yumCateringBooked", "true");     // ✅ generic (new)
      localStorage.setItem("yumBookedCatering", "true");     // ✅ legacy support
      localStorage.setItem("yumLastCompleted", "catering");  // ✅ drives HUD image
      localStorage.setItem("yumStep", "encanterraCateringThankYou");
    } catch {}

    // 3) Firestore progress + booking flag (if logged in)
    const user = getAuth().currentUser;
    if (user) {
      updateDoc(doc(db, "users", user.uid), {
        "progress.yumYum.step": "encanterraCateringThankYou",
        "bookings.catering": true, // ✅ mark catering booked
      }).catch(() => {});
    }

    // 4) Fan-out events for instant UI updates
    window.dispatchEvent(new Event("purchaseMade"));
    window.dispatchEvent(new Event("cateringCompletedNow")); // ✅ explicit event
    window.dispatchEvent(new Event("yum:lastCompleted"));    // optional breadcrumb event
    window.dispatchEvent(new CustomEvent("bookingsChanged", { detail: { catering: true } }));
  }, []);

  const handleBookDesserts = async () => {
    // move user into the dessert flow at the right step
    try {
      localStorage.setItem("yumStep", "dessertStyle");
    } catch {}

    const user = getAuth().currentUser;
    if (user) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          "progress.yumYum.step": "dessertStyle",
        });
      } catch {
        /* ignore */
      }
    }

    try {
      await Promise.resolve(onContinueDesserts?.());
    } catch {
      /* ignore */
    }
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
          Ready to add a sweet finish? Click the button below to book desserts!
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

export default EncanterraCateringThankYou;