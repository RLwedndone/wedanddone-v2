import React, { useState } from "react";
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";

interface LoginModalProps {
  onClose?: () => void; // ✅ optional now
}

const LoginModal: React.FC<LoginModalProps> = ({ onClose }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, email, password);
      onClose?.(); // ✅ safe optional call
    } catch (err: any) {
      setError("Incorrect email or password.");
    }
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      onClose?.(); // ✅ safe optional call
    } catch (err) {
      setError("Google login failed.");
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
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflow: "auto",
      }}
    >
      <div
        style={{
          background: "#fff",
          padding: "2rem",
          borderRadius: "18px",
          maxWidth: "600px",
          width: "90%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
          position: "relative",
        }}
      >
        {/* ❌ Close button (only if onClose provided) */}
        {onClose && (
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
            aria-label="Close"
          >
            ✖
          </button>
        )}

        {/* 🖼️ Top image */}
        <div style={{ textAlign: "center", marginBottom: "2rem" }}>
          <img
            src={`${import.meta.env.BASE_URL}assets/images/LogIn.png`}
            alt="Login"
            style={{
              width: "100%",
              maxWidth: "300px",
              height: "auto",
              borderRadius: "14px",
              display: "block",
              margin: "0 auto",
            }}
          />
        </div>

        {/* 🔐 Login form */}
        <form
          onSubmit={handleLogin}
          style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
        >
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "12px",
              border: "1px solid #ccc",
              fontSize: "1rem",
              boxShadow: "inset 0 1px 4px rgba(0,0,0,0.1)",
            }}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              padding: "0.75rem 1rem",
              borderRadius: "12px",
              border: "1px solid #ccc",
              fontSize: "1rem",
              boxShadow: "inset 0 1px 4px rgba(0,0,0,0.1)",
            }}
          />
          {error && (
            <p style={{ color: "red", fontSize: "0.85rem", textAlign: "center" }}>
              {error}
            </p>
          )}

          {/* Log In Button */}
          <button
            type="submit"
            style={{
              width: "250px",
              height: "50px",
              backgroundColor: "#2c62ba",
              color: "#fff",
              border: "none",
              borderRadius: "8px",
              fontSize: "1rem",
              fontWeight: "bold",
              cursor: "pointer",
              alignSelf: "center",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            Log In
          </button>
        </form>

        {/* 🔵 Google login image */}
        <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
          <img
            src={`${import.meta.env.BASE_URL}assets/images/google_signin.png`}
            alt="Google Sign-In"
            onClick={handleGoogleLogin}
            style={{ width: "200px", cursor: "pointer", marginTop: "0.5rem" }}
          />
        </div>
      </div>
    </div>
  );
};

export default LoginModal;