// src/components/VenueRanker/VenueAccountModal.tsx
import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { saveUserProfile } from "../../utils/saveUserProfile";

interface VenueAccountModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

const VenueAccountModal: React.FC<VenueAccountModalProps> = ({ onSuccess, onClose }) => {
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
      console.error("[VenueAccountModal] signup failed:", err);

      let message =
        "We couldn’t create your account just yet. Please check your details and try again.";

      switch (err?.code) {
        case "auth/email-already-in-use":
          message =
            "Looks like you already have a Wed&Done account with this email. Try logging in from the main cloud instead.";
          break;
        case "auth/weak-password":
          message =
            "For security, your password needs at least 6 characters. Try adding a bit more oomph.";
          break;
        case "auth/invalid-email":
          message =
            "That doesn’t look like a valid email yet. Give it a quick typo check.";
          break;
        case "auth/network-request-failed":
          message =
            "We’re having trouble reaching our servers. Check your connection and try again.";
          break;
        default:
          // keep the soft fallback
          message =
            "Something went sideways while creating your account. Please try again.";
          break;
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
      console.error("[VenueAccountModal] Google signup failed:", err);

      if (err?.code === "auth/popup-closed-by-user") {
        // user bailed on the popup — no need to show an error
        return;
      }

      let message =
        "Google sign-in didn’t quite work. Please try again.";

      switch (err?.code) {
        case "auth/account-exists-with-different-credential":
          message =
            "You already have a Wed&Done account with this email using a different sign-in method. Try logging in with email and password instead.";
          break;
        case "auth/network-request-failed":
          message =
            "We couldn’t reach Google just now. Check your connection and try again.";
          break;
        default:
          message =
            "Google sign-in ran into a snag. Please try again.";
          break;
      }

      setError(message);
    }
  };

  return (
    // Overlay: dim background + stacking; click backdrop to close
    <div
      className="pixie-overlay"
      style={{ zIndex: 2000 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* 🔒 Scoped size fixes for this modal only */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .venue-account .px-google-btn{
              width: 260px;
              max-width: 100%;
              padding: 10px 14px;
              font-size: 15px;
              border-radius: 10px;
            }
            .venue-account .px-google-btn img{
              width: 18px;
              height: 18px;
            }
            @media (max-width: 420px){
              .venue-account .px-google-btn{ width: 100%; max-width: 280px; }
            }
          `,
        }}
      />

      {/* Standard card; stop inner clicks from closing */}
      <div className="pixie-card venue-account" onClick={(e) => e.stopPropagation()}>
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
            style={{ maxWidth: 220, marginBottom: "1rem" }}
          />

          {/* Title + copy */}
          <h2 className="px-title" style={{ fontSize: "1.6rem", marginBottom: "0.5rem" }}>
            Ready to say yes to your perfect venue?
          </h2>
          <p className="px-prose-narrow" style={{ marginBottom: "1.25rem" }}>
            Just a few quick details and we’ll unlock your scroll of possibilities.
          </p>

          {/* Inputs */}
          <div style={{ width: "100%", maxWidth: 420, margin: "0 auto 1.25rem" }}>
            <div style={{ display: "grid", gap: 12 }}>
              <input className="px-input" type="text" placeholder="First Name"  value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <input className="px-input" type="text" placeholder="Last Name"   value={lastName}  onChange={(e) => setLastName(e.target.value)} />
              <input className="px-input" type="email" placeholder="Email"      value={email}     onChange={(e) => setEmail(e.target.value)} />
              <input className="px-input" type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
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
            style={{ width: 260, maxWidth: "90%", marginBottom: "1rem" }}
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

export default VenueAccountModal;