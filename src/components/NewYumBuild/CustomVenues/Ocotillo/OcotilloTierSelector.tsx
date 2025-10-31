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
  onBack: () => void;
  onClose: () => void;
  defaultSelectedId?: OcotilloTierId;
}

const STORAGE_KEY = "ocotillo:tierSelection";

// ---------- data ----------
const TIERS: {
  id: OcotilloTierId;
  name: string;
  pricePerGuest: number;
  heroImg: string;
  blurbHeader: string;
  blurbSubhead: string;
  blurbBody: string;
}[] = [
  {
    id: "tier1",
    name: "Tier 1",
    pricePerGuest: 85,
    heroImg: `${import.meta.env.BASE_URL}assets/images/YumYum/Ocotillo/Tier1.jpg`,
    blurbHeader: "Tier 1 — Classic Celebration",
    blurbSubhead: "Comfort food with a chef’s kiss.",
    blurbBody:
      "Includes crowd-pleasing favorites like herb-roasted chicken with lemon jus, slow-braised short ribs, and seasonal roasted vegetables. Perfect for couples who love a traditional, elegant dinner that feels homey yet elevated.",
  },
  {
    id: "tier2",
    name: "Tier 2",
    pricePerGuest: 110,
    heroImg: `${import.meta.env.BASE_URL}assets/images/YumYum/Ocotillo/Tier2.jpg`,
    blurbHeader: "Tier 2 — Signature Soirée",
    blurbSubhead: "A step up in flair and flavor.",
    blurbBody:
      "Showcases dishes like grilled salmon with citrus beurre blanc, chimichurri-marinated steak, and truffle whipped potatoes — plus premium presentation touches. Ideal for foodies who want a polished, restaurant-style experience.",
  },
  {
    id: "tier3",
    name: "Tier 3",
    pricePerGuest: 135,
    heroImg: `${import.meta.env.BASE_URL}assets/images/YumYum/Ocotillo/Tier3.jpg`,
    blurbHeader: "Tier 3 — Chef’s Showcase",
    blurbSubhead: "The wow-factor wedding menu.",
    blurbBody:
      "Features filet medallions with red wine demi-glace, pesto-stuffed chicken roulade, and pan-seared sea bass with champagne cream — all crafted with upscale plating and extra sides. A luxurious, multi-course feast for couples who want their guests talking about dinner all night long.",
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
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 680 }}>
      {/* 💖 Pink X Close */}
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

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        {/* title */}
        <h2
          style={{
            margin: "0 0 0.5rem",
            color: "#2c62ba",
            fontSize: "2.2rem",
            textAlign: "center",
            fontWeight: 800,
          }}
        >
          Choose your menu tier
        </h2>

        <p style={styles.sub}>
          Each tier is a full four-course buffet dinner —{" "}
          <strong>stationed appetizers, salads, entrées, and dessert</strong>.
          The only difference is the price per guest.
        </p>

        {/* Tier list */}
        <div style={styles.tierList}>
          {TIERS.map((tier) => {
            const isSelected = selected === tier.id;

            return (
              <button
                key={tier.id}
                onClick={() => handleChoose(tier)}
                style={{
                  ...styles.tierButton,
                  height: isSelected ? 360 : 260,
                  boxShadow: isSelected
                    ? "0 0 28px rgba(44,98,186,0.45)"
                    : "0 6px 16px rgba(0,0,0,.1)",
                  transform: isSelected ? "scale(1.03)" : "scale(1)",
                }}
                aria-pressed={isSelected}
              >
                {/* image area */}
                <div style={styles.imgWrap}>
                  <img
                    src={tier.heroImg}
                    alt={tier.name}
                    style={styles.img}
                  />
                </div>

                {/* price row */}
                <div style={styles.priceRow}>
                  <span style={styles.priceMain}>
                    ${tier.pricePerGuest.toFixed(0)}
                  </span>
                  <span style={styles.priceSub}>/guest</span>
                </div>

                {/* blurb (only if selected) */}
                <div
                  style={{
                    ...styles.blurbBlock,
                    opacity: isSelected ? 1 : 0,
                    maxHeight: isSelected ? 200 : 0,
                  }}
                >
                  <div
                    style={{
                      fontWeight: 800,
                      color: "#2c62ba",
                      fontSize: ".9rem",
                      lineHeight: 1.4,
                      marginBottom: "0.4rem",
                      textAlign: "center",
                    }}
                  >
                    {tier.blurbHeader}
                  </div>

                  <div
                    style={{
                      color: "#1f2a44",
                      fontSize: ".9rem",
                      lineHeight: 1.4,
                      textAlign: "center",
                    }}
                  >
                    <strong>{tier.blurbSubhead}</strong>{" "}
                    {tier.blurbBody}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* footer / summary / nav */}
        <div style={styles.footerBlock}>
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

          <button
            className="boutique-back-btn"
            style={{ width: "260px" }}
            onClick={onBack}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
};

// ---------- styles ----------
const styles: Record<string, React.CSSProperties> = {
  sub: {
    textAlign: "center",
    margin: "0 0 1.5rem",
    color: "#333",
    lineHeight: 1.45,
    fontSize: "1rem",
    maxWidth: 560,
    marginLeft: "auto",
    marginRight: "auto",
  },

  tierList: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "1.25rem",
    marginBottom: "1.5rem",
  },

  tierButton: {
    width: 260,
    borderRadius: 20,
    background: "#fff",
    display: "flex",
    flexDirection: "column" as const,
    justifyContent: "flex-start",
    alignItems: "stretch",
    padding: "0.75rem 0.75rem 0.75rem",
    cursor: "pointer",
    textAlign: "left" as const,
    transition: "all .25s ease",
    border: "1px solid #e4e8ff",
    overflow: "hidden", // important for maxHeight anim
  },

  imgWrap: {
    flex: "0 0 auto",
    borderRadius: 16,
    overflow: "hidden",
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: 140,
  },

  img: {
    maxWidth: "100%",
    maxHeight: "100%",
    objectFit: "contain",
    display: "block",
  },

  priceRow: {
    flexShrink: 0,
    paddingTop: "0.5rem",
    display: "flex",
    alignItems: "baseline",
    justifyContent: "center",
    gap: "0.4rem",
  },
  priceMain: {
    fontWeight: 800,
    fontSize: "1.1rem",
    color: "#2c62ba",
    lineHeight: 1.1,
  },
  priceSub: {
    fontSize: ".8rem",
    color: "#444a63",
    lineHeight: 1.1,
  },

  blurbBlock: {
    transition: "all .25s ease",
    overflow: "hidden",
    marginTop: "0.5rem",
    padding: "0 0.5rem 0.25rem",
  },

  footerBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0.75rem",
    marginTop: "0.5rem",
  },
};

export default OcotilloTierSelector;