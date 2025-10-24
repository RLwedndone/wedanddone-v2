import { useEffect, useRef, type RefObject } from "react";

/**
 * Locks body scroll and snaps the window (and optional container) to top on mount.
 * Returns { restored } just in case you want to know when the first paint reset ran.
 */
function useOverlayOpen<T extends HTMLElement = HTMLDivElement>(
  scrollContainerRef?: RefObject<T>
) {
  const restored = useRef(false);

  useEffect(() => {
    // lock background scroll
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // avoid browser restoring old scroll
    try { (window.history as any).scrollRestoration = "manual"; } catch {}

    // snap to top
    window.scrollTo(0, 0);

    const id = requestAnimationFrame(() => {
      window.scrollTo(0, 0);
      if (scrollContainerRef?.current) {
        scrollContainerRef.current.scrollTop = 0;
        scrollContainerRef.current.focus?.();
      }
      restored.current = true;
    });

    return () => {
      cancelAnimationFrame(id);
      // restore
      document.body.style.overflow = prevOverflow;
      try { (window.history as any).scrollRestoration = "auto"; } catch {}
    };
  }, [scrollContainerRef]);

  return { restored };
}

// Export both ways so imports with/without braces work
export { useOverlayOpen as default, useOverlayOpen };