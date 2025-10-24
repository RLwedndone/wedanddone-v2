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
          <img src="/assets/icons/pink_ex.png" alt="Close" />
        </button>

        <div className="pixie-card__body" style={{ textAlign: "center" }}>
          {/* Header image */}
          <img
            src="/assets/images/account_bar.png"
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

          <p style={{ margin: "1rem 0 0.5rem", fontWeight: "bold", color: "#999" }}>— or —</p>

          <button className="px-google-btn" onClick={handleGoogleSignup}>
            <img src="/assets/images/google.png" alt="Google icon" />
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
};

export default JamAccountModal;