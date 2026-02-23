// src/utils/posthogTrack.ts
type Props = Record<string, any>;

const phReady = () =>
  typeof window !== "undefined" && (window as any).posthog && typeof (window as any).posthog.capture === "function";

export function ph(event: string, props: Props = {}) {
  if (!phReady()) return;
  (window as any).posthog.capture(event, props);
}

export function phIdentify(distinctId: string, props: Props = {}) {
  if (!phReady()) return;
  (window as any).posthog.identify(distinctId, props);
}

export function phSetOnce(props: Props = {}) {
  if (!phReady()) return;
  (window as any).posthog.people?.set_once?.(props);
}