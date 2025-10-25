import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase/firebaseConfig";
import { db } from "../firebase/firebaseConfig";
import { doc, setDoc } from "firebase/firestore";

const glowPulseKeyframes = `
@keyframes glowPulse {
  0% {
    box-shadow: 0 0 15px rgba(44, 98, 186, 0.7);
    transform: scale(1);
  }
  50% {
    box-shadow: 0 0 35px rgba(44, 98, 186, 1);
    transform: scale(1.04);
  }
  100% {
    box-shadow: 0 0 15px rgba(44, 98, 186, 0.7);
    transform: scale(1);
  }
}`;
const styleTag = document.createElement("style");
styleTag.innerHTML = glowPulseKeyframes;
document.head.appendChild(styleTag);

interface CreateAccountProps {
  onClose?: () => void; // ✅ for modal use
}

const CreateAccount: React.FC<CreateAccountProps> = ({ onClose }) => {
  const isMobile = window.innerWidth < 768;
  const navigate = useNavigate();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const inputStyle: React.CSSProperties = {
    padding: "10px 14px",
    margin: "8px 6px",
    borderRadius: "12px",
    border: "none",
    fontSize: "1rem",
    width: isMobile ? "42%" : "22%",
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
  };

  const primaryButton: React.CSSProperties = {
    marginTop: "25px",
    padding: "12px 32px",
    borderRadius: "24px",
    border: "none",
    backgroundColor: "#2c62ba",
    color: "white",
    fontSize: "1.1rem",
    fontWeight: 700,
    fontFamily: "'Nunito', sans-serif",
    cursor: "pointer",
    boxShadow: "0 0 20px rgba(44, 98, 186, 0.8)",
    animation: "glowPulse 1.5s infinite ease-in-out",
  };

  const loginInsteadButton: React.CSSProperties = {
    position: "absolute",
    bottom: "5%",
    left: "50%",
    transform: "translateX(-50%)",
    padding: "10px 20px",
    borderRadius: "24px",
    border: "none",
    backgroundColor: "#f59bb0",
    color: "#2c2c2c",
    fontSize: "1rem",
    fontWeight: 600,
    fontFamily: "'Nunito', sans-serif",
    cursor: "pointer",
  };

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, "users", user.uid), {
        firstName,
        lastName,
        email,
        createdAt: new Date().toISOString(),
      });

      console.log("✅ Account created and data saved!");
      if (onClose) {
        onClose(); // close modal view
      } else {
        navigate("/transition"); // navigate if on full page
      }
    } catch (error: any) {
      console.error("❌ Error creating account:", error.message);
      alert("There was an issue creating your account: " + error.message);
    }
  };

  return (
    <div
      style={{
        backgroundImage: `url(${isMobile ? `${import.meta.env.BASE_URL}assets/images/account_door_mobile.jpg` : `${import.meta.env.BASE_URL}assets/images/account_door_desktop_v2.jpg`})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        height: "100vh",
        width: "100vw",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <form
        onSubmit={handleCreateAccount}
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: isMobile ? "30%" : "14%",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
          <input
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            style={inputStyle}
          />
          <input
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "center", width: "100%" }}>
          <input
            type="email"
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          <input
            type="password"
            placeholder="Create Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ height: "48px" }} />
        <button type="submit" style={primaryButton}>Enter</button>
      </form>

      <button style={loginInsteadButton} onClick={() => navigate("/login")}>
        Already have an account?
      </button>
    </div>
  );
};

export default CreateAccount;