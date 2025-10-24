// src/pages/TestFirebase.tsx

import React, { useState } from "react";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import { app } from "../firebase/firebaseConfig";

const db = getFirestore(app);

const TestFirebase = () => {
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");

  const handleSubmit = async () => {
    if (!name.trim()) {
      setStatus("⚠️ Please enter a name.");
      return;
    }

    try {
      await addDoc(collection(db, "testSubmissions"), { name });
      setStatus("✅ Success! Your name was added.");
      setName(""); // Clear input
    } catch (error) {
      console.error("❌ Error adding document:", error);
      setStatus("⚠️ Something went wrong.");
    }
  };

  return (
    <div
      style={{
        padding: "2rem",
        fontFamily: "'Nunito', sans-serif",
        textAlign: "center",
      }}
    >
      <h2 style={{ marginBottom: "1rem", color: "#2c62ba" }}>
        Test Firebase Connection
      </h2>

      <input
        type="text"
        value={name}
        placeholder="Enter your name"
        onChange={(e) => setName(e.target.value)}
        style={{
          padding: "10px",
          fontSize: "1rem",
          borderRadius: "6px",
          border: "1px solid #ccc",
          width: "60%",
          maxWidth: "300px",
        }}
      />

      <div style={{ marginTop: "1rem" }}>
        <button
          onClick={handleSubmit}
          style={{
            padding: "10px 20px",
            fontSize: "1rem",
            backgroundColor: "#2c62ba",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          Submit
        </button>
      </div>

      {status && (
        <p
          style={{
            marginTop: "1rem",
            fontWeight: "bold",
            color: status.includes("Success") ? "#2cba62" : "#ba2c2c",
          }}
        >
          {status}
        </p>
      )}
    </div>
  );
};

export default TestFirebase;