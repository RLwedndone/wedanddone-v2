// src/components/NewYumBuild/CustomVenues/VicandVerrado/VicVerradoBothDoneThankYou.tsx
import React, { useEffect } from "react";
import { getAuth } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import playMagicSound from "../../../../utils/playMagicSound";

interface Props {
  onClose: () => void;
}

const VicVerradoBothDoneThankYou: React.FC<Props> = ({ onClose }) => {
  useEffect(() => {
    // Chime (safe if it fires again on reopen)
    try {
      const res = playMagicSound() as void | Promise<void>;
      Promise.resolve(res).catch(() => {});
    } catch {}

    // Pin progress (this screen shows when both are booked)
    try {
      localStorage.setItem("yumStep", "vicVerradoBothDoneThankYou");
    } catch {}

    const user = getAuth().currentUser;
    if (user) {
      updateDoc(doc(db, "users", user.uid), {
        "progress.yumYum.step": "vicVerradoBothDoneThankYou",
      }).catch(() => {});
    }
  }, []);

  const handleClose = () => {
    try {
      localStorage.setItem("yumStep", "home");
      localStorage.removeItem("vvYumStep");
      window.dispatchEvent(new Event("yumStepChanged"));
    } catch {}
    onClose();
  };

  return (
    <div className="pixie-overlay" style={overlayStyle}>
      <div className="pixie-overlay-card" style={cardStyle}>
        <button onClick={handleClose} aria-label="Close" style={closeBtnStyle}>✖</button>

        <div style={{ display: "flex", justifyContent: "center" }}>
          <video
            src={`${import.meta.env.BASE_URL}assets/videos/yum_thanks.mp4`}
            autoPlay
            loop
            muted
            playsInline
            style={{ maxWidth: 180, width: "100%", borderRadius: 18 }}
          />
        </div>

        <h2 style={h2Style}>Catering & Desserts — All Set! 🎉</h2>
        <p style={pStyle}>
          You’re officially booked for both! Your receipts and agreements live in <em>Documents</em>.
        </p>
        <p style={pStyle}>
          Keep the momentum going—peek at the other boutiques and knock out the rest of that checklist!
        </p>

        <button type="button" onClick={handleClose} style={homeBtnStyle}>
          <span role="img" aria-label="home">🏠</span> Return to Dashboard
        </button>

        <div style={{ height: "env(safe-area-inset-bottom, 12px)" }} />
      </div>
    </div>
  );
};

// --- styles (same as Bates) ---
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
const h2Style: React.CSSProperties = { color: "#2c62ba", fontSize: "2rem", margin: 0, textAlign: "center" };
const pStyle: React.CSSProperties = { fontSize: "1.05rem", margin: "0 0 .85rem", textAlign: "center" };
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

export default VicVerradoBothDoneThankYou;