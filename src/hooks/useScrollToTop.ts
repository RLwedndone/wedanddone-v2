import { useLayoutEffect } from "react";

type Opts = {
  targetRef?: React.RefObject<HTMLElement>; // optional: a specific scroll container
  align?: ScrollLogicalPosition;            // "start" is default
};

/**
 * Hard-resets scroll to the top on any dependency change.
 * - runs in useLayoutEffect (before paint)
 * - also re-runs on the next two RAF frames to defeat layout shifts
 */
export function useScrollToTopOnChange(deps: any[], opts: Opts = {}) {
  const { targetRef, align = "start" } = opts;

  useLayoutEffect(() => {
    const scrollNow = () => {
      // specific container
      const el = targetRef?.current;
      if (el) {
        try { el.scrollTo({ top: 0, left: 0, behavior: "auto" }); } catch {}
        try { el.scrollTop = 0; el.scrollLeft = 0; } catch {}
      }

      // all overlays (safety net)
      document.querySelectorAll<HTMLElement>(".pixie-overlay").forEach((node) => {
        try { node.scrollTo({ top: 0, left: 0, behavior: "auto" }); } catch {}
        try { node.scrollTop = 0; node.scrollLeft = 0; } catch {}
      });

      // window/document
      try { window.scrollTo({ top: 0, left: 0, behavior: "auto" }); } catch {}
      try {
        (document.scrollingElement || document.documentElement).scrollTop = 0;
        document.body.scrollTop = 0;
      } catch {}

      // if we have a card at the top, nudge it into view
      const topCard = document.querySelector<HTMLElement>(".pixie-card");
      topCard?.scrollIntoView({ block: align, inline: "nearest" });
    };

    // run now (pre-paint) and again for two frames to beat reflow
    scrollNow();
    const id1 = requestAnimationFrame(scrollNow);
    const id2 = requestAnimationFrame(scrollNow);
    // final microtask fallback
    const to = setTimeout(scrollNow, 0);

    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
      clearTimeout(to as unknown as number);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}