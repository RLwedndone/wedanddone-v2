// src/pages/NotFound.tsx
import React from "react";
import { useNavigate } from "react-router-dom";

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  const handleGoHome = () => {
    // If your dashboard is the main landing page, this should point there
    navigate("/"); // <-- if your Dashboard route is actually /dashboard, change this to "/dashboard"
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "24px",
      }}
    >
      {/* Image with WebP + PNG fallback */}
      <picture>
        <source
          srcSet={`${import.meta.env.BASE_URL}assets/images/404error.webp`}
          type="image/webp"
        />
        <img
          src={`${import.meta.env.BASE_URL}assets/images/404error.png`}
          alt="Page not found"
          style={{
            width: "100%",
            maxWidth: "650px",   // ⬅️ bigger hero size
            display: "block",
            marginBottom: "32px",
          }}
        />
      </picture>
  
      <h1
        className="px-title-md"
        style={{
          marginBottom: 12,
          fontSize: "30px",
        }}
      >
        Oopsie-Wandsy! ✨
      </h1>
  
      <p
        className="px-body"
        style={{
          marginBottom: 36,
          maxWidth: 520,
          lineHeight: 1.6,
          fontSize: "18px",
        }}
      >
        This page fluttered off into the fairy ether.  
        Even Madge can’t find it!
      </p>
  
      {/* Pink Back Button */}
      <button
        onClick={() => navigate("/dashboard")}
        className="boutique-back-btn"
        style={{
          padding: "12px 28px",
          borderRadius: "12px",
          color: "#fff",
          fontSize: "16px",
          border: "none",
          cursor: "pointer",
          minWidth: "220px",
        }}
      >
        Back to Dashboard
      </button>
    </div>
  );
};

export default NotFound;