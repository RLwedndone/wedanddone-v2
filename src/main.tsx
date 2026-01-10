// src/main.tsx
import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

import { registerSW } from "virtual:pwa-register";
registerSW({ immediate: true });

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";

// ✅ NEW: GA tracker for SPA pageviews
import GATracker from "./components/analytics/GATracker";

// Google Analytics Loader
const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;

if (gaId) {
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  document.head.appendChild(script);

  script.onload = () => {
    (window as any).dataLayer = (window as any).dataLayer || [];
    function gtag(...args: any[]) {
      (window as any).dataLayer.push(args);
    }
    (window as any).gtag = gtag;

    gtag("js", new Date());

    // ✅ IMPORTANT: disable auto page_view (we'll send manually on route change)
    gtag("config", gaId, {
      send_page_view: false,
    });
  };
}

// 🦔 PostHog init
const phKey = import.meta.env.VITE_PUBLIC_POSTHOG_KEY;
const phHost = import.meta.env.VITE_PUBLIC_POSTHOG_HOST;

if (phKey && phHost) {
  const isLocal =
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1";

  // 🔒 Manual override for YOU
  const isInternalTester =
    isLocal || localStorage.getItem("wd_internal") === "true";

  posthog.init(phKey, {
    api_host: phHost,
    autocapture: false,
    capture_pageview: false,

    // 🚫 Drop all events if internal tester
    before_send: (event) => {
      if (isInternalTester) {
        return null;
      }
      return event;
    },
  });

  // Mark the person (for visibility only)
  if (isInternalTester) {
    posthog.register({
      internal_user: true,
    });
  }

  (window as any).posthog = posthog;
}

// ✅ Mount React
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <PostHogProvider client={posthog}>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        {/* ✅ sends GA page_view on every route change */}
        <GATracker />
        <App />
      </BrowserRouter>
    </PostHogProvider>
  </StrictMode>
);

// 🧚 REMOVE SPLASH AFTER REACT HAS A CHANCE TO PAINT
const splash = document.getElementById("splash-screen");

requestAnimationFrame(() => {
  // show the app + fade the splash
  document.body.classList.add("app-ready");

  // remove splash after fade
  if (splash) {
    setTimeout(() => splash.remove(), 300);
  }
});