import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  getAuth,
} from "firebase/auth";
import { saveUserProfile } from "../../utils/saveUserProfile";

// NEW: shared Google signup helper + name gate
import { signInWithGoogleAndEnsureUser } from "../../utils/signInWithGoogleAndEnsureUser";
import NameCapture from "../NameCapture";

interface FloralAccountModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

const FloralAccountModal: React.FC<FloralAccountModalProps> = ({
  onSuccess,
  onClose,
}) => {
  const [firstName, setFirstName]   = useState("");
  const [lastName,  setLastName]    = useState("");
  const [email,     setEmail]       = useState("");
  const [password,  setPassword]    = useState("");
  const [error,     setError]       = useState("");

  // 👇 NEW: if Google login didn't give us names, we flip this on
  const [needNameCapture, setNeedNameCapture] = useState(false);
  const [pendingFirst, setPendingFirst] = useState("");
  const [pendingLast,  setPendingLast]  = useState("");

  const auth = getAuth();

  // ---------------------------
// Email/password create
// ---------------------------
const handleSignup = async () => {
  setError("");

  const trimmedFirst = firstName.trim();
  const trimmedLast  = lastName.trim();
  const trimmedEmail = email.trim();

  if (!trimmedFirst || !trimmedLast) {
    setError("Please add both your first and last name so we can personalize your booking.");
    return;
  }

  if (!trimmedEmail || !password) {
    setError("Email and password are required to create your account.");
    return;
  }

  try {
    const userCred = await createUserWithEmailAndPassword(
      auth,
      trimmedEmail,
      password
    );

    await updateProfile(userCred.user, {
      displayName: `${trimmedFirst} ${trimmedLast}`,
    });

    await saveUserProfile({
      firstName: trimmedFirst,
      lastName:  trimmedLast,
      email:     trimmedEmail,
      uid:       userCred.user.uid,
    });

    onSuccess();
  } catch (err: any) {
    console.error("[FloralAccountModal] signup failed:", err);

    let message =
      "Hmm, something went wrong while creating your account. Please try again.";

    switch (err?.code) {
      case "auth/email-already-in-use":
        message =
          "Looks like you already have a Wed&Done account with this email. Try logging in instead.";
        break;
      case "auth/weak-password":
        message =
          "For security, your password needs at least 6 characters. Try adding a bit more sparkle.";
        break;
      case "auth/invalid-email":
        message =
          "That doesn’t look like a valid email address yet. Double-check for typos.";
        break;
      case "auth/network-request-failed":
        message =
          "We’re having trouble reaching the server. Check your connection and try again.";
        break;
      default:
        message =
          "We couldn’t create your account just yet. Please check your details and try again.";
        break;
    }

    setError(message);
  }
};

  // ---------------------------
  // Google signup with fallback for missing names
  // ---------------------------
  const handleGoogleSignup = async () => {
    try {
      const result = await signInWithGoogleAndEnsureUser();
      // result = { uid, email, firstName, lastName, missingName }

      // we still run saveUserProfile because that's what your app
      // expects for analytics / downstream assumptions
      await saveUserProfile({
        firstName: result.firstName || "",
        lastName: result.lastName || "",
        email: result.email || "",
        uid: result.uid || "",
      });

      if (result.missingName) {
        // we don't have both names yet → show NameCapture next,
        // but keep the same “pixie-card” vibe
        setPendingFirst(result.firstName || "");
        setPendingLast(result.lastName || "");
        setNeedNameCapture(true);
        return;
      }

      // we’re good
      onSuccess();
    } catch (err: any) {
      console.error("[FloralAccountModal] Google signup failed:", err);
      // we'll surface something friendly
      if (err?.code === "auth/popup-closed-by-user") return;
      if (err?.code === "auth/account-exists-with-different-credential") {
        setError(
          "An account with this email already exists under a different sign-in method. Try email + password."
        );
        return;
      }
      setError(err.message || "Google sign-in failed. Please try again.");
    }
  };

  // ---------------------------
  // If we need to collect first/last after Google,
  // temporarily swap the body to NameCapture.
  // This keeps styling consistent: NameCapture is ALSO a pixie-card overlay.
  // ---------------------------
  if (needNameCapture) {
    return (
      <NameCapture
        initialFirst={pendingFirst}
        initialLast={pendingLast}
        onDone={onSuccess}
        onClose={onClose}
      />
    );
  }

  // ---------------------------
  // Normal modal render
  // ---------------------------
  return (
    // Overlay restores the dim background & proper stacking
    <div
      className="pixie-overlay"
      style={{ zIndex: 2000 }} // ensure above dashboard UI
      onClick={onClose} // click backdrop to close
      role="dialog"
      aria-modal="true"
    >
      {/* Standard card; stop clicks from closing */}
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

        <div className="pixie-card__body">
          {/* Header image */}
          <img
            src={`${import.meta.env.BASE_URL}assets/images/account_bar.png`}
            alt="Account"
            className="px-media"
            style={{
              maxWidth: 240,
              marginBottom: "1rem",
            }}
          />

          {/* Title + copy */}
          <h2
            className="px-title-lg"
            style={{ marginBottom: "0.5rem" }}
          >
            Ready to say yes to booking your florals?
          </h2>

          <p
            className="px-prose-narrow"
            style={{ marginBottom: "0.5rem" }}
          >
            Great! Just fill out the form below to create an account.
          </p>

          <p
            className="px-prose-narrow"
            style={{
              marginBottom: "1.5rem",
              fontSize: "0.9rem",
              color: "#666",
            }}
          >
            🌵 Just a little note: all of our floral magic happens in Arizona.
            Wed&amp;Done is currently booking Arizona weddings only, but
            we&apos;ll be blooming in more places soon!
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
                onChange={(e) =>
                  setFirstName(e.target.value)
                }
              />

              <input
                className="px-input"
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) =>
                  setLastName(e.target.value)
                }
              />

              <input
                className="px-input"
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) =>
                  setEmail(e.target.value)
                }
              />

              <input
                className="px-input"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
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

          {/* CTA: email/password account */}
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

          {/* Google button (keeps your pretty inline styles) */}
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

export default FloralAccountModal;