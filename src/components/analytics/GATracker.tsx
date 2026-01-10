// src/components/analytics/GATracker.tsx
import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export default function GATracker() {
  const location = useLocation();
  const lastPathRef = useRef<string>("");

  useEffect(() => {
    const gtag = (window as any).gtag as undefined | ((...args: any[]) => void);
    if (!gtag) return;

    const path = location.pathname + location.search;

    // Prevent double fire in React StrictMode
    if (lastPathRef.current === path) return;
    lastPathRef.current = path;

    gtag("event", "page_view", {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
    });
  }, [location]);

  return null;
}