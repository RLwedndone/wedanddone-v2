import React, { useMemo, useState } from "react";
import { DESSERT_PRICING, GOODIE_CATALOG } from "../../dessert/dessertPricing";

interface Props {
  onSelectType: (type: "tieredCake" | "smallCakeTreats" | "treatsOnly") => void;
  onBack?: () => void;
  onClose?: () => void;
  onContinue: () => void;
}

type DessertKey = "tieredCake" | "smallCakeTreats" | "treatsOnly";

const { PER_GUEST_TIERED, SMALL_CAKE_PRICE, CUPCAKE_PRICE_EACH } = DESSERT_PRICING;

/** Schnepf-specific keys so we don't collide with Vic/Verrado */
const CLEAR_KEYS = [
  "schnepfDessertSelections",
  "schnepfTreatType",
  "schnepfCupcakes",
  "schnepfGoodies",
  "schnepfCakeStyle",
  "schnepfFlavorFilling",
  "schnepfNvCupcakeEach",
  "schnepfNvGoodieDozens",
];

/** wipe only Schnepf dessert state when type changes */
function wipeDessertSelections() {
  try {
    CLEAR_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

const SchnepfDessertSelector: React.FC<Props> = ({
  onSelectType,
  onBack,
  onClose, // kept for parity
  onContinue,
}) => {
  const [selected, setSelected] = useState<DessertKey | "">("");

  // Build goodies price range dynamically from catalog
  const { goodiesMin, goodiesMax } = useMemo(() => {
    const prices = Object.values(GOODIE_CATALOG)
      .map((g: any) => Number(g?.retailPerDozen ?? g?.pricePerDozen ?? 0))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!prices.length) return { goodiesMin: 0, goodiesMax: 0 };
    return { goodiesMin: Math.min(...prices), goodiesMax: Math.max(...prices) };
  }, []);

  const cupcakesDozenApprox = CUPCAKE_PRICE_EACH * 12;

  const TYPES: {
    key: DessertKey;
    label: string;
    image: string;
    blurb: string;
    priceLine: string;
  }[] = [
    {
      key: "tieredCake",
      label: "Tiered Cake",
      image: "/assets/images/YumYum/cake.png",
      blurb: "A traditional multi-tiered wedding cake.",
      priceLine: `$${PER_GUEST_TIERED}/guest`,
    },
    {
      key: "smallCakeTreats",
      label: "Small Cake & Treats",
      image: "/assets/images/YumYum/small_cake.png",
      blurb: "A small cake for cutting plus a table of treats.",
      priceLine: `Small cutting cake $${SMALL_CAKE_PRICE} • treats $${goodiesMin}–$${goodiesMax}/dz • cupcakes $${CUPCAKE_PRICE_EACH}/ea (~$${cupcakesDozenApprox}/dz)`,
    },
    {
      key: "treatsOnly",
      label: "Treats Table Only",
      image: "/assets/images/YumYum/treats.png",
      blurb:
        "Cupcakes or a table of little goodies like brownies, cookies, tarts, and shooters.",
      priceLine: `Treats by the dozen $${goodiesMin}–$${goodiesMax}/dz • cupcakes $${CUPCAKE_PRICE_EACH}/ea (~$${cupcakesDozenApprox}/dz)`,
    },
  ];

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 680, position: "relative" }}>
      {/* 🩷 Pink X Close */}
      {onClose && (
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src="/assets/icons/pink_ex.png" alt="Close" />
        </button>
      )}
  
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2
          className="px-title"
          style={{
            fontFamily: "'Jenna Sue', cursive",
            fontSize: "2rem",
            color: "#2c62ba",
            marginBottom: 8,
          }}
        >
          Choose Your Dessert Style
        </h2>
  
        {/* Options grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "1rem",
            justifyItems: "center",
            margin: "14px 0 8px",
          }}
        >
          {TYPES.map((t) => {
            const active = selected === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setSelected(t.key)}
                aria-pressed={active}
                className="px-card-btn"
                style={{
                  width: "100%",
                  maxWidth: 360,
                  textAlign: "left",
                  background: "#fff",
                  border: active ? "3px solid #2c62ba" : "1.5px solid #e7e7e7",
                  borderRadius: 16,
                  overflow: "hidden",
                  cursor: "pointer",
                  boxShadow: active
                    ? "0 0 0 4px rgba(44,98,186,0.10)"
                    : "0 1px 0 rgba(0,0,0,0.03)",
                  transition: "transform .2s ease",
                }}
              >
                <img
                  src={t.image}
                  alt={t.label}
                  className="px-media"
                  style={{ width: "100%", display: "block" }}
                />
  
                {/* Left-aligned text content (matches Yum style) */}
                <div
                  style={{
                    padding: "12px 14px 16px",
                    wordBreak: "break-word",
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      fontSize: "1.2rem",
                      fontWeight: 800,
                      color: "#2c62ba",
                      marginBottom: 6,
                      textAlign: "left",
                    }}
                  >
                    {t.label}
                  </div>
  
                  <div
                    style={{
                      fontSize: "1rem",
                      lineHeight: 1.45,
                      color: "#333",
                      marginBottom: 8,
                      textAlign: "left",
                    }}
                  >
                    {t.blurb}
                  </div>
  
                  <div
                    style={{
                      fontSize: "1.05rem",
                      fontWeight: 700,
                      color: "#000",
                      textAlign: "left",
                    }}
                  >
                    {t.priceLine}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
  
        {/* CTAs */}
        <div className="px-cta-col" style={{ marginTop: 10 }}>
          <button
            className="boutique-primary-btn"
            disabled={!selected}
            onClick={() => {
              const prev = localStorage.getItem("schnepfDessertType");
              if (prev !== selected) wipeDessertSelections();
              try {
                localStorage.setItem("schnepfDessertType", selected as DessertKey);
                localStorage.setItem("yumStep", "schnepfDessertMenu");
              } catch {}
              onSelectType(selected as DessertKey);
              onContinue();
            }}
            style={{ width: 260 }}
          >
            Continue
          </button>
  
          {onBack && (
            <button
              className="boutique-back-btn"
              onClick={onBack}
              style={{ width: 260, marginTop: 10 }}
            >
              ⬅ Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SchnepfDessertSelector;