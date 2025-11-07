// src/App.tsx
import React, { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Navigate,
  useNavigate,
  useLocation,
} from "react-router-dom";

import { getAuth, onAuthStateChanged } from "firebase/auth";
import { db } from "./firebase/firebaseConfig";
import { doc, onSnapshot, getDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { sendWelcome } from "./utils/email/email";

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

// 🧾 NEW: global Stripe context
import StripeProvider from "./components/StripeProvider";

/** Mounted once inside AppRoutes to force top on any route/change */
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
      <ScrollOnRouteChange />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route
          path="/venue-ranker"
          element={<VenueRankerOverlay onClose={() => navigate("/dashboard")} />}
        />
      </Routes>
    </>
  );
};

/**
 * 🔔 Global Welcome email watcher
 * - Waits for firstName/email in users/{uid} (up to 15s), then sends once.
 * - Deduped per device via sessionStorage and globally via Firestore flag.
 */
const WelcomeEmailWatcher: React.FC = () => {
  useEffect(() => {
    const auth = getAuth();
    const ssKey = "welcome:lastWelcomedUid";

    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!user) return;

      // per-tab guard
      try {
        if (sessionStorage.getItem(ssKey) === user.uid) return;
      } catch {}

      const userRef = doc(db, "users", user.uid);
      let done = false;

      const finish = async (firstName: string, email: string) => {
        if (done) return;
        done = true;

        await sendWelcome({
          firstName,
          user_email: email,
          dashboardUrl: `${window.location.origin}${import.meta.env.BASE_URL}dashboard`,
        });

        await updateDoc(userRef, { "emails.welcomeSentAt": serverTimestamp() });

        try {
          sessionStorage.setItem(ssKey, user.uid);
        } catch {}
        console.log("✅ Welcome email sent (central watcher)");
        unsubSnap?.();
        clearTimeout(fallbackTimer);
      };

      // If it’s already been sent, bail quickly
      getDoc(userRef).then((snap) => {
        const data = snap.data() || {};
        if (data?.emails?.welcomeSentAt) {
          try {
            sessionStorage.setItem(ssKey, user.uid);
          } catch {}
          done = true;
        }
      });

      // live listener: wait for firstName + email
      const unsubSnap = onSnapshot(userRef, async (snap) => {
        if (done) return;
        const data = snap.data() || {};

        // already sent?
        if (data?.emails?.welcomeSentAt) {
          try {
            sessionStorage.setItem(ssKey, user.uid);
          } catch {}
          done = true;
          unsubSnap();
          clearTimeout(fallbackTimer);
          return;
        }

        const first =
          data.firstName ||
          (user.displayName || "").split(" ")[0] ||
          ""; // wait until truthy if possible
        const email = data.email || user.email || "";

        if (first && email) {
          await finish(first, email);
        }
      });

      // fallback after 15s with whatever we have
      const fallbackTimer = window.setTimeout(async () => {
        if (done) return;

        const snap = await getDoc(userRef);
        const data = snap.data() || {};
        if (data?.emails?.welcomeSentAt) {
          try {
            sessionStorage.setItem(ssKey, user.uid);
          } catch {}
          done = true;
          unsubSnap();
          return;
        }

        const first =
          data.firstName ||
          (user.displayName || "").split(" ")[0] ||
          "Friend";
        const email = data.email || user.email || "";

        if (email) {
          await finish(first, email);
        } else {
          // No usable email; just stop listening
          unsubSnap();
          clearTimeout(fallbackTimer);
        }
      }, 15000);
    });

    return () => unsubAuth();
  }, []);

  return null;
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
      <StripeProvider>
        <WelcomeEmailWatcher />
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
      </StripeProvider>
    </UserProvider>
  );
};

export default App;