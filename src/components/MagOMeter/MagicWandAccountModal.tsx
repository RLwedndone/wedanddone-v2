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

interface MagicWandAccountModalProps {
  onSuccess: () => void;
  onClose: () => void;
}

const MagicWandAccountModal: React.FC<MagicWandAccountModalProps> = ({ onSuccess, onClose }) => {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const auth = getAuth();

  const handleSignup = async () => {
    try {
      const userCred = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCred.user, {
        displayName: `${firstName} ${lastName}`,
      });
  
      const guestBudget = localStorage.getItem("guestBudget");
      const budgetValue = guestBudget ? parseInt(guestBudget) : undefined;
  
      await saveUserProfile({
        firstName,
        lastName,
        email,
        uid: userCred.user.uid, // ✅ Pass UID manually
        budget: budgetValue,
      });

      if (budgetValue) {
        window.dispatchEvent(new Event("budgetUpdated"));
      }
  
      localStorage.removeItem("guestBudget");
  
      // ✅ Wait for Firebase auth confirmation
      await new Promise((resolve) => {
        const unsubscribe = auth.onAuthStateChanged((authUser) => {
          if (authUser) {
            unsubscribe();
            resolve(null);
          }
        });
  
        setTimeout(() => {
          console.warn("⚠️ Auth state never confirmed, continuing anyway.");
          unsubscribe();
          resolve(null);
        }, 3000);
      });
  
      onSuccess();
    } catch (err: any) {
      console.error("❌ Account creation error:", err);
      setError(err.message);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      // 🪄 Optional: Save guest budget if it exists
      const guestBudget = localStorage.getItem("guestBudget");
      if (guestBudget) {
        await setDoc(
          doc(db, "users", result.user.uid),
          { budget: parseInt(guestBudget) },
          { merge: true }
        );
        window.dispatchEvent(new Event("budgetUpdated"));
        localStorage.removeItem("guestBudget");
      }

      onSuccess();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: "2rem",
          borderRadius: "18px",
          width: "90%",
          maxWidth: "500px",
          position: "relative",
          textAlign: "center",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            background: "none",
            border: "none",
            fontSize: "1.5rem",
            cursor: "pointer",
          }}
        >
          ✖
        </button>

        <img
          src="/assets/images/account_bar.png"
          alt="Account"
          style={{ width: "200px", margin: "0 auto 1rem", display: "block" }}
        />

        <h2
          style={{
            fontSize: "2.2rem",
            marginBottom: "1rem",
            color: "#2c62ba",
            fontFamily: "'Jenna Sue', cursive",
            lineHeight: "1.2",
          }}
        >
          Let's make the magic official! Create your free account!
        </h2>
        <p style={{ marginBottom: "1.5rem" }}>
          We’ll keep track of your bookings and budget automatically.
        </p>

        <input
          type="text"
          placeholder="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          style={{ width: "100%", padding: "0.75rem", marginBottom: "1rem", borderRadius: "10px" }}
        />
        <input
          type="text"
          placeholder="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          style={{ width: "100%", padding: "0.75rem", marginBottom: "1rem", borderRadius: "10px" }}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ width: "100%", padding: "0.75rem", marginBottom: "1rem", borderRadius: "10px" }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ width: "100%", padding: "0.75rem", marginBottom: "1.5rem", borderRadius: "10px" }}
        />

        {error && <p style={{ color: "#e53935", marginBottom: "1rem" }}>{error}</p>}

        <button
          className="boutique-primary-btn"
          onClick={handleSignup}
          style={{
            width: "80%",
            padding: "0.75rem",
            borderRadius: "10px",
            marginBottom: "1rem",
            fontWeight: "bold",
          }}
        >
          Create Account
        </button>

        <p style={{ margin: "1rem 0 0.25rem", fontWeight: "bold", color: "#999" }}>— or —</p>
        <div style={{ textAlign: "center", marginBottom: "0.5rem" }}>
          <img
            src="/assets/images/google.png"
            alt="Google icon"
            style={{ width: "28px", height: "28px" }}
          />
        </div>

        <button
          className="google-signin-btn"
          onClick={handleGoogleSignup}
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
};

export default MagicWandAccountModal;