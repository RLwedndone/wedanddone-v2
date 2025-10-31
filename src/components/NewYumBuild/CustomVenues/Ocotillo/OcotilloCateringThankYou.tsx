// src/components/NewYumBuild/CustomVenues/Ocotillo/OcotilloCateringThankYou.tsx
import React, { useEffect } from "react";
import { getAuth } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import playMagicSound from "../../../../utils/playMagicSound";

type Props = {
  onContinueDesserts: () => void | Promise<void>;
  onClose: () => void;
};

const OcotilloCateringThankYou: React.FC<Props> = ({
  onContinueDesserts,
  onClose,
}) => {
  // fire sparkle, save progress, notify listeners
  useEffect(() => {
    // 1) ✨ sound
    try {
      const r = playMagicSound() as void | Promise<void>;
      Promise.resolve(r).catch(() => {
        /* ignore */
      });
    } catch {
      /* ignore */
    }

    // 2) state flags for re-entry + dashboard + overlay routing
    try {
      localStorage.setItem("ocotilloCateringBooked", "true");
      localStorage.setItem("ocotilloJustBookedCatering", "true");
      localStorage.setItem("yumStep", "ocotilloCateringThankYou");
    } catch {
      /* ignore */
    }

    const user = getAuth().currentUser;
    if (user) {
      updateDoc(doc(db, "users", user.uid), {
        "progress.yumYum.step": "ocotilloCateringThankYou",
      }).catch(() => {});
    }

    // 3) global events so:
    // - Budget Wand updates
    // - Dashboard badges flip to "done"
    // - anything listening for fresh catering booking fires
    window.dispatchEvent(new Event("purchaseMade"));
    window.dispatchEvent(new Event("cateringCompletedNow"));
    window.dispatchEvent(
      new CustomEvent("bookingsChanged", {
        detail: { catering: true },
      })
    );
  }, []);

  const handleBookDesserts = () => {
    // jump straight into dessert flow
    try {
      localStorage.setItem("yumStep", "dessertStyle");
    } catch {
      /* ignore */
    }
    Promise.resolve(onContinueDesserts?.()).catch(() => {});
  };

  const handleClose = () => {
    // prevent reopening this TY screen on overlay mount
    try {
      localStorage.setItem("yumStep", "home");
    } catch {
      /* ignore */
    }
    onClose();
  };

  return (
    <div className="pixie-overlay" style={overlayStyle}>
      <div className="pixie-overlay-card" style={cardStyle}>
        {/* Close X */}
        <button
          onClick={handleClose}
          aria-label="Close"
          style={closeBtnStyle}
        >
          ✖
        </button>

        {/* lil victory animation */}
        <div style={{ display: "flex", justifyContent: "center" }}>
          <video
            src={`${import.meta.env.BASE_URL}assets/videos/yum_thanks.mp4`}
            autoPlay
            loop
            muted
            playsInline
            style={{
              maxWidth: 180,
              width: "100%",
              borderRadius: 18,
            }}
          />
        </div>

        <h2 style={h2Style}>Catering Locked & Confirmed!</h2>

        <p style={pStyle}>
          You’re officially on Ocotillo’s books. 🥂
          <br />
          Your receipt + catering agreement just landed in your{" "}
          <em>Documents</em> folder.
        </p>

        <p style={pStyle}>
          Want to lock in dessert magic too?
          <br />
          Click below to build your sweet table.
        </p>

        <button onClick={handleBookDesserts} style={dessertCtaStyle}>
          <span role="img" aria-label="cake">
            🍰
          </span>{" "}
          Book Desserts
        </button>

        <button onClick={handleClose} style={homeBtnStyle}>
          <span role="img" aria-label="home">
            🏠
          </span>{" "}
          Return to Dashboard
        </button>

        <div style={{ height: "env(safe-area-inset-bottom, 12px)" }} />
      </div>
    </div>
  );
};

// ---- Styles (same pattern as Vic/Verrado/Bates thank you) ----
const overlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  backgroundColor: "rgba(0,0,0,0.35)",
  zIndex: 1000,
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  overflowY: "auto",
  padding: 16,
};

const cardStyle: React.CSSProperties = {
  background: "#fff",
  width: "min(680px, 94vw)",
  maxHeight: "90vh",
  overflowY: "auto",
  overflowX: "hidden",
  boxSizing: "border-box",
  borderRadius: 18,
  boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
  padding: "22px 20px 28px",
  position: "relative",
  display: "flex",
  flexDirection: "column",
  alignItems: "stretch",
  gap: 12,
};

const closeBtnStyle: React.CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  background: "none",
  border: "none",
  fontSize: "1.25rem",
  cursor: "pointer",
  lineHeight: 1,
};

const h2Style: React.CSSProperties = {
  color: "#2c62ba",
  fontSize: "2rem",
  margin: 0,
  textAlign: "center",
  fontFamily: "'Jenna Sue', cursive",
};

const pStyle: React.CSSProperties = {
  fontSize: "1.05rem",
  margin: "0 0 0.85rem",
  textAlign: "center",
  lineHeight: 1.4,
};

const dessertCtaStyle: React.CSSProperties = {
  backgroundColor: "#e98fba",
  color: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  height: 48,
  padding: "0 18px",
  fontSize: "1rem",
  fontWeight: 700,
  lineHeight: 1,
  borderRadius: 12,
  border: "none",
  cursor: "pointer",
  width: "100%",
  maxWidth: 240,
  margin: "0 auto .5rem",
};

const homeBtnStyle: React.CSSProperties = {
  backgroundColor: "#2c62ba",
  color: "#fff",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  height: 48,
  padding: "0 18px",
  fontSize: "1rem",
  fontWeight: 700,
  lineHeight: 1,
  borderRadius: 12,
  border: "none",
  cursor: "pointer",
  width: "100%",
  maxWidth: 240,
  margin: "0 auto 0",
};

export default OcotilloCateringThankYou;