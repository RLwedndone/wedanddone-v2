import React, { useEffect, useMemo, useState } from "react";

// ---------- types ----------
export type FlowerTierId = "sunflower" | "rose" | "lily" | "dahlia";

export interface TierAllowances {
  hors: number;      // hors d'oeuvres allowed
  salads: number;    // salads allowed
  entrees: number;   // entrées allowed
}

export interface FlowerTier {
  id: FlowerTierId;
  name: string;
  pricePerGuest: number;      // used by cart
  heroImg: string;            // local asset path
  blurb: string;              // short one-liner
  includes: string[];         // for the dropdown
  allowances: TierAllowances; // enforces menu pick counts later
  perks?: {
    champagneToast?: boolean;
    coffeeStation?: boolean;
    dessertStation?: boolean;
    chargerChoice?: boolean;
  };
}

// what we send upward when user confirms
export interface FlowerTierSelection {
  id: FlowerTierId;
  name: string;
  pricePerGuest: number;
  allowances: TierAllowances;
  perks?: FlowerTier["perks"];
}

interface Props {
  venueName: "The Vic" | "The Verrado";
  onSelect: (selection: FlowerTierSelection) => void; // fire when chosen
  onContinue: () => void;                             // CTA
  defaultSelectedId?: FlowerTierId;                   // optional
}

const STORAGE_KEY = "vv:flowerTier";

// ---------- data (exact copy per your spec) ----------
const TIERS: FlowerTier[] = [
  {
    id: "sunflower",
    name: "Sunflower",
    pricePerGuest: 69,
    heroImg: `${import.meta.env.BASE_URL}assets/images/YumYum/sunflower.png`,
    blurb: "Bright, joyful, and beautifully simple.",
    includes: [
      "One salad selection",
      "One entrée selection",
      "Bread service",
      "Cake cutting service",
      "Infused water, iced tea & lemonade station",
    ],
    allowances: { hors: 0, salads: 1, entrees: 1 },
    perks: {},
  },
  {
    id: "rose",
    name: "Rose",
    pricePerGuest: 79,
    heroImg: `${import.meta.env.BASE_URL}assets/images/YumYum/rose.png`,
    blurb: "Romantic classics with a polished touch.",
    includes: [
      "One hors d’oeuvre",
      "One salad selection",
      "One entrée selection",
      "Bread service",
      "Cake cutting service",
      "Infused water, iced tea & lemonade station",
      "Champagne toast",
    ],
    allowances: { hors: 1, salads: 1, entrees: 1 },
    perks: { champagneToast: true },
  },
  {
    id: "lily",
    name: "Lily",
    pricePerGuest: 89,
    heroImg: `${import.meta.env.BASE_URL}assets/images/YumYum/lily.png`,
    blurb: "Elevated flavors & guest-pleasing variety.",
    includes: [
      "Two hors d’oeuvres",
      "One salad selection",
      "Two entrée selections",
      "Bread service",
      "Cake cutting service",
      "Infused water, iced tea & lemonade station",
      "Champagne toast",
      "Coffee station",
    ],
    allowances: { hors: 2, salads: 1, entrees: 2 },
    perks: { champagneToast: true, coffeeStation: true },
  },
  {
    id: "dahlia",
    name: "Dahlia",
    pricePerGuest: 99,
    heroImg: `${import.meta.env.BASE_URL}assets/images/YumYum/dahlia.png`,
    blurb: "Premium, show-stopping culinary experience.",
    includes: [
      "Three hors d’oeuvres",
      "One salad selection",
      "Three entrée selections",
      "Bread service",
      "Custom wedding cake",
      "Cake cutting service & mini dessert station",
      "Infused water, iced tea & lemonade station",
      "Champagne toast",
      "Coffee station",
      "Choice of charger",
    ],
    allowances: { hors: 3, salads: 1, entrees: 3 },
    perks: {
      champagneToast: true,
      coffeeStation: true,
      dessertStation: true,
      chargerChoice: true,
    },
  },
];

