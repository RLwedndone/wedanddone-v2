// src/components/NewYumBuild/CustomVenues/VicandVerrado/VicVerradoCateringThankYou.tsx
import React, { useEffect } from "react";
import { getAuth } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import playMagicSound from "../../../../utils/playMagicSound";

type Props = {
  onContinueDesserts: () => void | Promise<void>;
  onClose: () => void;
};

const VicVerradoCateringThankYou: React.FC<Props> = ({ onContinueDesserts, onClose }) => {
  // Match Bates behavior: play chime, pin progress, fire events
  useEffect(() => {
    // 1) Chime
    try {
      const r = playMagicSound() as void | Promise<void>;
      Promise.resolve(r).catch(() => {/* ignore */});
    } catch {/* ignore */}

    // 2) Local flags + Firestore progress
    try {
      localStorage.setItem("vvCateringBooked", "true");
      localStorage.setItem("vvJustBookedCatering", "true");
      localStorage.setItem("yumStep", "vicVerradoCateringThankYou");
    } catch {}

    const user = getAuth().currentUser;
    if (user) {
      updateDoc(doc(db, "users", user.uid), {
        "progress.yumYum.step": "vicVerradoCateringThankYou",
      }).catch(() => {});
    }

    // 3) Fan-out events
    window.dispatchEvent(new Event("purchaseMade"));
    window.dispatchEvent(new Event("cateringCompletedNow"));
    window.dispatchEvent(new CustomEvent("bookingsChanged", { detail: { catering: true } }));
  }, []);

  const handleBookDesserts = () => {
    // Keep VV linear flow: start at dessertStyle
    try { localStorage.setItem("yumStep", "dessertStyle"); } catch {}
    Promise.resolve(onContinueDesserts?.()).catch(() => {});
  };

  const handleClose = () => {
    // Neutralize so we don’t reopen TY on overlay launch
    try { localStorage.setItem("yumStep", "home"); } catch {}
    onClose();
  };

  return (
    <div className="pixie-overlay" style={overlayStyle}>
      <div className="pixie-overlay-card" style={cardStyle}>
        <button onClick={handleClose} aria-label="Close" style={closeBtnStyle}>✖</button>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <video
            src="/assets/videos/yum_thanks.mp4"
            autoPlay
            loop
            muted
            playsInline
            style={{ maxWidth: 180, width: "100%", borderRadius: 18 }}
          />
        </div>

        <h2 style={h2Style}>Catering Locked & Confirmed!</h2>
        <p style={pStyle}>You'll find your receipt and selection confirmation in your <em>Documents</em> folder.</p>
        <p style={pStyle}>Ready to add a sweet finish? Click the little button below to book desserts!</p>

        <button onClick={handleBookDesserts} style={dessertCtaStyle}>
          <span role="img" aria-label="cake">🍰</span> Book Desserts
        </button>

        <button onClick={handleClose} style={homeBtnStyle}>
          <span role="img" aria-label="home">🏠</span> Return to Dashboard
        </button>

        <div style={{ height: "env(safe-area-inset-bottom, 12px)" }} />
      </div>
    </div>
  );
};

// ---- Styles (mirroring Bates) ----
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
};

const pStyle: React.CSSProperties = {
  fontSize: "1.05rem",
  margin: "0 0 0.85rem",
  textAlign: "center",
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

export default VicVerradoCateringThankYou;