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

const YumAccountModal: React.FC<YumAccountModalProps> = ({
  onClose,
  onComplete,
}) => {
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
      const userCred = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      await updateProfile(userCred.user, {
        displayName: `${firstName} ${lastName}`,
      });

      await saveUserProfile({
        firstName,
        lastName,
        email,
        uid: userCred.user.uid,
      });

      onComplete?.();
    } catch (err: any) {
      console.error("❌ Signup or Firestore error:", err);

      let message = "Something went wrong creating your account. Please try again.";

      if (err?.code === "auth/email-already-in-use") {
        message =
          "Looks like you already have an account with this email. Try logging in from the dashboard or resetting your password.";
      }

      setError(message);
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
        {
          firstName: fn,
          lastName: ln,
          email: em,
          createdAt: new Date().toISOString(),
        },
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
          {/* Header image */}
          <img
            src={`${import.meta.env.BASE_URL}assets/images/account_bar.png`}
            alt="Account"
            className="px-media"
            style={{ maxWidth: 240, marginBottom: "1rem" }}
          />

          {/* Title + copy */}
          <h2 className="px-title-lg" style={{ marginBottom: "0.5rem" }}>
  Ready to dial in deliciousness?
</h2>

<p className="px-prose-narrow" style={{ marginBottom: "0.5rem" }}>
  To save your selections, create an account below.
</p>

<p
  className="px-prose-narrow"
  style={{
    marginBottom: "1.5rem",
    fontSize: "0.9rem",
    color: "#666",
  }}
>
  🍽️ Just a quick note: all of our catering and dessert magic is
  currently served in Arizona. Wed&amp;Done is booking Arizona weddings
  only for now — but we&apos;ll be feeding celebrations nationwide soon!
</p>

          {/* Inputs */}
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              margin: "0 auto 1.25rem",
            }}
          >
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
            <p
              style={{
                color: "#e53935",
                marginBottom: "1rem",
                fontWeight: 600,
              }}
            >
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
          <div
            style={{ display: "flex", justifyContent: "center", width: "100%" }}
          >
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

export default YumAccountModal;