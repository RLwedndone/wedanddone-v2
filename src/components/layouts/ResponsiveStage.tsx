// src/components/layouts/ResponsiveStage.tsx
import React from "react";

/** One clickable thing on the stage. */
export type Hotspot = {
  id: string;

  /** Position as percents from top-left of the stage */
  topPct: number;
  leftPct: number;

  /** Click handler */
  onClick: () => void;

  /** Image path for the button/icon (optional if you use text label) */
  iconSrc?: string;

  /** Optional text label (used for alt/aria if iconSrc present) */
  label?: string;

  /** Accessible label for screen readers */
  ariaLabel?: string;

  /** Stacking order */
  zIndex?: number;

  /**
   * Visual width. If provided, widthClamp takes precedence.
   * - widthClamp: any CSS width (e.g. "clamp(160px, 22vw, 380px)")
   * - widthPct: percentage of the stage width (e.g. 12 means 12% of stage width)
   */
  widthClamp?: string;
  widthPct?: number;

  /** Extra class for styling (e.g. special hover on the logo cloud) */
  className?: string;

  /** ✅ Optional inline styles for the rendered icon (great for glow/animation) */
  style?: React.CSSProperties;
};

interface Props {
  /** Background image url */
  bg: string;

  /** Design aspect ratio, used to preserve layout */
  aspectW: number;
  aspectH: number;

  /** All hotspots */
  hotspots: Hotspot[];
}

/**
 * A responsive, aspect-ratio–locked stage.
 * Positions children with percentage coordinates so everything scales together.
 */
const ResponsiveStage: React.FC<Props> = ({ bg, aspectW, aspectH, hotspots }) => {
  return (
    <div
      className="stage"
      style={{
        position: "fixed", // full-bleed layer on top of bg
        inset: 0,
        width: "100vw",
        height: "100vh",
        // no background here; dashboard already paints it
        background: "transparent",
        // remove any rounded corner / shadow that was causing a halo
        borderRadius: 0,
        boxShadow: "none",
        overflow: "visible",
        zIndex: 5, // above background image, below modals
        pointerEvents: "none", // buttons inside re-enable clicks
      }}
    >
      {hotspots.map((h) => {
        // Size calculation
        const width =
          h.widthClamp ??
          (typeof h.widthPct === "number"
            ? `${h.widthPct}vw`
            : "clamp(72px, 10vw, 180px)");

        const alt = h.ariaLabel || h.label || h.id;

        return (
          <button
  key={h.id}
  onClick={h.onClick}
  className="stage-btn"
  style={{
    position: "absolute",
    top: `${h.topPct}%`,
    left: `${h.leftPct}%`,
    transform: "translate(-50%, -50%)",
    pointerEvents: "auto",
    width: h.widthClamp ? h.widthClamp : h.widthPct ? `${h.widthPct}vw` : "auto",
    background: "transparent",
    border: "none",
    padding: 0,
    cursor: "pointer",
    zIndex: h.zIndex ?? 1,
  }}
>
  <img
    src={h.iconSrc}
    alt={h.ariaLabel ?? h.id}
    className={h.className ?? ""}   // ✅ animate the image, not the button
    style={{
      display: "block",
      width: "100%",
      height: "auto",
      userSelect: "none",
      pointerEvents: "none",
    }}
  />
</button>
        );
      })}
    </div>
  );
};

export default ResponsiveStage;