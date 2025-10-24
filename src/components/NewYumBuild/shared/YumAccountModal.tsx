// src/components/NewYumBuild/shared/YumAccountModal.tsx
import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  getAuth,
} from "firebase/auth";
import { handleGoogleSignIn } from "../../../utils/authHelpers";
import { saveUserProfile } from "../../../utils/saveUserProfile";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";

interface YumAccountModalProps {
  onClose: () => void;
  onComplete?: () => void;
}

const YumAccountModal: React.FC<YumAccountModalProps> = ({ onClose, onComplete }) => {
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [error,     setError]     = useState("");

  const auth = getAuth();

  const handleSignup = async () => {
    if (!email || !firstName || !lastName || !password) {
      setError("Please fill in all fields.");
      return;
    }
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCred.user, { displayName: `${firstName} ${lastName}` });
      await saveUserProfile({ firstName, lastName, email, uid: userCred.user.uid });
      onComplete?.();
    } catch (err: any) {
      console.error("❌ Signup or Firestore error:", err);
      setError(err.message || "An unexpected error occurred.");
    }
  };

  const handleGoogleSignup = async () => {
    const result = await handleGoogleSignIn();
    if (!result?.success) return;

    const user = getAuth().currentUser;
    if (!user) return;

    const displayName = user.displayName || "";
    const [fn = "", ln = ""] = displayName.split(" ");
    const em = user.email || "";
    const uid = user.uid;

    try {
      await setDoc(
        doc(db, "users", uid),
        { firstName: fn, lastName: ln, email: em, createdAt: new Date().toISOString() },
        { merge: true }
      );
      onComplete?.();
    } catch (err) {
      console.error("❌ Firestore error during Google signup:", err);
      setError("Could not save your info. Please try again.");
    }
  };

  return (
    // Floral-standard overlay
    <div
      className="pixie-overlay"
      style={{ zIndex: 2000 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Standard white card; stop propagation so clicks inside don’t close */}
      <div className="pixie-card" onClick={(e) => e.stopPropagation()}>
        {/* Pink X in the top-right */}
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
            Ready to dial in deliciousness?
          </h2>
          <p className="px-prose-narrow" style={{ marginBottom: "1.25rem" }}>
            To save your selections, create an account below.
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
                placeholder="Create Password"
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

          {/* Primary CTA */}
          <button
            className="boutique-primary-btn"
            onClick={handleSignup}
            style={{ width: "80%", maxWidth: 300, marginBottom: "1rem" }}
          >
            Create Account
          </button>

          {/* Divider + Google */}
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

export default YumAccountModal;