// ---------- component ----------
const FlowerTierSelector: React.FC<Props> = ({
  venueName,
  onSelect,
  onContinue,
  defaultSelectedId,
}) => {
  const [expanded, setExpanded] = useState<FlowerTierId | null>(null);
  const [selected, setSelected] = useState<FlowerTierId | null>(null);

  // hydrate from localStorage (or defaultSelectedId)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: FlowerTierSelection = JSON.parse(raw);
        setSelected(parsed.id);
      } else if (defaultSelectedId) {
        setSelected(defaultSelectedId);
      }
    } catch {
      /* noop */
    }
  }, [defaultSelectedId]);

  const selectedTier = useMemo(
    () => TIERS.find((t) => t.id === selected) || null,
    [selected]
  );

  const persist = (sel: FlowerTierSelection) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sel));
    } catch {}
  };

  const handleChoose = (tier: FlowerTier) => {
    setSelected(tier.id);
    const sel: FlowerTierSelection = {
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

  return (
    <>
      <h2 style={styles.h2}>Choose your menu tier</h2>
      <p style={styles.sub}>
        Pick your floral-themed tier to set your <strong>per-guest price</strong> and
        unlock how many delicious picks you can make for hors d’oeuvres, salads,
        and entrées.
      </p>

      <div style={styles.grid}>
        {TIERS.map((tier) => {
          const isSelected = selected === tier.id;
          const isExpanded = expanded === tier.id;

          return (
            <div
              key={tier.id}
              style={{
                ...styles.card,
                ...(isExpanded ? styles.cardExpanded : {}),
                outline: isSelected ? "3px solid #2c62ba" : "1px solid #e8ecff",
                boxShadow: isSelected
                  ? "0 10px 28px rgba(44,98,186,.25)"
                  : "0 8px 18px rgba(0,0,0,.08)",
              }}
            >
              <button
                onClick={() => handleChoose(tier)}
                style={styles.cardButton}
                aria-pressed={isSelected}
                aria-expanded={isExpanded}
              >
                {/* square image */}
                <div style={styles.square}>
                  <img
                    src={tier.heroImg}
                    alt={`${tier.name} tier`}
                    style={styles.squareImg}
                  />
                </div>
          
                <div style={styles.cardHeader}>
                  <div>
                    <div style={styles.tierName}>{tier.name}</div>
                    <div style={styles.blurb}>{tier.blurb}</div>
                  </div>
                  <div style={styles.price}>
                    ${tier.pricePerGuest.toFixed(0)} <span style={styles.per}>/guest</span>
                  </div>
                </div>
              </button>
          
              {/* expandable details */}
              {isExpanded && (
  <div style={styles.details}>
    <div style={styles.detailsTitle}>Package includes</div>
    <ul style={styles.list}>
      {tier.includes.map((line, i) => (
        <li key={i}>{line}</li>
      ))}
    </ul>
    <div style={{ textAlign: "center", marginTop: 10 }}>
      <button
        className="boutique-back-btn"
        onClick={() =>
          setExpanded((cur) => (cur === tier.id ? null : tier.id))
        }
      >
        {isExpanded ? "Hide details" : "See details"}
      </button>
    </div>
  </div>
)}
            </div>
          );
        })}
      </div>

     {/* footer / selection summary */}
<div
  style={{
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.75rem",
    marginTop: "1.5rem",
  }}
>
  {selectedTier ? (
    <span style={{ fontSize: "1rem", color: "#1f2a44" }}>
      You’ve selected the <strong>{selectedTier.name}</strong> menu —{" "}
      <strong>${selectedTier.pricePerGuest.toFixed(0)}/guest</strong>
    </span>
  ) : (
    <span style={{ opacity: 0.8 }}>Select a tier to continue</span>
  )}

  <button
    className="boutique-primary-btn"
    disabled={!selectedTier}
    onClick={onContinue}
    style={{
      opacity: selectedTier ? 1 : 0.6,
      cursor: selectedTier ? "pointer" : "not-allowed",
      width: "260px",
    }}
  >
    Continue to Menu ✨
  </button>
</div>
    </>
  );
};

// ---------- styles ----------
const styles: Record<string, React.CSSProperties> = {
  h2: {
    margin: "0 0 .25rem",
    color: "#2c62ba",
    fontSize: "1.65rem",
    textAlign: "center",
    fontWeight: 800,
  },
  sub: {
    textAlign: "center",
    margin: "0 0 1.25rem",
    color: "#333",
  },

  // compact square tiles (auto wraps)
  grid: {
  display: "grid",
  gridTemplateColumns: "1fr",  // single column
  gap: 14,
  maxWidth: 500,              // constrain width like other boutiques
  margin: "0 auto",           // center the whole grid
},

card: {
  borderRadius: 16,
  background: "#fff",
  overflow: "hidden",
  transition: "all .2s ease",
  maxWidth: 400,              // tighter cards
  margin: "0 auto",           // center each card
},

// square image container, but smaller
square: {
  position: "relative",
  width: "100%",
  paddingTop: "80%",          // less tall than perfect square
  overflow: "hidden",
  borderRadius: 14,
},

squareImg: {
  position: "absolute",
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "contain",       // don’t zoom in on flowers
  display: "block",
  background: "#fff",
},
  // when expanded, span the full row for details
  cardExpanded: {
    gridColumn: "1 / -1",
  },

  cardButton: {
    display: "block",
    width: "100%",
    background: "transparent",
    border: "none",
    textAlign: "left" as const,
    padding: 0,
    cursor: "pointer",
  },

  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 12px",
    gap: 10,
  },
  tierName: { fontWeight: 900, fontSize: "1rem", color: "#1f2a44" },
  blurb: { fontSize: ".9rem", color: "#556", marginTop: 2 },
  allowWrap: { marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" as const },
  allowPill: {
    border: "1px solid #e6ebff",
    background: "#f6f8ff",
    color: "#2c62ba",
    borderRadius: 999,
    padding: "2px 6px",
    fontSize: 11,
    fontWeight: 800,
  },
  price: { fontWeight: 900, fontSize: "1rem", color: "#2c62ba", whiteSpace: "nowrap" as const },
  per: { fontSize: ".75rem", color: "#667" },

  details: { padding: "0 12px 12px" },
  detailsTitle: { fontWeight: 800, margin: "4px 0 6px", color: "#2c62ba" },
  list: { margin: 0, paddingLeft: "18px", lineHeight: 1.5 },

  footer: {
    marginTop: 16,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap" as const,
  },
};

export default FlowerTierSelector;