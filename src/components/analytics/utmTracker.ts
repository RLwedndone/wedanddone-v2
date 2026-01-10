import posthog from "posthog-js";

export function trackUTMsOnce() {
  if (!posthog?.__loaded) return;

  const params = new URLSearchParams(window.location.search);

  const utms = {
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
    utm_content: params.get("utm_content"),
    utm_term: params.get("utm_term"),
  };

  // Only register if at least one UTM exists
  if (Object.values(utms).some(Boolean)) {
    posthog.register_once(utms);
  }
}