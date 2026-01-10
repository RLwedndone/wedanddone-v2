// src/hooks/useAnalytics.ts
import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "../analytics/ga";

export default function useAnalytics() {
  const { pathname, search, hash } = useLocation();

  useEffect(() => {
    // Include search/hash if you want them as distinct pageviews
    const path = `${pathname}${search}${hash}`;

    // ✅ GA pageview
    trackPageView(path);

    // If you later want PostHog pageviews too, this is also where it goes.
    // (you currently have capture_pageview: false, which is fine)
  }, [pathname, search, hash]);
}