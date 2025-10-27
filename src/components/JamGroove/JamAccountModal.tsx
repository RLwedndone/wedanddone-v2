// src/components/jam/JamAccountModal.tsx
import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { saveUserProfile } from "../../utils/saveUserProfile";

interface JamAccountModalProps {
  onSuccess: () => void;
  onClose: () => void;
  currentStep: string;
}

const JamAccountModal: React.FC<JamAccountModalProps> = ({ onSuccess, onClose, currentStep }) => {
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [error,     setError]     = useState("");

  const auth = getAuth();

  // carry over any guest Jam data after signup
  const migrateGuestJamGrooveData = async (uid: string) => {
    const userRef = doc(db, "users", uid);
    const jamGrooveData: any = {};

    const guestProgress   = localStorage.getItem("jamGrooveProgress");
    const cocktailMusic   = localStorage.getItem("cocktailMusic");
    const processional    = localStorage.getItem("ceremonyOrder");

    if (guestProgress) {
      jamGrooveData.progress = JSON.parse(guestProgress);
      localStorage.removeItem("jamGrooveProgress");
    }
    if (cocktailMusic) {
      jamGrooveData.cocktailMusic = cocktailMusic;
      localStorage.removeItem("cocktailMusic");
    }
    if (processional) {
      jamGrooveData.ceremonyOrder = JSON.parse(processional);
      localStorage.removeItem("ceremonyOrder");
    }

    if (Object.keys(jamGrooveData).length > 0) {
      await setDoc(userRef, { jamGroove: jamGrooveData }, { merge: true });
    }
  };

  const handleSignup = async () => {
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCred.user, { displayName: `${firstName} ${lastName}` });

      await saveUserProfile({ firstName, lastName, email, uid: userCred.user.uid });

      await setDoc(
        doc(db, "users", userCred.user.uid),
        { jamGrooveSavedStep: currentStep || "intro" },
        { merge: true }
      );

      await migrateGuestJamGrooveData(userCred.user.uid);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      await saveUserProfile({
        firstName,
        lastName,
        email: result.user.email || "",
        uid: result.user.uid,
      });

      await setDoc(
        doc(db, "users", result.user.uid),
        { jamGrooveSavedStep: currentStep || "intro" },
        { merge: true }
      );

      await migrateGuestJamGrooveData(result.user.uid);
      onSuccess();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    // Backdrop + proper stacking (click outside to close)
    <div
      className="pixie-overlay"
      style={{ zIndex: 2000 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Card */}
      <div className="pixie-card" onClick={(e) => e.stopPropagation()}>
        {/* Pink X */}
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
        </button>

        <div className="pixie-card__body" style={{ textAlign: "center" }}>
          {/* Header image */}
          <img
            src={`${import.meta.env.BASE_URL}assets/images/account_bar.png`}
            alt="Account"
            className="px-media"
            style={{ maxWidth: 240, marginBottom: "1rem" }}
          />

          {/* Title + copy */}
          <h2 className="px-title-lg" style={{ marginBottom: "0.5rem" }}>
            Ready to rock the perfect soundtrack?
          </h2>
          <p className="px-prose-narrow" style={{ marginBottom: "1.25rem" }}>
            Create an account to save your groove and pick up anytime.
          </p>

          {/* Inputs */}
          <div style={{ width: "100%", maxWidth: 440, margin: "0 auto 1.25rem" }}>
            <div style={{ display: "grid", gap: 12 }}>
              <input
                className="px-input"
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
              <input
                className="px-input"
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
              <input
                className="px-input"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <input
                className="px-input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && (
            <p style={{ color: "#e53935", marginBottom: "1rem", fontWeight: 600 }}>
              {error}
            </p>
          )}

          {/* CTA */}
          <button
            className="boutique-primary-btn"
            onClick={handleSignup}
            style={{ width: "80%", maxWidth: 300, marginBottom: "1rem" }}
          >
            Create Account
          </button>

          <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
  <button
    onClick={handleGoogleSignup}
    style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: "10px",

      width: "80%",
      maxWidth: 300,
      minHeight: 44,

      backgroundColor: "#fff",
      border: "1px solid #dadce0",
      borderRadius: "6px",
      boxShadow:
        "0 1px 2px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.1)",

      fontSize: "15px",
      fontWeight: 500,
      color: "#3c4043",
      lineHeight: 1.2,
      cursor: "pointer",

      // kill any weird inherited stuff:
      padding: "0 16px",
      boxSizing: "border-box",
      backgroundClip: "padding-box",
    }}
  >
    <img
      src={`${import.meta.env.BASE_URL}assets/images/google.png`}
      alt="Google icon"
      style={{
        width: 20,
        height: 20,
        objectFit: "contain",
        flexShrink: 0,
      }}
    />
    <span>Sign in with Google</span>
  </button>
</div>
        </div>
      </div>
    </div>
  );
};

export default JamAccountModal;