import React, { useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { auth, db } from "../../../firebase/firebaseConfig";

interface YumThankYouProps {
  onClose: () => void;
}

const YumThankYouBothBooked: React.FC<YumThankYouProps> = ({ onClose }) => {
  // Persist "both booked"
  useEffect(() => {
    const updateBooking = async () => {
      const user = auth.currentUser;
      if (!user) return;
      try {
        await updateDoc(doc(db, "users", user.uid), {
          bookings: { catering: true, dessert: true },
        });
        console.log("✅ Full booking saved!");
      } catch (err) {
        console.error("❌ Error updating full booking:", err);
      }
    };
    updateBooking();
  }, []);

  // Sparkle sfx (non-blocking)
  useEffect(() => {
    const sparkle = new Audio("/assets/sounds/sparkle.MP3");
    sparkle.volume = 0.7;
    sparkle.play().catch((err) => console.warn("✨ Sparkle sound blocked:", err));
  }, []);

  return (
    // ⛔️ No overlay here — parent handles backdrop
    <div className="pixie-card pixie-card--modal" style={{ ["--pixie-card-w" as any]: "680px" }}>
      {/* 🩷 Pink X close */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src="/assets/icons/pink_ex.png" alt="Close" />
      </button>

      {/* Hide scrollbar but keep scrollability */}
      <style>
        {`
          .pixie-card__body {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          .pixie-card__body::-webkit-scrollbar { display: none; }
        `}
      </style>

      {/* Body */}
      <div className="pixie-card__body" style={{ textAlign: "center", maxHeight: "72vh", overflowY: "auto" }}>
        <video
          src="/assets/videos/yum_thanks.mp4"
          autoPlay
          loop
          muted
          playsInline
          className="px-media"
          style={{ maxWidth: 180, margin: "0 auto 14px", display: "block", borderRadius: 12 }}
        />

        <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
          Thank you! You’re all set ✨
        </h2>

        <p className="px-prose-narrow" style={{ fontSize: "1.05rem", marginBottom: "0.5rem" }}>
          Your catering and dessert orders are locked in and deliciousness is on the way!
        </p>
        <p className="px-prose-narrow" style={{ marginBottom: "0.5rem" }}>
          Your receipts and contracts are saved under <em>Documents</em> in your menu bar.
        </p>
        <p className="px-prose-narrow" style={{ marginBottom: "1.25rem" }}>
          Guest count changes will be handled at the <strong>45-day</strong> mark via the <em>Guest Count Scroll</em>.
        </p>

      </div>
    </div>
  );
};

export default YumThankYouBothBooked;