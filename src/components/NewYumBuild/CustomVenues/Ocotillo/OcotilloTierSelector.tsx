import React, { useEffect, useMemo, useState } from "react";

// ---------- types ----------
export type OcotilloTierId = "tier1" | "tier2" | "tier3";

export interface OcotilloTierSelection {
  id: OcotilloTierId;
  name: string;
  pricePerGuest: number;
}

interface Props {
  onSelect: (selection: OcotilloTierSelection) => void;
  onContinue: () => void;
  onBack: () => void;        // ✅ added
  onClose: () => void;       // ✅ added (for pink X button)
  defaultSelectedId?: OcotilloTierId;
}

const STORAGE_KEY = "ocotillo:tierSelection";

// ---------- data ----------
const TIERS: {
  id: OcotilloTierId;
  name: string;
  pricePerGuest: number;
  heroImg: string;
}[] = [
  {
    id: "tier1",
    name: "Tier 1",
    pricePerGuest: 85,
    heroImg: `${import.meta.env.BASE_URL}assets/images/YumYum/Ocotillo/Tier1.jpg`,
  },
  {
    id: "tier2",
    name: "Tier 2",
    pricePerGuest: 110,
    heroImg: `${import.meta.env.BASE_URL}assets/images/YumYum/Ocotillo/Tier2.jpg`,
  },
  {
    id: "tier3",
    name: "Tier 3",
    pricePerGuest: 135,
    heroImg: `${import.meta.env.BASE_URL}assets/images/YumYum/Ocotillo/Tier3.jpg`,
  },
];

// ---------- component ----------
const OcotilloTierSelector: React.FC<Props> = ({
  onSelect,
  onContinue,
  onBack,
  onClose,
  defaultSelectedId,
}) => {
  const [selected, setSelected] = useState<OcotilloTierId | null>(null);

  // hydrate from localStorage (or defaultSelectedId)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: OcotilloTierSelection = JSON.parse(raw);
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

  const persist = (sel: OcotilloTierSelection) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sel));
    } catch {}
  };

  const handleChoose = (tier: (typeof TIERS)[number]) => {
    setSelected(tier.id);
    const sel: OcotilloTierSelection = {
      id: tier.id,
      name: tier.name,
      pricePerGuest: tier.pricePerGuest,
    };
    onSelect(sel);
    persist(sel);
  };

  return (
    <>
      <h2 style={styles.h2}>Choose your menu tier</h2>
      <p style={styles.sub}>
        Each tier is a full four-course buffet dinner —{" "}
        <strong>stationed appetizers, salads, entrées, and dessert</strong>.
        The only difference is the price per guest.
      </p>

      <div style={styles.grid}>
        {TIERS.map((tier) => {
          const isSelected = selected === tier.id;

          return (
            <div
              key={tier.id}
              style={{
                ...styles.card,
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
              >
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
                  </div>
                  <div style={styles.price}>
                    ${tier.pricePerGuest.toFixed(0)}{" "}
                    <span style={styles.per}>/guest</span>
                  </div>
                </div>
              </button>
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
            You’ve selected <strong>{selectedTier.name}</strong> —{" "}
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

        {/* ✅ Only the Back button, not the close button */}
        <button
          className="boutique-back-btn"
          style={{ width: "260px" }}
          onClick={onBack}
        >
          Back
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
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 14,
    maxWidth: 500,
    margin: "0 auto",
  },
  card: {
    borderRadius: 16,
    background: "#fff",
    overflow: "hidden",
    transition: "all .2s ease",
    maxWidth: 400,
    margin: "0 auto",
  },
  square: {
    position: "relative",
    width: "100%",
    paddingTop: "80%",
    overflow: "hidden",
    borderRadius: 14,
  },
  squareImg: {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    background: "#fff",
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
  tierName: {
    fontWeight: 900,
    fontSize: "1rem",
    color: "#1f2a44",
  },
  price: {
    fontWeight: 900,
    fontSize: "1rem",
    color: "#2c62ba",
    whiteSpace: "nowrap" as const,
  },
  per: {
    fontSize: ".75rem",
    color: "#667",
  },
};

export default OcotilloTierSelector;