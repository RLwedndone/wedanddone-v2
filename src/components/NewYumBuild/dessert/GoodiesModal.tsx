// src/components/NewYumBuild/dessert/GoodiesModal.tsx
import React, { useEffect, useMemo, useState } from "react";
import { GOODIE_CATALOG } from "./dessertPricing";

export interface GoodiesModalProps {
  selected: string[];               // accepts plain labels or "Group::Label"
  onChange: (keys: string[]) => void; // returns "Group::Label" keys
  onClose: () => void;
  title?: string;
}

const GROUP_ORDER = [
  "Brownies & Bars",
  "Shortbread Squares",
  "Cheesecake Bites",
  "Homestyle Cookies",
  "Tarts",
  "Shooters",
  "Other Treats",
] as const;

const GROUP_ICONS: Partial<Record<string, string>> = {
  "Brownies & Bars": "/assets/images/YumYum/goodies_icons/brownies_bars.png",
  "Shortbread Squares": "/assets/images/YumYum/goodies_icons/shortbread.png",
  "Cheesecake Bites": "/assets/images/YumYum/goodies_icons/cheesecake_bites.png",
  "Homestyle Cookies": "/assets/images/YumYum/goodies_icons/cookies.png",
  "Tarts": "/assets/images/YumYum/goodies_icons/tarts.png",
  "Shooters": "/assets/images/YumYum/goodies_icons/shooters.png",
  "Other Treats": "/assets/images/YumYum/goodies_icons/other_treats.png",
};

const toSentenceCase = (s: string) =>
  s.toLowerCase().replace(/(^\w|[.?!]\s+\w)/g, (m) => m.toUpperCase());

/** Normalize an incoming label or "Group::Label" into "Group::Label". */
function toCompositeKey(input: string): string | null {
  if (input.includes("::")) return input;
  const meta = GOODIE_CATALOG[input];
  if (!meta) return null;
  return `${meta.group}::${input}`;
}

const GoodiesModal: React.FC<GoodiesModalProps> = ({
  selected,
  onChange,
  onClose,
  title = "Pick your goodies!",
}) => {
  // Normalize incoming selections to composite keys once on mount
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => {
    const normalized = (selected || []).map(toCompositeKey).filter(Boolean) as string[];
    setPicked(normalized);
  }, [selected]);

  // Grouped data (ordered)
  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { price: number; min: number; items: { label: string; key: string }[] }
    >();

    Object.entries(GOODIE_CATALOG).forEach(([label, meta]) => {
      const g = meta.group;
      if (!map.has(g)) map.set(g, { price: meta.retailPerDozen, min: meta.minDozens, items: [] });
      map.get(g)!.items.push({ label, key: `${g}::${label}` });
    });

    for (const [, v] of map) v.items.sort((a, b) => a.label.localeCompare(b.label));

    const ordered: Array<[string, { price: number; min: number; items: { label: string; key: string }[] }]> = [];
    GROUP_ORDER.forEach((g) => map.has(g) && ordered.push([g, map.get(g)!]));
    for (const [g, v] of map) if (!GROUP_ORDER.includes(g as any)) ordered.push([g, v]);
    return ordered;
  }, []);

  const toggle = (key: string) =>
    setPicked((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <div className="pixie-overlay" style={{ zIndex: 2000 }}>
      <div
        className="pixie-card pixie-card--modal"
        style={{ maxWidth: 780, position: "relative", overflow: "hidden" }}
      >
        {/* Blue X */}
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src="/assets/icons/blue_ex.png" alt="Close" />
        </button>

        {/* Hide scrollbars inside this card only */}
        <style>{`
          .goodies-scroll {
            overflow-y: auto;
            max-height: 68vh;
            padding: 0 2px 4px;
            scrollbar-width: none;
          }
          .goodies-scroll::-webkit-scrollbar { display: none; }
        `}</style>

        <div className="pixie-card__body" style={{ textAlign: "center" }}>
          <h3
            className="px-title"
            style={{
              fontFamily: "'Jenna Sue', cursive",
              fontSize: "1.9rem",
              marginBottom: 6,
            }}
          >
            {title}
          </h3>
          <p className="px-prose-narrow" style={{ marginBottom: 12 }}>
            Choose any number of goodies! Prices are per dozen; minimum dozens apply per flavor.
          </p>

          <div className="goodies-scroll">
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 24,
                paddingTop: 2,
              }}
            >
              {grouped.map(([group, { price, min, items }]) => (
                <section key={group} style={{ width: "min(580px, 92vw)", textAlign: "center" }}>
                  {GROUP_ICONS[group] && (
                    <img
                      src={GROUP_ICONS[group]}
                      alt=""
                      style={{
                        width: 150,
                        height: 150,
                        objectFit: "contain",
                        display: "block",
                        margin: "0 auto 8px",
                      }}
                    />
                  )}

                  <div
                    style={{
                      fontFamily: "'Jenna Sue', cursive",
                      fontSize: "1.8rem",
                      color: "#2c62ba",
                      lineHeight: 1.1,
                      marginBottom: 4,
                    }}
                  >
                    {toSentenceCase(group)}
                  </div>
                  <div style={{ fontSize: ".98rem", color: "#444", marginBottom: 10 }}>
                    ${price}/dz • Min {min} dz per flavor
                  </div>

                  {/* Flavor list */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 10,
                      marginTop: 8,
                    }}
                  >
                    {items.map(({ label, key }, idx) => {
                      const checked = picked.includes(key);
                      const id = `goodie-${key.replace(/[^a-z0-9]+/gi, "-")}-${idx}`;
                      return (
                        <div
                          key={key}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 10,
                            fontSize: "1rem",
                            color: "#333",
                            userSelect: "none",
                          }}
                        >
                          <input
                            id={id}
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(key)}
                            style={{ transform: "scale(1.25)" }}
                          />
                          <label htmlFor={id} style={{ cursor: "pointer" }}>
                            {label}
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div style={{ marginTop: 18 }}>
            <button
              className="boutique-primary-btn"
              onClick={() => {
                onChange(picked); // composite keys out
                onClose();
              }}
              style={{ minWidth: 220 }}
            >
              Add to Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GoodiesModal;