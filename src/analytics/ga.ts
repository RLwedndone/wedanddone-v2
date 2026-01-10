export const GA_ID = import.meta.env.VITE_GA_MEASUREMENT_ID;

export function trackPageView(path: string) {
  if (!GA_ID || typeof window.gtag !== "function") return;

  window.gtag("event", "page_view", {
    page_path: path,
  });
}