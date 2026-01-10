// src/components/VenueRanker/RankerCompleteScreen.tsx
import React from "react";
import { getAuth } from "firebase/auth";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

interface RankerCompleteScreenProps {
  weddingDateSet: boolean;
  guestCountSet: boolean;

  // ✅ NEW: direct booking vs ranking flow
  isDirectBooking: boolean;

  onStartScroll: () => void;
  onEditRankings: () => void;
  onClose: () => void;
}

const RankerCompleteScreen: React.FC<RankerCompleteScreenProps> = ({
  weddingDateSet,
  guestCountSet,
  isDirectBooking,
  onStartScroll,
  onEditRankings,
  onClose,
}) => {
  const handleStartScroll = async () => {
    // Local “completed” marker
    try {
      localStorage.setItem("rankerCompleted", "true");
      localStorage.setItem("rankerLastStep", "scroll");
    } catch {}

    // Persist for signed-in users
    const user = getAuth().currentUser;
    if (user) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          "progress.ranker.completed": true,
          "progress.ranker.last": "scroll",
          "progress.ranker.updatedAt": serverTimestamp(),
        });
      } catch (e) {
        console.warn("Could not mark ranker completed:", e);
      }
    }

    onStartScroll();
  };

  return (
    <div className="pixie-card wd-page-turn">
      {/* 🩷 Pink close (standard) */}
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
        {/* 🎉 Mini looping congrats video */}
        <video
          autoPlay
          loop
          muted
          playsInline
          src={`${import.meta.env.BASE_URL}assets/videos/ranker_complete.mp4`}
          style={{
            width: "100%",
            maxWidth: 300,
            borderRadius: 16,
            margin: "0 auto 1.25rem",
            display: "block",
          }}
        />

        {/* Title */}
        <h2 className="px-title px-title--lg" style={{ marginBottom: 12 }}>
          {isDirectBooking
            ? "Perfect! Let’s get you ready to book."
            : "Woohoo! You’ve ranked your favorite venues!"}
        </h2>

        {/* Copy */}
        <p className="px-prose-narrow" style={{ margin: "0 auto 18px" }}>
          {isDirectBooking ? (
            <>
              Next, we’ll lock in your guest count and wedding date so we can show
              you the exact booking details for your chosen venue — then you’ll be
              one step away from making it official.
            </>
          ) : (
            <>
              Based on your rankings, we’ve prepared your magical scroll of
              possibilities. Let’s lock in your guest count and wedding date so we
              can show you the best fits!
            </>
          )}
        </p>

        {/* CTAs (standard buttons) */}
        <div className="px-cta-col" style={{ marginTop: 8 }}>
          <button className="boutique-primary-btn" onClick={handleStartScroll}>
            Show Me the Magical Options!
          </button>

          <button className="boutique-back-btn" onClick={onEditRankings}>
            {isDirectBooking ? "← Back to the beginning" : "← Check Other Vibes"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RankerCompleteScreen;