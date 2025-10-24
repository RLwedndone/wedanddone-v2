// src/components/NewYumBuild/CustomVenues/Encanterra/DiamondTierSelector.tsx
import React, { useEffect, useMemo, useState } from "react";

// ---------- types ----------
export type DiamondTierId = "carat1" | "carat2" | "carat3";
export type DiamondTierLabel = "1 Carat" | "2 Carat" | "3 Carat";

export interface TierAllowances {
  hors: number;
  salads: number;
  entrees: number;
  sides: number;
}

export interface DiamondTier {
  id: DiamondTierId;
  name: DiamondTierLabel;
  pricePerGuest: number;
  heroImg: string;
  blurb: string;
  includes: string[];
  allowances: TierAllowances;
  perks?: { dessertStation?: boolean };
}

export interface DiamondTierSelection {
  id: DiamondTierId;
  name: DiamondTierLabel;
  pricePerGuest: number;
  allowances: TierAllowances;
  perks?: DiamondTier["perks"];
}

interface Props {
  venueName?: "Encanterra";
  onSelect: (selection: DiamondTierSelection) => void;
  onContinue: () => void;
  defaultSelectedId?: DiamondTierId;
  onClose?: () => void; // ← optional
}

const STORAGE_KEY = "enc:diamondTier";

// ---------- data ----------
const TIERS: DiamondTier[] = [
  {
    id: "carat1",
    name: "1 Carat",
    pricePerGuest: 60,
    heroImg: "/assets/images/YumYum/Encanterra/1diamond.png",
    blurb: "Traditional plated with guest-choice variety.",
    includes: [
      "Two hand-passed hors d’oeuvres",
      "One salad selection",
      "Up to three entrée options (guest selects one)",
      "Two sides",
    ],
    allowances: { hors: 2, salads: 1, entrees: 3, sides: 2 },
  },
  {
    id: "carat2",
    name: "2 Carat",
    pricePerGuest: 70,
    heroImg: "/assets/images/YumYum/Encanterra/2diamonds.png",
    blurb: "Classic buffet with crowd-pleasing picks.",
    includes: [
      "Two hand-passed hors d’oeuvres",
      "One salad selection",
      "Two entrées",
      "Two sides",
    ],
    allowances: { hors: 2, salads: 1, entrees: 2, sides: 2 },
  },
  {
    id: "carat3",
    name: "3 Carat",
    pricePerGuest: 85,
    heroImg: "/assets/images/YumYum/Encanterra/3diamonds.png",
    blurb: "Plated duet + dessert station.",
    includes: [
      "Three hand-passed hors d’oeuvres",
      "One salad selection",
      "One plated entrée duet",
      "Two sides",
      "Dessert station",
    ],
    allowances: { hors: 3, salads: 1, entrees: 1, sides: 2 },
    perks: { dessertStation: true },
  },
];

function wipeEncanterraMenuSelections() {
  try {
    localStorage.removeItem("encanterraMenuSelections");
  } catch {}
}

// ---------- component ----------
const DiamondTierSelector: React.FC<Props> = ({
  venueName = "Encanterra",
  onSelect,
  onContinue,
  defaultSelectedId,
  onClose, // ← grab it
}) => {
  const [expanded, setExpanded] = useState<DiamondTierId | null>(null);
  const [selected, setSelected] = useState<DiamondTierId | null>(null);

  // hydrate from LS or defaultSelectedId
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: DiamondTierSelection = JSON.parse(raw);
        setSelected(parsed.id);
      } else if (defaultSelectedId) {
        setSelected(defaultSelectedId);
      }
    } catch {}
  }, [defaultSelectedId]);

  const selectedTier = useMemo(
    () => TIERS.find((t) => t.id === selected) || null,
    [selected]
  );

  const persist = (sel: DiamondTierSelection) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sel));
      localStorage.setItem("encanterraTierLabel", sel.name);
      localStorage.setItem("encanterraPerGuest", String(sel.pricePerGuest));
    } catch {}
  };

  const handleChoose = (tier: DiamondTier) => {
    const was = selected;
    const changed = !!was && was !== tier.id;
  
    // if user switched tiers, clear any prior menu selections
    if (changed) wipeEncanterraMenuSelections();
  
    setSelected(tier.id);
  
    const sel: DiamondTierSelection = {
      id: tier.id,
      name: tier.name,
      pricePerGuest: tier.pricePerGuest,
      allowances: tier.allowances,
      perks: tier.perks,
    };
  
    onSelect(sel);
    persist(sel);
    setExpanded((cur) => (cur === tier.id ? cur : tier.id));
  };

  

  // ...imports and component shell unchanged...

