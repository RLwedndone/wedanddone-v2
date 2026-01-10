import posthog from "posthog-js";

export function ph(event: string, props: Record<string, any> = {}) {
  if (typeof window === "undefined") return;
  if (!posthog || !posthog.capture) return;

  posthog.capture(event, props);
}

export function trackOpen(item: string, extra: Record<string, any> = {}) {
  ph("ui_opened", { item, ...extra });
}