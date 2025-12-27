type GtagFn = (command: string, eventName: string, params?: Record<string, any>) => void;

declare global {
  interface Window {
    gtag?: GtagFn;
  }
}

const gtagReady = () =>
  typeof window !== "undefined" && typeof window.gtag === "function";

export function track(eventName: string, params: Record<string, any> = {}) {
  if (!gtagReady()) return;
  window.gtag!("event", eventName, params);
}

export function trackBoutiqueOpened(boutique: string) {
  track("boutique_opened", { boutique });
}

export function trackOverlayStep(boutique: string, step: string) {
  track("overlay_step_viewed", { boutique, step });
}

export function trackHighIntent(boutique: string, action: string, extra: Record<string, any> = {}) {
  track("high_intent_action", {
    boutique,
    action,
    ...extra,
  });
}