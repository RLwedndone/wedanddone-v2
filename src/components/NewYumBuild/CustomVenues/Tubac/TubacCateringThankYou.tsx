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
    // 1) ✨ chime (non-blocking)
    try {
      const res = playMagicSound() as void | Promise<void>;
      Promise.resolve(res).catch(() => {});
    } catch {}

    // 2) local flags + breadcrumb + progress step
    try {
      // venue-specific
      localStorage.setItem("tubacCateringBooked", "true");
      localStorage.setItem("tubacJustBookedCatering", "true");

      // generic + legacy + HUD breadcrumb
      localStorage.setItem("yumCateringBooked", "true");     // ✅ generic
      localStorage.setItem("yumBookedCatering", "true");     // ✅ legacy support
      localStorage.setItem("yumLastCompleted", "catering");  // ✅ drives HUD image

      localStorage.setItem("yumStep", "tubacCateringThankYou");
    } catch {}

    // 3) Firestore progress + booking flag
    const user = getAuth().currentUser;
    if (user) {
      updateDoc(doc(db, "users", user.uid), {
        "progress.yumYum.step": "tubacCateringThankYou",
        "bookings.catering": true, // ✅ mark catering booked
      }).catch(() => {});
    }

    // 4) fan-out so UI updates instantly
    window.dispatchEvent(new Event("purchaseMade"));
    window.dispatchEvent(new Event("cateringCompletedNow"));
    window.dispatchEvent(new Event("yum:lastCompleted")); // breadcrumb event
    window.dispatchEvent(new CustomEvent("bookingsChanged", { detail: { catering: true } }));
  }, []);

  const handleBookDesserts = async () => {
    // advance to dessert start
    try { localStorage.setItem("yumStep", "dessertStyle"); } catch {}

    const user = getAuth().currentUser;
    if (user) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          "progress.yumYum.step": "dessertStyle",
        });
      } catch {}
    }

    if (onBookDessertNow) {
      try { await Promise.resolve(onBookDessertNow()); } catch {}
      return;
    }

    // fallback: close & broadcast an intent for the shell to route
    onClose?.();
    setTimeout(() => {
      try {
        localStorage.setItem("yumBookingType", "dessert");
        localStorage.setItem("yumActiveBookingType", "dessert");
      } catch {}
      window.dispatchEvent(new CustomEvent("openDesserts", { detail: { vendor: "whiskAndPaddle" } }));
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
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 700, position: "relative" }}>
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
          style={{ maxWidth: 180, margin: "0 auto 12px", borderRadius: 12, display: "block" }}
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
          <button
            className="boutique-back-btn"
            onClick={handleClose}
            style={{ width: 240 }}
          >
            🏠 Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default TubacCateringThankYou;