return (
  <div className="pixie-card pixie-card--modal" style={{ maxWidth: 720 }}>
    {onClose && (
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src="/assets/icons/pink_ex.png" alt="Close" />
      </button>
    )}

    <div className="pixie-card__body">
      <h2 className="px-title-lg" style={{ textAlign: "center", marginBottom: 6 }}>
        Choose your Diamond tier
      </h2>
      <p className="px-prose-narrow" style={{ textAlign: "center", marginBottom: 16 }}>
        Pick your tier to set your <strong>per-guest price</strong>. Tap a diamond to see what’s included.
      </p>

      {/* Stacked column, centered */}
      <div
  style={{
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 16,
    maxWidth: 520,
    margin: "0 auto",
  }}
>
  {TIERS.map((tier) => {
    const isSelected = selected === tier.id;
    const isExpanded = expanded === tier.id;

    return (
      <div key={tier.id} style={{ textAlign: "center" }}>
        {/* the diamond image IS the tile */}
        <button
          type="button"
          onClick={() => handleChoose(tier)}
          aria-pressed={isSelected}
          aria-expanded={isExpanded}
          style={{
            display: "block",
            width: "100%",
            border: "none",
            borderRadius: 20,
            cursor: "pointer",
            overflow: "hidden",
            padding: 0,
            background: "transparent",
            transition: "box-shadow .25s ease, transform .25s ease",
            boxShadow: isSelected
              ? "0 0 40px 10px rgba(70,140,255,0.55)" // ✨ blue glow when selected
              : "none",
          }}
        >
          <img
            src={tier.heroImg}
            alt={`${tier.name} tier`}
            style={{
              width: "100%",
              height: "auto",
              display: "block",
              borderRadius: 20,
              objectFit: "contain",
            }}
          />
        </button>

        {/* expanded content appears below the image */}
        {isExpanded && (
          <div
            style={{
              background: "#fff",
              borderRadius: 20,
              boxShadow: "0 8px 18px rgba(0,0,0,0.08)",
              padding: "12px 16px 16px",
              marginTop: 10,
              textAlign: "left",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <div>
                <div style={{ fontWeight: 900, fontSize: "1rem", color: "#1f2a44" }}>
                  {tier.name}
                </div>
                <div style={{ fontSize: ".95rem", color: "#444", marginTop: 2 }}>
                  {tier.blurb}
                </div>
              </div>
              <div
                style={{
                  fontWeight: 900,
                  fontSize: "1rem",
                  color: "#2c62ba",
                  whiteSpace: "nowrap",
                }}
              >
                ${tier.pricePerGuest.toFixed(0)}{" "}
                <span style={{ fontSize: ".75rem", color: "#667" }}>/guest</span>
              </div>
            </div>

            <div
              style={{ fontWeight: 800, margin: "4px 0 6px", color: "#2c62ba" }}
            >
              Tier includes
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.5 }}>
              {tier.includes.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  })}
</div>

      {/* Footer / continue */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginTop: 16 }}>
        {selectedTier ? (
          <span className="px-prose-narrow" style={{ color: "#1f2a44" }}>
            You’ve selected <strong>{selectedTier.name}</strong> —{" "}
            <strong>${selectedTier.pricePerGuest.toFixed(0)}/guest</strong>
          </span>
        ) : (
          <span className="px-prose-narrow" style={{ opacity: 0.85 }}>Select a tier to continue</span>
        )}

        <button
          className="boutique-primary-btn"
          disabled={!selectedTier}
          onClick={onContinue}
          style={{ width: 260, opacity: selectedTier ? 1 : 0.6, cursor: selectedTier ? "pointer" : "not-allowed" }}
        >
          Continue to Menu ✨
        </button>
      </div>
    </div>
  </div>
);
};

export default DiamondTierSelector;