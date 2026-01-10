// src/utils/analytics.ts

type GtagFn = (
    command: "event" | "config" | "js",
    eventName: string,
    params?: Record<string, any>
  ) => void;
  
  declare global {
    interface Window {
      gtag?: GtagFn;
      dataLayer?: any[];
    }
  }
  
  // ─────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────
  const canUseGtag = () =>
    typeof window !== "undefined" && typeof window.gtag === "function";
  
  const canUseDataLayer = () =>
    typeof window !== "undefined" && Array.isArray(window.dataLayer);
  
  // ─────────────────────────────────────────────
  // Core tracking function
  // ─────────────────────────────────────────────
  export function track(
    eventName: string,
    params: Record<string, any> = {}
  ) {
    if (typeof window === "undefined") return;
  
    const isDebug =
      window.location.hostname === "localhost" ||
      window.location.search.includes("ga_debug=1");
  
    const payload = {
      ...params,
      ...(isDebug ? { debug_mode: true } : {}),
    };
  
    // ✅ Preferred: gtag (immediate)
    if (canUseGtag()) {
      window.gtag!("event", eventName, payload);
      return;
    }
  
    // ✅ Fallback: dataLayer (queued until GA loads)
    if (canUseDataLayer()) {
      window.dataLayer!.push(["event", eventName, payload]);
    }
  }
  
  // ─────────────────────────────────────────────
  // Semantic helpers (optional but recommended)
  // ─────────────────────────────────────────────
  export function trackBoutiqueOpened(boutique: string) {
    track("boutique_opened", { boutique });
  }
  
  export function trackOverlayStep(boutique: string, step: string) {
    track("overlay_step_viewed", { boutique, step });
  }
  
  export function trackHighIntent(
    boutique: string,
    action: string,
    extra: Record<string, any> = {}
  ) {
    track("high_intent_action", {
      boutique,
      action,
      ...extra,
    });
  }