// src/components/NameCapture.tsx
import React, { useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

interface NameCaptureProps {
  initialFirst?: string;
  initialLast?: string;
  onDone: () => void; // call this after saving names
  onClose?: () => void; // optional X button, if you want
}

const NameCapture: React.FC<NameCaptureProps> = ({
  initialFirst = "",
  initialLast = "",
  onDone,
  onClose,
}) => {
  const [firstName, setFirstName] = useState(initialFirst);
  const [lastName, setLastName] = useState(initialLast);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const handleSave = async () => {
    const auth = getAuth();
    const user = auth.currentUser;
    if (!user) {
      setErr("Not signed in.");
      return;
    }
    if (!firstName.trim() || !lastName.trim()) {
      setErr("Please enter your first and last name.");
      return;
    }

    setSaving(true);
    setErr("");
    try {
      await updateDoc(doc(db, "users", user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });

      onDone(); // ✅ tell parent we're good now
    } catch (e: any) {
      console.error("[NameCapture] failed:", e);
      setErr("Could not save your name. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="pixie-overlay"
      style={{ zIndex: 3000 }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="pixie-card pixie-card--modal"
        style={{ maxWidth: 420 }}
      >
        {onClose && (
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
        )}

        <div className="pixie-card__body" style={{ textAlign: "center" }}>
          <h2 className="px-title-lg" style={{ marginBottom: "0.5rem" }}>
            We just need your name ✍️
          </h2>
          <p className="px-prose-narrow" style={{ marginBottom: "1rem" }}>
            We use this on your agreements and receipts.
          </p>

          <div
            style={{
              display: "grid",
              gap: "12px",
              maxWidth: 300,
              margin: "0 auto 1rem",
            }}
          >
            <input
              className="px-input"
              placeholder="First Name"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              style={{ textAlign: "center" }}
            />
            <input
              className="px-input"
              placeholder="Last Name"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              style={{ textAlign: "center" }}
            />
          </div>

          {err && (
            <p style={{ color: "#e53935", marginBottom: "1rem", fontWeight: 600 }}>
              {err}
            </p>
          )}

          <button
            className="boutique-primary-btn"
            onClick={handleSave}
            disabled={saving || !firstName.trim() || !lastName.trim()}
            style={{
              width: "80%",
              maxWidth: 260,
              margin: "0 auto 1rem",
            }}
          >
            Save & Continue
          </button>

          <p
            className="px-prose-narrow"
            style={{
              fontSize: ".8rem",
              color: "#666",
              lineHeight: 1.4,
            }}
          >
            This only shows once.
          </p>
        </div>
      </div>
    </div>
  );
};

export default NameCapture;