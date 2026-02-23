// src/components/VenueRanker/VenueAccountModal.tsx
import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  getAuth,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { saveUserProfile } from "../../utils/saveUserProfile";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

// ✅ Shared Google helper + name capture
import { signInWithGoogleAndEnsureUser } from "../../utils/signInWithGoogleAndEnsureUser";
import NameCapture from "../NameCapture";

interface VenueAccountModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

type Step = "choice" | "signup" | "login";

const VenueAccountModal: React.FC<VenueAccountModalProps> = ({ onSuccess, onClose }) => {
  const [step, setStep] = useState<Step>("choice");

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [confirmPassword, setConfirmPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Google name gate
  const [needNameCapture, setNeedNameCapture] = useState(false);
  const [pendingFirst, setPendingFirst] = useState("");
  const [pendingLast, setPendingLast] = useState("");

  const auth = getAuth();

  const clearNotices = () => {
    setError("");
    setMessage("");
  };

  const goChoice = () => {
    setStep("choice");
    clearNotices();
    // keep inputs (nice if they tapped wrong button)
  };

  const persistBookingContextToUser = async (uid: string) => {
    try {
      const dateToUse =
        localStorage.getItem("venueWeddingDate") ||
        localStorage.getItem("weddingDate") ||
        "";
  
      const guestsRaw =
        localStorage.getItem("venueGuestCount") ||
        localStorage.getItem("guestCount") ||
        "";
  
      const guestCountToUse = guestsRaw ? Number(guestsRaw) : 0;
  
      // Only write if we actually have values
      const patch: any = {};
      if (dateToUse) patch.weddingDate = dateToUse;
      if (guestCountToUse > 0) patch.guestCount = guestCountToUse;
  
      if (!Object.keys(patch).length) return;
  
      // ✅ This is what CastleModal reads today
      await setDoc(doc(db, "users", uid), patch, { merge: true });
  
      // ✅ Optional: keep venueRanker booking subdoc in sync (future-proof)
      await setDoc(
        doc(db, "users", uid, "venueRankerData", "booking"),
        { ...patch, updatedAt: serverTimestamp() },
        { merge: true }
      );
  
      console.log("✅ Persisted booking context to user:", { uid, ...patch });
    } catch (e) {
      console.warn("⚠️ Could not persist booking context after auth:", e);
    }
  };

  // ---------------------------
  // Email/password create
  // ---------------------------
  const handleSignup = async () => {
    clearNotices();

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();
    const trimmedEmail = email.trim();

    if (!trimmedFirst || !trimmedLast) {
      setError("Please add both your first and last name so we can personalize your booking.");
      return;
    }
    if (!trimmedEmail || !password) {
      setError("Email and password are required to create your account.");
      return;
    }
    if (password.length < 6) {
      setError("Your password needs at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Your passwords don’t match.");
      return;
    }

    try {
      const userCred = await createUserWithEmailAndPassword(auth, trimmedEmail, password);

      await updateProfile(userCred.user, {
        displayName: `${trimmedFirst} ${trimmedLast}`,
      });

      await saveUserProfile({
        firstName: trimmedFirst,
        lastName: trimmedLast,
        email: trimmedEmail,
        uid: userCred.user.uid,
      });

      await persistBookingContextToUser(userCred.user.uid);
onSuccess();

      onSuccess();
    } catch (err: any) {
      console.error("[VenueAccountModal] signup failed:", err);

      let msg = "We couldn’t create your account yet. Please try again.";
      switch (err?.code) {
        case "auth/email-already-in-use":
          msg = "You already have an account with this email — choose Log In instead.";
          break;
        case "auth/weak-password":
          msg = "Password is too weak (6+ characters).";
          break;
        case "auth/invalid-email":
          msg = "That email address doesn’t look valid yet.";
          break;
        case "auth/network-request-failed":
          msg = "Network hiccup — check your connection and try again.";
          break;
      }
      setError(msg);
    }
  };

  // ---------------------------
// Email/password login
// ---------------------------
const handleLogin = async () => {
  clearNotices();

  const trimmedEmail = email.trim();
  if (!trimmedEmail || !password) {
    setError("Email and password are required to log in.");
    return;
  }

  try {
    // ✅ 1. Sign in and KEEP the credential
    const cred = await signInWithEmailAndPassword(auth, trimmedEmail, password);

    // ✅ 2. Persist booking context to users/{uid}
    await persistBookingContextToUser(cred.user.uid);

    // ✅ 3. Continue the booking flow (NOT back to scroll)
    onSuccess();
  } catch (err: any) {
    console.error("[VenueAccountModal] login failed:", err);

    let msg = "We couldn’t log you in. Double-check your email + password.";
    switch (err?.code) {
      case "auth/user-not-found":
        msg = "No account found for that email. Choose Create Account instead.";
        break;
      case "auth/wrong-password":
      case "auth/invalid-credential":
        msg = "That password doesn’t match. Try again (or reset it).";
        break;
      case "auth/too-many-requests":
        msg = "Too many tries — give it a minute (or reset your password).";
        break;
      case "auth/network-request-failed":
        msg = "Network hiccup — check your connection and try again.";
        break;
    }
    setError(msg);
  }
};

  const handleForgotPassword = async () => {
    clearNotices();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError("Enter your email first so we know where to send the reset link.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, trimmedEmail);
      setMessage("Reset link sent! Check your inbox (and spam, because spam is rude).");
    } catch (err: any) {
      console.error("[VenueAccountModal] reset failed:", err);
      setError("Couldn’t send the reset email. Double-check the email and try again.");
    }
  };

  // ---------------------------
  // Google signup/login + name gate
  // ---------------------------
  const handleGoogle = async () => {
    clearNotices();

    try {
      const result = await signInWithGoogleAndEnsureUser();

      if (result.uid) {
        await saveUserProfile({
          firstName: result.firstName || "",
          lastName: result.lastName || "",
          email: result.email || "",
          uid: result.uid,
        });
      }

      if (result.missingName) {
        setPendingFirst(result.firstName || "");
        setPendingLast(result.lastName || "");
        setNeedNameCapture(true);
        return;
      }

      await persistBookingContextToUser(result.uid);
onSuccess();

    } catch (err: any) {
      console.error("[VenueAccountModal] Google sign-in failed:", err);
      if (err?.code === "auth/popup-closed-by-user") return;

      if (err?.code === "auth/account-exists-with-different-credential") {
        setError("This email exists with a different sign-in method. Try email + password.");
        return;
      }

      setError(err?.message || "Google sign-in failed. Please try again.");
    }
  };

  if (needNameCapture) {
    return (
      <NameCapture
        initialFirst={pendingFirst}
        initialLast={pendingLast}
        onDone={async () => {
          const uid = auth.currentUser?.uid;
          if (uid) await persistBookingContextToUser(uid);
          onSuccess();
        }}
        onClose={onClose}
      />
    );
  }

  return (
    <div
      className="pixie-overlay"
      style={{ zIndex: 10000 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`pixie-card ${step === "choice" ? "account-card--compact" : "account-card--expanded"}`}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
        </button>

        <div className="pixie-card__body">
          <img
            src={`${import.meta.env.BASE_URL}assets/images/account_bar.png`}
            alt="Account"
            className="px-media"
            style={{ maxWidth: 240, marginBottom: "1rem" }}
          />

          {/* Step 1: Choice */}
          {step === "choice" && (
            <>
              <h2 className="px-title-lg" style={{ marginBottom: "0.5rem" }}>
                Ready to say yes to your perfect venue? 🏰
              </h2>

              <p className="px-prose-narrow" style={{ marginBottom: "1.25rem" }}>
                Great! First, create an account or log in to continue.
              </p>

              <div style={{ display: "flex", gap: 12, justifyContent: "center", marginBottom: 14 }}>
                <button
                  className="boutique-back-btn"
                  style={{ width: 190 }}
                  onClick={() => {
                    clearNotices();
                    setStep("signup");
                  }}
                >
                  Create Account
                </button>

                <button
                  className="boutique-primary-btn"
                  style={{ width: 190 }}
                  onClick={() => {
                    clearNotices();
                    setStep("login");
                  }}
                >
                  Log In
                </button>
              </div>

              {error && (
                <p style={{ color: "#e53935", marginTop: 8, fontWeight: 600, textAlign: "center" }}>
                  {error}
                </p>
              )}
              {message && (
                <p style={{ color: "#2c62ba", marginTop: 8, fontWeight: 600, textAlign: "center" }}>
                  {message}
                </p>
              )}
            </>
          )}

          {/* Step 2: Signup */}
          {step === "signup" && (
            <>
              <h2 className="px-title-lg" style={{ marginBottom: "0.5rem" }}>
                Ready to say yes to your perfect venue?
              </h2>

              <p className="px-prose-narrow" style={{ marginBottom: "0.5rem" }}>
                Create your account below.
              </p>

              {/* ✅ Arizona note ONLY here */}
              <p
                className="px-prose-narrow"
                style={{ marginBottom: "1.25rem", fontSize: "0.9rem", color: "#666" }}
              >
                🏰 A little heads-up: all of our castles and venue partners are located right here in Arizona.
                Wed&amp;Done is currently booking Arizona weddings only, but our kingdom is growing!
              </p>

              <div style={{ width: "100%", maxWidth: 440, margin: "0 auto 1.25rem" }}>
                <div style={{ display: "grid", gap: 12 }}>
                  <input
                    className="px-input"
                    type="text"
                    placeholder="First Name"
                    value={firstName}
                    onChange={(e) => {
                      setFirstName(e.target.value);
                      clearNotices();
                    }}
                  />
                  <input
                    className="px-input"
                    type="text"
                    placeholder="Last Name"
                    value={lastName}
                    onChange={(e) => {
                      setLastName(e.target.value);
                      clearNotices();
                    }}
                  />
                  <input
                    className="px-input"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearNotices();
                    }}
                  />

                  {/* Password + eye */}
                  <div style={{ position: "relative" }}>
                    <input
                      className="px-input"
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearNotices();
                      }}
                      style={{ paddingRight: 46 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "1.05rem",
                        lineHeight: 1,
                      }}
                    >
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>

                  {/* Confirm + eye */}
                  <div style={{ position: "relative" }}>
                    <input
                      className="px-input"
                      type={showConfirm ? "text" : "password"}
                      placeholder="Confirm Password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        clearNotices();
                      }}
                      style={{ paddingRight: 46 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      aria-label={showConfirm ? "Hide password" : "Show password"}
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "1.05rem",
                        lineHeight: 1,
                      }}
                    >
                      {showConfirm ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>
              </div>

              {error && (
                <p style={{ color: "#e53935", marginBottom: "0.75rem", fontWeight: 600, textAlign: "center" }}>
                  {error}
                </p>
              )}

              <button
                className="boutique-primary-btn"
                onClick={handleSignup}
                style={{ width: "80%", maxWidth: 300, marginBottom: "1rem" }}
              >
                Create Account
              </button>

              {/* Google only here (signup path) */}
              <div style={{ display: "flex", justifyContent: "center", width: "100%", marginBottom: 10 }}>
                <button
                  onClick={handleGoogle}
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
                    boxShadow: "0 1px 2px rgba(0,0,0,0.07), 0 1px 3px rgba(0,0,0,0.1)",
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
                    style={{ width: 20, height: 20, objectFit: "contain", flexShrink: 0 }}
                  />
                  <span>Create account with Google</span>
                </button>
              </div>

              <button type="button" className="linklike" onClick={goChoice}>
                ← Back
              </button>
            </>
          )}

          {/* Step 2: Login */}
          {step === "login" && (
            <>
              <h2 className="px-title-lg" style={{ marginBottom: "0.5rem" }}>
                Welcome back ✨
              </h2>

              <p className="px-prose-narrow" style={{ marginBottom: "1.25rem" }}>
                Log in to continue.
              </p>

              <div style={{ width: "100%", maxWidth: 440, margin: "0 auto 1.25rem" }}>
                <div style={{ display: "grid", gap: 12 }}>
                  <input
                    className="px-input"
                    type="email"
                    placeholder="Email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      clearNotices();
                    }}
                  />

                  <div style={{ position: "relative" }}>
                    <input
                      className="px-input"
                      type={showPassword ? "text" : "password"}
                      placeholder="Password"
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        clearNotices();
                      }}
                      style={{ paddingRight: 46 }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      style={{
                        position: "absolute",
                        right: 12,
                        top: "50%",
                        transform: "translateY(-50%)",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        fontSize: "1.05rem",
                        lineHeight: 1,
                      }}
                    >
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
                  <button type="button" className="linklike" onClick={handleForgotPassword}>
                    Forgot password?
                  </button>
                </div>
              </div>

              {error && (
                <p style={{ color: "#e53935", marginBottom: "0.75rem", fontWeight: 600, textAlign: "center" }}>
                  {error}
                </p>
              )}
              {message && (
                <p style={{ color: "#2c62ba", marginBottom: "0.75rem", fontWeight: 600, textAlign: "center" }}>
                  {message}
                </p>
              )}

              <button
                className="boutique-primary-btn"
                onClick={handleLogin}
                style={{ width: "80%", maxWidth: 300, marginBottom: "0.75rem" }}
              >
                Log In
              </button>

              <div style={{ display: "flex", justifyContent: "center", marginTop: "0.75rem" }}>
                <button
                  onClick={handleGoogle}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 14px",
                    minHeight: 38,
                    width: "auto",
                    backgroundColor: "#fff",
                    border: "1px solid #dadce0",
                    borderRadius: "6px",
                    fontSize: "14px",
                    fontWeight: 500,
                    color: "#3c4043",
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
                  }}
                >
                  <img
                    src={`${import.meta.env.BASE_URL}assets/images/google.png`}
                    alt=""
                    style={{ width: 18, height: 18 }}
                  />
                  <span>Log in with Google</span>
                </button>
              </div>

              <br />

              <button type="button" className="linklike" onClick={goChoice}>
                ← Back
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default VenueAccountModal;