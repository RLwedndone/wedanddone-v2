// src/components/photo/PhotoAccountModal.tsx
import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { saveUserProfile } from "../../utils/saveUserProfile";

interface PhotoAccountModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

const PhotoAccountModal: React.FC<PhotoAccountModalProps> = ({
  onSuccess,
  onClose,
}) => {
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [error,     setError]     = useState("");

  const auth = getAuth();

  const handleSignup = async () => {
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

      onSuccess();
    } catch (err: any) {
      console.error("[PhotoAccountModal] Email signup failed:", err);

      let message =
        "Something went wrong creating your account. Please try again.";

      if (err?.code === "auth/email-already-in-use") {
        message =
          "Looks like you already have an account with this email. Try logging in from the dashboard or resetting your password.";
      }

      setError(message);
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

      onSuccess();
    } catch (err: any) {
      console.error("[PhotoAccountModal] Google signup failed:", err);

      // handle common Google errors nicely
      if (err?.code === "auth/popup-closed-by-user") {
        // user cancelled, don't show an error banner
        return;
      }

      let message =
        "Google sign-in failed. Please try again or use email and password.";

      if (err?.code === "auth/account-exists-with-different-credential") {
        message =
          "An account with this email already exists under a different sign-in method. Try logging in from the dashboard or resetting your password.";
      }

      setError(message);
    }
  };

  return (
    // Dimmed backdrop using shared overlay
    <div
      className="pixie-overlay"
      style={{ zIndex: 2000 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Standard card; stop propagation so clicks inside don’t close */}
      <div className="pixie-card" onClick={(e) => e.stopPropagation()}>
        {/* Pink X */}
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
          {/* 📸 Header image (photo-specific) */}
          <img
            src={`${import.meta.env.BASE_URL}assets/images/photo_style_button.png`}
            alt="Photo Styler"
            className="px-media"
            style={{ maxWidth: 200, marginBottom: "1rem" }}
          />

          {/* Title + copy */}
          <h2 className="px-title-lg" style={{ marginBottom: "0.5rem" }}>
  Let’s style your wedding photos!
</h2>

<p className="px-prose-narrow" style={{ marginBottom: "0.5rem" }}>
  Create an account to save your style results and book your photographer.
</p>

<p
  className="px-prose-narrow"
  style={{
    marginBottom: "1.5rem",
    fontSize: "0.9rem",
    color: "#666",
  }}
>
  📸 Quick note: all of our photographers and photo magic are based in
  Arizona. Wed&amp;Done is currently booking Arizona weddings only — but
  we&apos;ll be capturing love stories in more states soon!
</p>

          {/* Inputs */}
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              margin: "0 auto 1.25rem",
            }}
          >
            <div style={{ display: "grid", gap: "12px" }}>
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

          {/* Error */}
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

          {/* Create Account */}
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

export default PhotoAccountModal;