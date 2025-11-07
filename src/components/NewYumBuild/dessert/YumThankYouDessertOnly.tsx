import React, { useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../../firebase/firebaseConfig";
import { YumStep } from "../yumTypes";

interface YumThankYouProps {
  onClose: () => void;
  setStep: (step: YumStep) => void;
}

const YumThankYouDessertOnly: React.FC<YumThankYouProps> = ({ onClose, setStep }) => {
  // Record the booking once on mount
  useEffect(() => {
    const updateBooking = async () => {
      // 1) Local flags first (works for guests + instant UI flip)
      try {
        localStorage.setItem("yumDessertBooked", "true");   // new generic
        localStorage.setItem("yumBookedDessert", "true");   // legacy support
        localStorage.setItem("yumLastCompleted", "dessert"); // breadcrumb for HUD button
      } catch {}

      // 2) Notify app parts that listen for completion
      window.dispatchEvent(new Event("purchaseMade"));
      window.dispatchEvent(new Event("dessertCompletedNow"));
      window.dispatchEvent(new Event("yum:lastCompleted")); // optional breadcrumb event

      // 3) Firestore update (if logged in)
      const user = auth.currentUser;
      if (user) {
        try {
          await updateDoc(doc(db, "users", user.uid), {
            "bookings.dessert": true, // ✅ don't clobber other bookings
          });
          console.log("✅ Dessert booking recorded in Firestore!");
        } catch (err) {
          console.error("❌ Error updating dessert booking:", err);
        }
      } else {
        console.log("ℹ️ Dessert booked (guest mode) — local flags/events fired.");
      }
    };

    updateBooking();
  }, []);

  // Sparkle ✨
  useEffect(() => {
    const sparkle = new Audio(`${import.meta.env.BASE_URL}assets/sounds/sparkle.MP3`);
    sparkle.volume = 0.7;
    sparkle.play().catch((err) => console.warn("✨ Sparkle sound blocked:", err));
  }, []);

  // Handlers
  const handleBookCatering = async () => {
    // Persist next step locally and in Firestore (if logged in)
    localStorage.setItem("yumStep", "cateringCuisine");
    const user = auth.currentUser;
    if (user) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          "progress.yumYum.step": "cateringCuisine",
        });
      } catch (e) {
        console.warn("⚠️ Failed to save next step to Firestore:", e);
      }
    }
    setStep("cateringCuisine");
  };

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 700 }}>
      {/* 🩷 Pink X Close */}
      <button
        className="pixie-card__close"
        onClick={onClose}
        aria-label="Close"
      >
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
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
            maxWidth: 240,
            width: "100%",
            margin: "0 auto 1.5rem",
            borderRadius: 12,
            display: "block",
          }}
        />
  
        <h2
          className="px-title-lg"
          style={{
            marginBottom: 16,
            color: "#2c62ba",
            fontFamily: "'Jenna Sue', cursive",
          }}
        >
          Dessert Booked & Beautiful!
        </h2>
  
        <p
          className="px-prose-narrow"
          style={{
            fontSize: "1.1rem",
            marginBottom: "2rem",
            maxWidth: 560,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          Your dessert order is locked in and deliciousness is on the way! <br />
          <br />
          Your receipt and contract are saved under{" "}
          <strong>Documents</strong> on your dashboard. <br />
          <br />
          <strong>Your guest count is now locked.</strong> But don’t worry —
          if you need to add more guests, we’ll handle that when you confirm your
          final count about <strong>45 days</strong> before your big day.
        </p>
  
        {/* ✅ Stacked Buttons */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.75rem",
            width: "100%",
          }}
        >
          <button
            onClick={handleBookCatering}
            className="boutique-primary-btn"
            style={{
              width: 280,
            }}
          >
            🍽️ Book Catering
          </button>
  
          <button
            onClick={onClose}
            className="boutique-back-btn"
            style={{
              width: 280,
            }}
          >
            🏠 Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default YumThankYouDessertOnly;