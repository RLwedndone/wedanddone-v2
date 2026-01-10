// src/components/analytics/internalUser.ts
import posthog from "posthog-js";

const INTERNAL_FLAG_KEY = "wd_internal_ph";

/**
 * Marks THIS browser as internal (persists via localStorage).
 * Call once, then you can remove the call if you want.
 */
export function markThisBrowserInternal() {
  try {
    localStorage.setItem(INTERNAL_FLAG_KEY, "1");
  } catch {}

  // PostHog super properties (attach to all future events from this browser)
  try {
    posthog.register({ internal_user: true, internal_source: "rach_browser" });
  } catch {}

  // Also set person properties when possible (helps filters & people view)
  try {
    posthog.people?.set?.({ internal_user: true, internal_source: "rach_browser" });
  } catch {}

  console.log("✅ PostHog: THIS browser marked as internal_user=true");
}

export function unmarkThisBrowserInternal() {
  try {
    localStorage.removeItem(INTERNAL_FLAG_KEY);
  } catch {}

  try {
    posthog.unregister("internal_user");
    posthog.unregister("internal_source");
  } catch {}

  // Optional: clear person props too (not strictly necessary)
  try {
    posthog.people?.set?.({ internal_user: false, internal_source: "" });
  } catch {}

  console.log("✅ PostHog: THIS browser unmarked (internal_user cleared)");
}

export function isThisBrowserInternal() {
  try {
    return localStorage.getItem(INTERNAL_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}