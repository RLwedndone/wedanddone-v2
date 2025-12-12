import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function useAnalytics() {
  const location = useLocation();
  const gaId = import.meta.env.VITE_GA_MEASUREMENT_ID;

  useEffect(() => {
    if (!gaId) return;
    const gtag = (window as any).gtag;
    if (!gtag) return;

    gtag("event", "page_view", {
      page_path: location.pathname + location.search,
      page_title: document.title,
    });
  }, [location, gaId]);
}