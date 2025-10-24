// src/App.tsx
import React, { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";

import "./styles/globals/boutique.master.css";

// 💫 Auth & Core Pages
import CreateAccount from "./pages/CreateAccount";
import Login from "./pages/LoginModal";
import Dashboard from "./pages/Dashboard";

// 🧙‍♀️ Venue Ranker Overlay
import VenueRankerOverlay from "./components/VenueRanker/VenueRankerOverlay";

// ✅ User Context
import { UserProvider } from "./contexts/UserContext";

// 🔝 Global scroll helper
import { useScrollToTopOnChange } from "./hooks/useScrollToTop";

/** Mounted once inside AppRoutes to force top on any route/query/hash change */
const ScrollOnRouteChange: React.FC = () => {
  const { pathname, search, hash } = useLocation();
  useScrollToTopOnChange([pathname, search, hash]);
  return null;
};

const AppRoutes: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.log("📍 Route changed to:", location.pathname);
    if (location.pathname === "/planning") {
      console.trace("🛑 /planning triggered here");
    }
  }, [location.pathname]);

  return (
    <>
      {/* Ensures top-of-page on every route change */}
      <ScrollOnRouteChange />

      <Routes>
        {/* 🧚 Auth Flow */}
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/create-account" element={<CreateAccount />} />

        {/* 🏰 Dashboard */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* 🧙‍♀️ Venue Ranker Overlay */}
        <Route
          path="/venue-ranker"
          element={
            <VenueRankerOverlay onClose={() => navigate("/dashboard")} />
          }
        />
      </Routes>
    </>
  );
};

const App: React.FC = () => {
  const [showSignupModal, setShowSignupModal] = useState(false);

  useEffect(() => {
    const handleSignupModal = () => setShowSignupModal(true);
    window.addEventListener("openSignupModal", handleSignupModal);
    return () =>
      window.removeEventListener("openSignupModal", handleSignupModal);
  }, []);

  return (
    <UserProvider>
      <AppRoutes />

      {showSignupModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0,0,0,0.6)",
            zIndex: 1000,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
          }}
          onClick={() => setShowSignupModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "white",
              borderRadius: "16px",
              padding: "2rem",
              width: "90%",
              maxWidth: "500px",
              boxShadow: "0 0 20px rgba(0, 0, 0, 0.3)",
            }}
          >
            <CreateAccount onClose={() => setShowSignupModal(false)} />
          </div>
        </div>
      )}
    </UserProvider>
  );
};

export default App;