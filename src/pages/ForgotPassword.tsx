// src/pages/ForgotPassword.tsx
import React, { useState } from "react";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";

const inputStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "360px",
  padding: "0.75rem 1rem",
  fontSize: "1rem",
  borderRadius: "12px",
  border: "1px solid #ccc",
  boxShadow: "inset 0 1px 4px rgba(0,0,0,0.08)",
  marginBottom: "1rem",
};

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Please enter the email you used to sign up.");
      return;
    }

    try {
      setIsSending(true);
      await sendPasswordResetEmail(auth, trimmed);
      setMessage(
        "📩 Your password reset link is on its way! If you don’t see it soon, check your spam or junk folder — sometimes magic lands there first."
      );
    } catch (err: any) {
      console.error("Reset error", err);
      if (err?.code === "auth/user-not-found") {
        setError("We couldn’t find an account with that email.");
      } else if (err?.code === "auth/invalid-email") {
        setError("That doesn’t look like a valid email address.");
      } else {
        setError("Unable to send reset email. Please try again.");
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      className="wd-dashboard-bg"
      style={{ justifyContent: "center", alignItems: "center" }}
    >
      <div
        className="pixie-card"
        style={{ maxWidth: 520, width: "100%", minHeight: "auto" }}
      >
        <div className="pixie-card__body" style={{ textAlign: "center" }}>
          {/* Logo cloud */}
          <img
            src="https://firebasestorage.googleapis.com/v0/b/wedndonev2.firebasestorage.app/o/email_assets%2Flogo_cloud.png?alt=media&token=92ba53fb-d698-48f7-9b90-9db4c31ba1ab"
            alt="Wed&Done Logo Cloud"
            style={{
              maxWidth: "260px",
              width: "70%",
              height: "auto",
              marginBottom: "1.5rem",
            }}
          />

          <h1 className="px-title-lg" style={{ marginBottom: "0.75rem" }}>
            Forgot your password?
          </h1>
          <p className="px-prose" style={{ marginBottom: "1.5rem" }}>
            No worries, magic happens. Enter the email you used to create your
            account and we&apos;ll send you a reset link.
          </p>

          <form
            onSubmit={handleReset}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <input
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />

            {error && (
              <p
                style={{
                  color: "#c0392b",
                  fontSize: "0.9rem",
                  marginBottom: "0.75rem",
                }}
              >
                {error}
              </p>
            )}
            {message && (
              <p
                style={{
                  color: "#2c62ba",
                  fontSize: "0.95rem",
                  marginBottom: "0.75rem",
                }}
              >
                {message}
              </p>
            )}

            <button
              type="submit"
              className="boutique-primary-btn"
              disabled={isSending}
              style={{
                width: "260px",
                padding: "0.7rem",
                fontSize: "1rem",
                borderRadius: "12px",
                marginTop: "0.25rem",
              }}
            >
              {isSending ? "Sending…" : "Send Reset Link"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;