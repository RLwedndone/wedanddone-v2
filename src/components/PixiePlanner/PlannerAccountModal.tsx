import React, { useState } from "react";
import {
  createUserWithEmailAndPassword,
  updateProfile,
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
} from "firebase/auth";
import { saveUserProfile } from "../../utils/saveUserProfile";

interface PlannerAccountModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

const PlannerAccountModal: React.FC<PlannerAccountModalProps> = ({ onSuccess, onClose }) => {
  const [firstName, setFirstName] = useState("");
  const [lastName,  setLastName]  = useState("");
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [error,     setError]     = useState("");

  const auth = getAuth();

  const handleSignup = async () => {
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCred.user, { displayName: `${firstName} ${lastName}` });
      await saveUserProfile({ firstName, lastName, email, uid: userCred.user.uid });
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Something went wrong creating your account.");
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
      setError(err.message || "Google sign-in failed.");
    }
  };

  return (
    // Overlay restores the dim background & proper stacking
    <div
      className="pixie-overlay"
      style={{ zIndex: 2000 }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      {/* Standard card; stop clicks from closing */}
      <div className="pixie-card" onClick={(e) => e.stopPropagation()}>
        {/* Pink X */}
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
        </button>

        <div className="pixie-card__body">
          {/* Header image */}
          <img
            src={`${import.meta.env.BASE_URL}assets/images/account_bar.png`}
            alt="Account"
            className="px-media"
            style={{ maxWidth: 240, marginBottom: "1rem" }}
          />

          {/* Title + copy */}
          <h2 className="px-title-lg" style={{ marginBottom: "0.5rem" }}>
            Ready to book your magical planner?
          </h2>
          <p className="px-prose-narrow" style={{ marginBottom: "1.25rem" }}>
            Great! Just fill out the form below to create an account.
          </p>

          {/* Inputs */}
          <div style={{ width: "100%", maxWidth: 440, margin: "0 auto 1.25rem" }}>
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
            <img src={`${import.meta.env.BASE_URL}assets/images/google.png`} alt="Google icon" />
            Sign in with Google
          </button>
        </div>
      </div>
    </div>
  );
};

export default PlannerAccountModal;