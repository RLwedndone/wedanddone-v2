import React from "react";
import { auth, db } from "../../../firebase/firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";

interface YumReturnNoCateringProps {
  onBookCatering: () => void;
  onClose: () => void; // ✅ added to match other return screens
}

const YumReturnNoCatering: React.FC<YumReturnNoCateringProps> = ({
  onBookCatering,
  onClose,
}) => {
  const goToCatering = async () => {
    // Persist the next step locally
    localStorage.setItem("yumStep", "cateringCuisine");

    // If signed in, also persist progress in Firestore
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

    onBookCatering();
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "auto",
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: "2rem",
          borderRadius: "18px",
          maxWidth: "600px",
          width: "90%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
          textAlign: "center",
          position: "relative",
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            fontSize: "1.25rem",
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "#333",
          }}
          aria-label="Close"
        >
          ✖
        </button>

        <video
          src="/assets/videos/yum_cart.mp4"
          autoPlay
          loop
          muted
          playsInline
          style={{ maxWidth: "300px", width: "100%", marginBottom: "1.5rem", borderRadius: "12px" }}
        />

        <p style={{ fontSize: "1.2rem", marginTop: "1rem" }}>
          Sweet tooth: satisfied! Your dessert order is locked in. <br /><br />
          Heads up — your <strong>guest count is now locked</strong>. You’ll be able to make
          any changes at the 45-day mark using the <em>Guest Count Scroll</em> on your dashboard.
          <br /><br />
          Ready to book your catering?
        </p>

        <div style={{ marginTop: "2rem", display: "flex", gap: "1rem", justifyContent: "center" }}>
          <button
            onClick={goToCatering}
            style={{
              backgroundColor: "#2c62ba",
              color: "#fff",
              padding: "0.75rem 1.5rem",
              fontSize: "1rem",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
            }}
          >
            🍽️ Book Catering
          </button>

          <button
            onClick={onClose}
            style={{
              backgroundColor: "#e98fba",
              color: "#fff",
              padding: "0.75rem 1.5rem",
              fontSize: "1rem",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
            }}
          >
            🏠 Return to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
};

export default YumReturnNoCatering;