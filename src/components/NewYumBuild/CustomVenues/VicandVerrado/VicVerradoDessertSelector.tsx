// src/components/NewYumBuild/CustomVenues/VicandVerrado/VicVerradoDessertSelector.tsx
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

// Keys to clear when user changes dessert type (keep guest count intact)
const CLEAR_KEYS = [
  "yumDessertSelections",
  "yumTreatType",
  "yumCupcakes",
  "yumGoodies",
  "yumCakeStyle",
  "yumFlavorFilling",
  "yumNvCupcakeEach",
  "yumNvGoodieDozens",
];

function wipeDessertSelections() {
  try {
    CLEAR_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

const VicVerradoDessertSelector: React.FC<Props> = ({
  onSelectType,
  onBack,
  onClose, // kept for parity
  onContinue,
}) => {
  const [selected, setSelected] = useState<DessertKey | "">("");

  // Build goodies price range dynamically (so custom catalogs stay in sync)
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
      image: `${import.meta.env.BASE_URL}assets/images/YumYum/cake.png`,
      blurb: "A traditional multi-tiered wedding cake.",
      priceLine: `$${PER_GUEST_TIERED}/guest`,
    },
    {
      key: "smallCakeTreats",
      label: "Small Cake & Treats",
      image: `${import.meta.env.BASE_URL}assets/images/YumYum/small_cake.png`,
      blurb: "A small cake for cutting plus a table of treats.",
      priceLine: `Small cutting cake $${SMALL_CAKE_PRICE} • treats $${goodiesMin}–$${goodiesMax}/dz • cupcakes $${CUPCAKE_PRICE_EACH}/ea (~$${cupcakesDozenApprox}/dz)`,
    },
    {
      key: "treatsOnly",
      label: "Treats Table Only",
      image: `${import.meta.env.BASE_URL}assets/images/YumYum/treats.png`,
      blurb: "Cupcakes or a table of little goodies like brownies, cookies, tarts, and shooters.",
      priceLine: `Treats by the dozen $${goodiesMin}–$${goodiesMax}/dz • cupcakes $${CUPCAKE_PRICE_EACH}/ea (~$${cupcakesDozenApprox}/dz)`,
    },
  ];

  return (
    <>
      <h2 style={{ fontSize: "2.1rem", marginBottom: "1rem", textAlign: "center", color: "#2c62ba" }}>
        Choose Your Dessert Style
      </h2>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr",
          gap: "1rem",
          justifyItems: "center",
        }}
      >
        {TYPES.map((t) => {
          const active = selected === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setSelected(t.key)}
              style={{
                width: "100%",
                maxWidth: "360px",
                textAlign: "left",
                background: "#fff",
                border: active ? "3px solid #2c62ba" : "1.5px solid #e7e7e7",
                borderRadius: 16,
                overflow: "hidden",
                cursor: "pointer",
                boxShadow: active ? "0 0 0 4px rgba(44,98,186,0.10)" : "0 1px 0 rgba(0,0,0,0.03)",
              }}
            >
              <img src={t.image} alt={t.label} style={{ width: "100%", display: "block" }} />
              <div style={{ padding: "0.75rem 0.9rem 1rem", wordBreak: "break-word" }}>
                <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#2c62ba", marginBottom: 4 }}>
                  {t.label}
                </div>
                <div style={{ fontSize: ".95rem", color: "#444", marginBottom: 6 }}>{t.blurb}</div>
                <div style={{ fontSize: ".95rem", fontWeight: 700 }}>{t.priceLine}</div>
              </div>
            </button>
          );
        })}
      </div>

      {selected && (
        <button
          className="boutique-primary-btn"
          onClick={() => {
            // if user changed the dessert type, wipe downstream selections
            const prev = localStorage.getItem("yumDessertType");
            if (prev !== selected) wipeDessertSelections();

            try {
              localStorage.setItem("yumDessertType", selected);
              localStorage.setItem("yumStep", "dessertMenu");
            } catch {}
            onSelectType(selected as DessertKey);
            onContinue();
          }}
          style={{ display: "block", width: 260, margin: "1.5rem auto 0" }}
        >
          Continue
        </button>
      )}

      <div style={{ textAlign: "center", marginTop: "1rem" }}>
        <button className="boutique-back-btn" onClick={onBack} style={{ width: 260 }}>
          Back
        </button>
      </div>
    </>
  );
};

export default VicVerradoDessertSelector;