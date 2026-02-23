// src/components/VenueRanker/RankerCompleteScreen.tsx
import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { getGuestState, setGuestCount } from "../../../utils/guestCountStore";
import SaveProgressMini from "../SaveProgressMini";
import { auth } from "../../../firebase/firebaseConfig";
import { ph } from "../../../utils/posthogTrack";

interface RankerCompleteScreenProps {
  weddingDateSet: boolean;
  guestCountSet: boolean;

  // ✅ NEW: direct booking vs ranking flow
  isDirectBooking: boolean;

  onStartScroll: () => void;
  onEditRankings: () => void;
  onClose: () => void;
  onSaveProgress: () => void;
}

const RankerCompleteScreen: React.FC<RankerCompleteScreenProps> = ({
  weddingDateSet,
  guestCountSet,
  isDirectBooking,
  onStartScroll,
  onEditRankings,
  onClose,
  onSaveProgress,
  
}) => {

    // ───────────────────────── Local form state ─────────────────────────
    const [dateValue, setDateValue] = useState<string>(
      () =>
        localStorage.getItem("venueWeddingDate") ||
        localStorage.getItem("weddingDate") ||
        ""
    );
  
    const [guestValue, setGuestValue] = useState<number>(() => {
      const ls = Number(localStorage.getItem("guestCount") || 0);
      return ls || 0;
    });
  
    const [guestLocked, setGuestLocked] = useState(false);
    const [loadingGuest, setLoadingGuest] = useState(true);
  
    // Pull guest count from the single source of truth so we don't drift
    useEffect(() => {
      let mounted = true;
  
      (async () => {
        const st = await getGuestState();
        if (!mounted) return;
        setGuestValue(Number(st.value || 0));
        setGuestLocked(!!st.locked);
        setLoadingGuest(false);
      })();
  
      const sync = async () => {
        const st = await getGuestState();
        if (!mounted) return;
        setGuestValue(Number(st.value || 0));
        setGuestLocked(!!st.locked);
      };
  
      window.addEventListener("guestCountUpdated", sync);
      window.addEventListener("guestCountLocked", sync);
      window.addEventListener("guestCountUnlocked", sync);
  
      return () => {
        mounted = false;
        window.removeEventListener("guestCountUpdated", sync);
        window.removeEventListener("guestCountLocked", sync);
        window.removeEventListener("guestCountUnlocked", sync);
      };
    }, []);

    const handleStartScroll = async () => {
      // 0) Guardrails: require date + guest count
      const chosenDate = (dateValue || "").trim();
      const chosenGuests = Number(guestValue || 0);
  
      if (!chosenDate) {
        alert("Pick your wedding date first 🗓️");
        return;
      }
      if (!chosenGuests) {
        alert("Pick your guest count first 👯");
        return;
      }
  
      // 1) Persist date in the SAME keys CastleModal checks
      try {
        localStorage.setItem("venueWeddingDate", chosenDate);
        localStorage.setItem("weddingDate", chosenDate);
      } catch {}
  
      // 2) Persist guest count via the global store (LS + Firestore if logged in)
      try {
        await setGuestCount(chosenGuests);
      } catch {}
  
      // 3) Local “completed” marker
      try {
        localStorage.setItem("rankerCompleted", "true");
        localStorage.setItem("rankerLastStep", "scroll");
      } catch {}
  
      // 4) Persist for signed-in users
      const user = getAuth().currentUser;
      if (user) {
        try {
          await updateDoc(doc(db, "users", user.uid), {
            weddingDate: chosenDate,
            guestCount: chosenGuests,
            "progress.ranker.completed": true,
            "progress.ranker.last": "scroll",
            "progress.ranker.updatedAt": serverTimestamp(),
          });
        } catch (e) {
          console.warn("Could not save ranker completion/date/guestCount:", e);
        }
      }
  
      onStartScroll();
    };

    const device = window.innerWidth < 480 ? "mobile" : "desktop";

    useEffect(() => {
      ph("vr_ranker_complete_viewed", {
        device,
        is_logged_in: !!auth.currentUser,
        source: "venueRanker",
        flow: isDirectBooking ? "direct_booking" : "ranking",
      });
      // fire once on mount
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

<SaveProgressMini onClick={onSaveProgress} />

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

                {/* ───────────────────────── Date + Guests (mini sections) ───────────────────────── */}
                <div
          style={{
            display: "grid",
            gap: 18,
            maxWidth: 520,
            margin: "0 auto 10px",
          }}
        >
          {/* Date section */}
          <div style={{ textAlign: "center", paddingTop: 4 }}></div>
            <video
              autoPlay
              loop
              muted
              playsInline
              src={`${import.meta.env.BASE_URL}assets/videos/calendar_loop.mp4`}
              style={{
                width: 180,
                height: 180,
                borderRadius: 14,
                margin: "0 auto 10px",
                display: "block",
              }}
            />
            <div style={{ fontWeight: 800, marginBottom: 8, fontSize: "1.05rem" }}>
              Wedding Date

            <input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              style={{
                width: "100%",
                maxWidth: 320,
                padding: "0.7rem",
                borderRadius: 12,
                border: "1px solid #ddd",
                fontSize: "1rem",
                fontFamily: "'Nunito', sans-serif",
              }}
            />

            <div style={{ marginTop: 8, fontSize: ".9rem", color: "#666" }}>
              We’ll use this to check availability + pricing.
            </div>
          </div>

          {/* Guest section */}
          <div style={{ textAlign: "center", paddingTop: 8 }}>
            <video
              autoPlay
              loop
              muted
              playsInline
              src={`${import.meta.env.BASE_URL}assets/videos/wedding_guests.mp4`}
              style={{
                width: 180,
                height: 180,
                borderRadius: 14,
                margin: "0 auto 10px",
                display: "block",
              }}
            />
            <div style={{ fontWeight: 800, marginBottom: 8, fontSize: "1.05rem" }}>
              Guest Count
            </div>

            {loadingGuest ? null : guestLocked ? (
              <>
                <div style={{ fontSize: "1rem" }}>
                  Locked at <b>{guestValue}</b> guests
                </div>
                <div style={{ marginTop: 8, fontSize: ".9rem", color: "#666" }}>
                  Your guest count is locked due to an existing booking.
                </div>
              </>
            ) : (
              <>
                <select
                  value={guestValue || ""}
                  onChange={(e) => setGuestValue(Number(e.target.value))}
                  style={{
                    width: "100%",
                    maxWidth: 320,
                    padding: "0.7rem",
                    borderRadius: 12,
                    border: "1px solid #ddd",
                    fontSize: "1rem",
                    fontFamily: "'Nunito', sans-serif",
                    background: "#fff",
                  }}
                >
                  <option value="" disabled>
                    Select guest count
                  </option>
                  {[25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300].map((n) => (
                    <option key={n} value={n}>
                      {n} guests
                    </option>
                  ))}
                </select>

                <div style={{ marginTop: 8, fontSize: ".9rem", color: "#666" }}>
                  We’ll use this number for price tiers + capacity checks.
                </div>
              </>
            )}
          </div>
        </div>

        {/* ───────────────────────── CTAs (moved below the two sections) ───────────────────────── */}
        <div className="px-cta-col" style={{ marginTop: 10 }}>
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