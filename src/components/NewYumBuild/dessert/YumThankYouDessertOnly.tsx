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
    <div className="pixie-overlay">
      <div
        className="pixie-overlay-card"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          padding: "2rem",
        }}
      >
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/yum_thanks.mp4`}
          autoPlay
          loop
          muted
          playsInline
          style={{ maxWidth: "220px", width: "100%", marginBottom: "1.5rem", borderRadius: "12px" }}
        />

        <p style={{ fontSize: "1.2rem", marginBottom: "2rem" }}>
          Your dessert order is locked in and deliciousness is on the way!<br /><br />
          Your receipt and contract are saved under <strong>Documents</strong> on your dashboard.<br /><br />
          <strong>Your guest count is now locked.</strong> But don't worry! If you need to add more guests, we'll handle that when you confirm your final count. <br /><br />
          Our handy-dandy Guest Count Scroll will pop up for you <strong>45 days</strong> before your big day.
        </p>

        <div style={{ marginTop: "1.5rem", textAlign: "center", width: "100%" }}>
          <button
            onClick={handleBookCatering}
            style={{
              backgroundColor: "#2c62ba",
              color: "#fff",
              padding: "0.75rem 1.2rem",
              fontSize: "1rem",
              borderRadius: "12px",
              border: "none",
              cursor: "pointer",
              display: "block",
              width: "100%",
              maxWidth: "300px",
              margin: "0 auto 1rem",
            }}
          >
            🍽️ Book Catering
          </button>

          <button
            onClick={onClose}
            style={{
              backgroundColor: "#e98fba",
              color: "#fff",
              padding: "0.75rem 1.2rem",
              fontSize: "1rem",
              borderRadius: "12px",
              border: "none",
              cursor: "pointer",
              display: "block",
              width: "100%",
              maxWidth: "300px",
              margin: "0 auto",
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