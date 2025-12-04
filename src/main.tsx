// src/main.tsx
import React, { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";

// Google Analytics Loader (production only)
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
    gtag("config", gaId, {
      send_page_view: true,
    });
  };
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Uses "/" locally and "/wedanddone-v2/" on GitHub Pages */}
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <App />
    </BrowserRouter>
  </StrictMode>
);