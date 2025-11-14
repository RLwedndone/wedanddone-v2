// src/hooks/useOverlayOpen.ts
import { useEffect, RefObject } from "react";

/**
 * Locks background scroll while an overlay is open
 * and (optionally) lets Escape close it via a click
 * on the overlay's close button.
 *
 * IMPORTANT: This hook must NOT call blur() on inputs
 * or preventDefault() for normal key presses, or it
 * will break typing inside form fields.
 */
export function useOverlayOpen(
  cardRef: RefObject<HTMLElement>,
  options?: { enableEscapeClose?: boolean }
) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only react to Escape – do NOT touch other keys
      if (e.key === "Escape" && options?.enableEscapeClose) {
        // Try to click a close button inside the overlay
        const root = cardRef.current || document.body;
        const closeBtn =
          root.querySelector<HTMLElement>(".pixie-card__close") ||
          root.querySelector<HTMLElement>('[aria-label="Close"]');

        if (closeBtn) {
          e.stopPropagation();
          e.preventDefault();
          closeBtn.click();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [cardRef, options?.enableEscapeClose]);
}