// src/components/VenueRanker/SaveProgressMini.tsx
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { auth } from "../../firebase/firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";

interface SaveProgressMiniProps {
  onClick: () => void; // open account modal
}

const SaveProgressMini: React.FC<SaveProgressMiniProps> = ({ onClick }) => {
  const [isAuthed, setIsAuthed] = useState<boolean>(!!auth.currentUser);
  const [showPrompt, setShowPrompt] = useState(false);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => setIsAuthed(!!u));
    return () => unsub();
  }, []);

  // ✅ If logged in, show a "Saved" badge (not clickable)
  if (isAuthed) {
    return (
      <div
        aria-label="Progress saved"
        title="Your progress is saved"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          opacity: 0.95,
          pointerEvents: "none",
        }}
      >
        <img
          src={`${import.meta.env.BASE_URL}assets/images/save_disk_check.png`}
          alt="Saved"
          style={{ width: 44, height: 44 }}
        />
      </div>
    );
  }

  return (
    <>
      {/* Disk Icon (inline now — NOT bottom-left) */}
      <button
        ref={btnRef}
        type="button"
        onClick={() => {
          if (isAuthed) return;
          setShowPrompt(true);
        }}
        style={{
          width: 54,
          height: 54,
          padding: 0,
          border: "none",
          background: "transparent",
          cursor: "pointer",
          opacity: 0.95,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
        aria-label={isAuthed ? "Progress is saved" : "Save my progress"}
        title={isAuthed ? "Saved to your account" : "Save my progress"}
      >
        <img
          src={`${import.meta.env.BASE_URL}assets/images/save_disk%20copy.png`}
          alt=""
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            filter: "drop-shadow(0 10px 16px rgba(0,0,0,0.18))",
          }}
        />
      </button>

      {/* Mini explainer card (PORTAL to body so it beats transformed/stacking contexts) */}
      {showPrompt &&
        !isAuthed &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 20000,
              background: "rgba(0,0,0,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 18,
              boxSizing: "border-box",
            }}
            onClick={() => setShowPrompt(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Save your progress"
          >
            <div
              style={{
                width: "100%",
                maxWidth: 420,
                background: "#fff",
                borderRadius: 18,
                border: "1px solid #eee",
                boxShadow: "0 18px 45px rgba(0,0,0,0.22)",
                padding: "18px 18px",
                textAlign: "center",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={`${import.meta.env.BASE_URL}assets/images/save_disk%20copy.png`}
                alt=""
                style={{
                  width: 64,
                  height: 64,
                  objectFit: "contain",
                  marginBottom: 10,
                  filter: "drop-shadow(0 10px 16px rgba(0,0,0,0.16))",
                }}
              />

              <div style={{ fontWeight: 900, fontSize: "1.2rem", marginBottom: 8 }}>
                Want to save your progress?
              </div>

              <div
                style={{
                  fontSize: "0.98rem",
                  color: "#444",
                  lineHeight: 1.4,
                  maxWidth: 340,
                  margin: "0 auto 14px",
                }}
              >
                Make an account <br />
                so we can save your venue matches.
              </div>

              <div style={{ display: "grid", gap: 10, marginTop: 6, justifyItems: "center" }}>
                <button
                  type="button"
                  className="boutique-primary-btn"
                  onClick={() => {
                    setShowPrompt(false);
                    onClick();
                  }}
                  style={{ width: "50%" }}
                >
                  Save
                </button>

                <button
                  type="button"
                  className="boutique-back-btn"
                  onClick={() => setShowPrompt(false)}
                  style={{ width: "50%" }}
                >
                  Not now
                </button>
              </div>

              <div style={{ marginTop: 10, fontSize: "0.9rem", color: "#777" }}>
                You’ll come right back to your venue matches after.
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
};

export default SaveProgressMini;