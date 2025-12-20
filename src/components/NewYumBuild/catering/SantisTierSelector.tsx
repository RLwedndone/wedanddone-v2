// src/components/NewYumBuild/catering/SantiTierSelector.tsx
import React, { useEffect, useMemo, useState } from "react";

export type SantiTierId = "signature" | "chef";

export interface SantiTierAllowances {
  appetizers: number;
  entrees: number;
  sides: number;
  salads: number;
}

export interface SantiTier {
  id: SantiTierId;
  name: string;
  pricePerGuest: number;
  heroImg: string;
  blurb: string;
  includes: string[];
  allowances: SantiTierAllowances;
}

export interface SantiTierSelection {
  id: SantiTierId;
  name: string;
  pricePerGuest: number;
  allowances: SantiTierAllowances;
}

interface Props {
  onSelect: (selection: SantiTierSelection) => void;
  onContinue: () => void;
  onBack?: () => void; 
  defaultSelectedId?: SantiTierId;
  onClose?: () => void;
}

const STORAGE_KEY = "yum:santiTier";

function wipeCateringMenuSelections() {
  try {
    localStorage.removeItem("yumMenuSelections");
  } catch {}
}

const TIERS: SantiTier[] = [
  {
    id: "signature",
    name: "Signature Feast",
    pricePerGuest: 44,
    heroImg: `${import.meta.env.BASE_URL}assets/images/YumYum/Santis/signature_seal.jpg`,
    blurb: "A beautifully curated buffet with signature favorites.",
    includes: [
      "1 appetizer",
      "1 entrée",
      "1 side",
      "1 salad",
      "Bread & butter",
      "Buffet-style dinner service",
      "Premium disposable dinnerware",
    ],
    allowances: {
      appetizers: 1,
      entrees: 1,
      sides: 1,
      salads: 1,
    },
  },
  {
    id: "chef",
    name: "Chef’s Feast",
    pricePerGuest: 86,
    heroImg: `${import.meta.env.BASE_URL}assets/images/YumYum/Santis/chef_seal.jpg`,
    blurb: "Elevated feast with extra choices and upgraded menu selections.",
    includes: [
      "2 appetizers",
      "2 entrées",
      "2 sides",
      "2 salads",
      "Bread & butter",
      "Buffet-style dinner service",
      "Premium disposable dinnerware",
    ],
    allowances: {
      appetizers: 2,
      entrees: 2,
      sides: 2,
      salads: 2,
    },
  },
];

const SantiTierSelector: React.FC<Props> = ({
  onSelect,
  onContinue,
  onBack,
  defaultSelectedId,
  onClose,
}) => {
  const [expanded, setExpanded] = useState<SantiTierId | null>(null);
  const [selected, setSelected] = useState<SantiTierId | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: SantiTierSelection = JSON.parse(raw);
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

  const persist = (sel: SantiTierSelection) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sel));
      localStorage.setItem("yumCateringTierLabel", sel.name);
      localStorage.setItem("yumCateringPerGuest", String(sel.pricePerGuest));
    } catch {}
  };

  const handleChoose = (tier: SantiTier) => {
    const was = selected;
    const changed = !!was && was !== tier.id;

    if (changed) wipeCateringMenuSelections();

    setSelected(tier.id);

    const sel: SantiTierSelection = {
      id: tier.id,
      name: tier.name,
      pricePerGuest: tier.pricePerGuest,
      allowances: tier.allowances,
    };

    onSelect(sel);
    persist(sel);
    setExpanded((cur) => (cur === tier.id ? cur : tier.id));
  };

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 720 }}>
      {onClose && (
        <button
          className="pixie-card__close"
          onClick={onClose}
          aria-label="Close"
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
            alt="Close"
          />
        </button>
      )}

      <div className="pixie-card__body">
        <h2
          className="px-title-lg"
          style={{ textAlign: "center", marginBottom: 6 }}
        >
          Choose your feast!
        </h2>
        <p
          className="px-prose-narrow"
          style={{ textAlign: "center", marginBottom: 16 }}
        >
          Pick your tier to set your <strong>per-guest price</strong>. Tap a
          ribbon to see what’s included in each.
        </p>

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
                      ? "0 0 40px 10px rgba(70,140,255,0.55)"
                      : "none",
                  }}
                >
                  <img
  src={tier.heroImg}
  alt={`${tier.name} option`}
  style={{
    width: "100%",
    maxWidth: 260,      // 👈 about half size
    height: "auto",
    display: "block",
    margin: "0 auto",   // 👈 keeps it centered
    borderRadius: 20,
    objectFit: "contain",
  }}
/>
                </button>

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
                        <div
                          style={{
                            fontWeight: 900,
                            fontSize: "1rem",
                            color: "#1f2a44",
                          }}
                        >
                          {tier.name}
                        </div>
                        <div
                          style={{
                            fontSize: ".95rem",
                            color: "#444",
                            marginTop: 2,
                          }}
                        >
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
                        <span
                          style={{ fontSize: ".75rem", color: "#667" }}
                        >
                          /guest
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        fontWeight: 800,
                        margin: "4px 0 6px",
                        color: "#2c62ba",
                      }}
                    >
                      This feast includes
                    </div>
                    <ul
                      style={{
                        margin: 0,
                        paddingLeft: 18,
                        lineHeight: 1.5,
                      }}
                    >
                      {tier.includes.map((line, i) => (
                        <li key={i}>{line}</li>
                      ))}
                    </ul>
                    {tier.id === "chef" && (
  <div
    style={{
      marginTop: 10,
      fontSize: "0.85rem",
      color: "#555",
      lineHeight: 1.4,
    }}
  >
    <strong>Heads up:</strong> Premium entrées are available in certain cuisines. Entrée pricing is based on the highest prcied entrée selected.
  </div>
)}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            marginTop: 16,
          }}
        >
          {selectedTier ? (
  <span className="px-prose-narrow" style={{ color: "#1f2a44" }}>
    You’ve selected <strong>{selectedTier.name}</strong> —{" "}
    <strong>${selectedTier.pricePerGuest.toFixed(0)}/guest</strong>
  </span>
) : (
  <span
    className="px-prose-narrow"
    style={{ opacity: 0.85 }}
  >
    Select a feast to continue
  </span>
)}

<button
  className="boutique-primary-btn"
  disabled={!selectedTier}
  onClick={onContinue}
  style={{
    width: 260,
    opacity: selectedTier ? 1 : 0.6,
    cursor: selectedTier ? "pointer" : "not-allowed",
  }}
>
  Continue to Menu ✨
</button>

{/* NEW BACK BUTTON */}
{onBack && (
  <button
    className="boutique-back-btn"
    onClick={onBack}
    style={{ width: 260, marginTop: "0.5rem" }}
  >
    ← Back
  </button>
)}
        </div>
      </div>
    </div>
  );
};

export default SantiTierSelector;