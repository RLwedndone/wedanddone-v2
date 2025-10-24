import React from "react";
import { auth, db } from "../../../firebase/firebaseConfig";
import { doc, setDoc } from "firebase/firestore";

interface YumReturnNoDessertProps {
  onBookDessert: () => void;
  onClose: () => void;
}

const YumReturnNoDessert: React.FC<YumReturnNoDessertProps> = ({
  onBookDessert,
  onClose,
}) => {
  return (
    // No extra overlay here — parent provides it
    <div
      className="pixie-card pixie-card--modal"
      style={{
        // widen a touch if you want; otherwise omit
        ["--pixie-card-w" as any]: "680px",
        // ensure plenty of vertical room without forcing internal scroll
        ["--pixie-card-min-h" as any]: "520px",
      }}
    >
      {/* 🩷 Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src="/assets/icons/pink_ex.png" alt="Close" />
      </button>
  
      <div
        className="pixie-card__body"
        style={{
          textAlign: "center",
          // IMPORTANT: no maxHeight/overflow here
          paddingBottom: 24, // make sure the CTA never hides behind the curve
        }}
      >
        <video
          src="/assets/videos/yum_cart.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="px-media"
          style={{ maxWidth: 300, margin: "0 auto 14px", display: "block" }}
        />
  
        <p className="px-prose-narrow" style={{ fontSize: "1.05rem", marginBottom: "1rem" }}>
          Hey there, cuisine connoisseur! <br />
          Your catering is booked and your guest count is now <strong>locked</strong>.
          <br />
          <br />
          You’ll be able to finalize it at the 45-day mark via the <em>Guest Count Scroll</em> on your dashboard.
        </p>
  
        <p className="px-prose-narrow" style={{ marginBottom: "1.25rem" }}>
          Ready to add some sweetness? Tap that little blue button below!
        </p>
  
        <button
          className="boutique-primary-btn"
          onClick={async () => {
            try { localStorage.setItem("yumStep", "dessertStyle"); } catch {}
  
            const user = auth.currentUser;
            if (user) {
              try {
                await setDoc(
                  doc(db, "users", user.uid),
                  { progress: { yumYum: { step: "dessertStyle" } } },
                  { merge: true }
                );
              } catch (err) {
                console.error("❌ Failed to update Firestore:", err);
              }
            }
  
            onBookDessert();
          }}
          style={{ width: 250, margin: "0 auto" }}
        >
          🍰 Book Dessert
        </button>
      </div>
    </div>
  );
};

export default YumReturnNoDessert;