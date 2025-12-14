import React, { useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../../firebase/firebaseConfig";
import { YumStep } from "../yumTypes";
import { Dispatch, SetStateAction } from "react";

interface YumThankYouProps {
  onClose: () => void;
  setStep: Dispatch<SetStateAction<YumStep>>;
}

const YumThankYouCateringOnly: React.FC<YumThankYouProps> = ({ onClose, setStep }) => {
  // ✨ Play sparkle on mount
  useEffect(() => {
    const sparkle = new Audio(`${import.meta.env.BASE_URL}assets/sounds/sparkle.MP3`);
    sparkle.volume = 0.7;
    sparkle.play().catch((err) => console.warn("✨ Sparkle sound blocked:", err));
  }, []);

  // Safely record booking + local cues for the dashboard button
  const recordBooking = async () => {
    // 1) Local flags (run for guests AND logged-in users)
    try {
      // generic + legacy keys so all UIs pick it up
      localStorage.setItem("yumCateringBooked", "true");
      localStorage.setItem("yumBookedCatering", "true"); // legacy support
      // breadcrumb so the Yum button shows the *last* completed step
      localStorage.setItem("yumLastCompleted", "catering");
    } catch {}

    // 2) Fire events so listeners can update immediately
    window.dispatchEvent(new Event("purchaseMade"));
    window.dispatchEvent(new Event("cateringCompletedNow"));
    // optional breadcrumb event (dashboard listens if present)
    window.dispatchEvent(new Event("yum:lastCompleted"));

    // 3) Firestore flag (if logged in) – keep after local cues so UI flips instantly
    const user = auth.currentUser;
    if (!user) {
      console.log("ℹ️ Catering booked (guest mode) — local flags/events fired.");
      return;
    }

    try {
      await updateDoc(doc(db, "users", user.uid), {
        "bookings.catering": true, // ✅ update nested field only
      });
      console.log("✅ Catering booking recorded in Firestore!");
    } catch (err) {
      console.error("❌ Error updating catering booking:", err);
    }
  };

  // ⏱️ Record booking on mount
  useEffect(() => {
    recordBooking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBookDessert = async () => {
    await recordBooking();

    // persist next step locally and in Firestore (if logged in)
    localStorage.setItem("yumStep", "dessertStyle");
    const user = auth.currentUser;
    if (user) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          "progress.yumYum.step": "dessertStyle",
        });
      } catch (e) {
        console.warn("⚠️ Failed to save next step to Firestore:", e);
      }
    }

    setStep("dessertStyle");
  };

  const handleReturnToDashboard = async () => {
    await recordBooking();
    onClose();
  };

  return (
    // ⛔️ No overlay here — the parent flow already renders it
    <div
      className="pixie-card wd-page-turn"
      style={{
        ["--pixie-card-w" as any]: "680px",
        ["--pixie-card-min-h" as any]: "420px",
      }}
    >
      {/* 🩷 Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div
        className="pixie-card__body"
        style={{
          textAlign: "center",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "14px",
        }}
      >
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/yum_thanks.mp4`}
          autoPlay
          loop
          muted
          playsInline
          className="px-media"
          style={{ maxWidth: 220, borderRadius: 14, margin: "0 auto 6px" }}
        />

        <p className="px-prose-narrow" style={{ maxWidth: 560, margin: "0 auto 10px" }}>
          ✨ Your catering order is locked in and deliciousness is on the way! Your receipt and contract are
          saved in the <strong>Docs</strong> folder in the gold bar menu (top right).<br /><br />
          You’ll still be able to add to your guest count closer to your wedding date — so no worries if your
          numbers shift.<br /><br />
          Want to sweeten the celebration? 🎂🍩 You can hop back in anytime to book desserts and complete your menu!
        </p>

        {/* CTAs — standard width, stacked */}
        <div className="px-cta-col" style={{ marginTop: 8 }}>
          <button
            className="boutique-primary-btn"
            onClick={handleBookDessert}
            style={{ width: 250 }}
          >
            🍰 Book Dessert
          </button>
          <button
            className="boutique-back-btn"
            onClick={handleReturnToDashboard}
            style={{ width: 250 }}
          >
            🏠 Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default YumThankYouCateringOnly;