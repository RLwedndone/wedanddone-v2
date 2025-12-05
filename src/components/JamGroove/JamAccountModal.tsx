// src/components/jam/JamAccountModal.tsx
import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import { saveUserProfile } from "../../utils/saveUserProfile";

interface JamAccountModalProps {
  onSuccess: () => void;
  onClose: () => void;
  currentStep: string;
}

// 🔹 Human-friendly Firebase auth error mapper
function getFriendlyAuthError(err: any, contextLabel?: string): string {
  const code = err?.code || "";

  switch (code) {
    case "auth/email-already-in-use":
      return "Looks like there’s already an account with this email. Try logging in instead, or use a different email address.";

    case "auth/invalid-email":
      return "That email doesn’t look quite right. Double-check the spelling and try again.";

    case "auth/weak-password":
      return "For security, your password needs to be at least 6 characters. Try something a bit stronger.";

    case "auth/operation-not-allowed":
      return "Email/password sign-in isn’t available at the moment. Please try again later or use another sign-in option.";

    case "auth/popup-blocked":
    case "auth/popup-closed-by-user":
      return "The sign-in popup was closed before we could finish. Try again when you’re ready.";

    case "auth/account-exists-with-different-credential":
      return "There’s already an account with this email using a different sign-in method. Try logging in with email + password.";

    default:
      return (
        "We ran into a hiccup creating your account. " +
        "Double-check your details and try again in a moment."
      );
  }
}

const JamAccountModal: React.FC<JamAccountModalProps> = ({
  onSuccess,
  onClose,
  currentStep,
}) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const auth = getAuth();

  // carry over any guest Jam data after signup
  const migrateGuestJamGrooveData = async (uid: string) => {
    const userRef = doc(db, "users", uid);
    const jamGrooveData: any = {};

    const guestProgress = localStorage.getItem("jamGrooveProgress");
    const cocktailMusic = localStorage.getItem("cocktailMusic");
    const processional = localStorage.getItem("ceremonyOrder");

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

  // Checks Firestore for an existing (and/or locked) wedding date and
  // stores lightweight flags for the Jam flow to react to.
  const cacheExistingWeddingDateFlags = async (uid: string) => {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    const locked = Boolean((data as any)?.weddingDateLocked);
    const ymd =
      (data as any)?.weddingDate ||
      (data as any)?.wedding?.date ||
      null;

    try {
      if (ymd) {
        localStorage.setItem("weddingDate", ymd);
        // Use this to skip date entry and show confirm immediately
        localStorage.setItem("jamSkipDateCapture", "true");
      }
      if (locked && ymd) {
        // Optional: a stronger flag if you need to treat "locked" differently
        localStorage.setItem("jamHasLockedWeddingDate", "true");
      }
    } catch {
      // swallow localStorage errors
    }
  };

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

      await setDoc(
        doc(db, "users", userCred.user.uid),
        { jamGrooveSavedStep: currentStep || "intro" },
        { merge: true }
      );

      // carry over any guest Jam data after signup
      await migrateGuestJamGrooveData(userCred.user.uid);

      // cache Firestore wedding date flags for Jam flow
      await cacheExistingWeddingDateFlags(userCred.user.uid);

      onSuccess();
    } catch (err: any) {
      console.error("[JamAccountModal] Email signup error:", err);
      setError(getFriendlyAuthError(err, "jam-email"));
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
      await cacheExistingWeddingDateFlags(result.user.uid);

      onSuccess();
    } catch (err: any) {
      console.error("[JamAccountModal] Google signup error:", err);

      // Silent no-op if they just closed the popup
      if (err?.code === "auth/popup-closed-by-user") {
        return;
      }

      setError(getFriendlyAuthError(err, "jam-google"));
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
      <div
        className="pixie-card"
        onClick={(e) => e.stopPropagation()}
      >
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

          <p className="px-prose-narrow" style={{ marginBottom: "0.5rem" }}>
            Create an account to save your groove and pick up anytime.
          </p>

          <p
            className="px-prose-narrow"
            style={{
              marginBottom: "1.5rem",
              fontSize: "0.9rem",
              color: "#666",
            }}
          >
            🎵 Quick heads-up: all of our DJs and music magic are based in
            Arizona. Wed&amp;Done is currently booking Arizona weddings only,
            but we&apos;ll be jamming into more states soon!
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
                placeholder="Password"
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

          {/* CTA */}
          <button
            className="boutique-primary-btn"
            onClick={handleSignup}
            style={{
              width: "80%",
              maxWidth: 300,
              marginBottom: "1rem",
            }}
          >
            Create Account
          </button>

          <div
            style={{
              display: "flex",
              justifyContent: "center",
              width: "100%",
            }}
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