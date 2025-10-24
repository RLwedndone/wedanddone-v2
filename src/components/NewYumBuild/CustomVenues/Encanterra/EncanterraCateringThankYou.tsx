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
    // 1) Chime
    try {
      const r = playMagicSound() as void | Promise<void>;
      Promise.resolve(r).catch(() => {});
    } catch {}

    // 2) Local flags + Firestore progress
    try {
      localStorage.setItem("encCateringBooked", "true");
      localStorage.setItem("encJustBookedCatering", "true");
      localStorage.setItem("yumStep", "encanterraCateringThankYou");
    } catch {}

    const user = getAuth().currentUser;
    if (user) {
      updateDoc(doc(db, "users", user.uid), {
        "progress.yumYum.step": "encanterraCateringThankYou",
      }).catch(() => {});
    }

    // 3) Fan-out events
    window.dispatchEvent(new Event("purchaseMade"));
    window.dispatchEvent(new Event("cateringCompletedNow"));
    window.dispatchEvent(new CustomEvent("bookingsChanged", { detail: { catering: true } }));
  }, []);

  const handleBookDesserts = () => {
    // Keep linear flow: start desserts at dessertStyle (parity with your Encanterra flow)
    try {
      localStorage.setItem("yumStep", "dessertStyle");
    } catch {}
    Promise.resolve(onContinueDesserts?.()).catch(() => {});
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