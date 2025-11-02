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

const CLEAR_KEYS = [
  "yumDessertSelections",
  "yumTreatType",
  "yumCupcakes",
  "yumGoodies",
  "yumCakeStyle",
  "yumFlavorFilling",
  "yumNvCupcakeEachByFlavor",
  "yumNvGoodieDozens",
];

function wipeDessertSelections() {
  try {
    CLEAR_KEYS.forEach((k) => localStorage.removeItem(k));
  } catch {}
}

const BatesDessertSelector: React.FC<Props> = ({
  onSelectType,
  onBack,
  onClose,
  onContinue,
}) => {
  const [selected, setSelected] = useState<DessertKey | "">("");

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
      blurb:
        "Cupcakes or a table of little goodies like brownies, cookies, tarts, and shooters.",
      priceLine: `Treats by the dozen $${goodiesMin}–$${goodiesMax}/dz • cupcakes $${CUPCAKE_PRICE_EACH}/ea (~$${cupcakesDozenApprox}/dz)`,
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1rem",
        boxSizing: "border-box",
      }}
    >
      <div
        className="pixie-card pixie-card--modal"
        style={{ maxWidth: 560, position: "relative" }}
      >
        {/* 🩷 Pink X */}
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

        <div
          className="pixie-card__body"
          style={{
            textAlign: "center",
            padding: "2rem 2.5rem",
          }}
        >
          <h2
            className="px-title-lg"
            style={{ marginBottom: "0.75rem", textAlign: "center" }}
          >
            Choose Your Dessert Style
          </h2>

          {/* Stacked tiles (single column, centered) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr",
              gap: 14,
              justifyItems: "center",
            }}
          >
            {TYPES.map((t) => {
              const active = selected === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setSelected(t.key)}
                  style={{
                    width: "100%",
                    maxWidth: 360,
                    textAlign: "left",
                    background: "#fff",
                    border: "1px solid #eceff6",
                    borderRadius: 16,
                    overflow: "hidden",
                    cursor: "pointer",
                    transition: "box-shadow .2s ease, transform .2s ease",
                    boxShadow: active
                      ? "0 0 28px 10px rgba(70,140,255,0.60)"
                      : "0 1px 0 rgba(0,0,0,0.03)",
                  }}
                >
                  <img
                    src={t.image}
                    alt={t.label}
                    style={{ width: "100%", display: "block" }}
                  />
                  <div
                    style={{
                      padding: "10px 12px 14px",
                      wordBreak: "break-word",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "1.2rem",
                        fontWeight: 800,
                        color: "#2c62ba",
                        marginBottom: 4,
                      }}
                    >
                      {t.label}
                    </div>
                    <div
                      style={{
                        fontSize: ".95rem",
                        color: "#444",
                        marginBottom: 6,
                      }}
                    >
                      {t.blurb}
                    </div>
                    <div style={{ fontSize: ".95rem", fontWeight: 700 }}>
                      {t.priceLine}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* CTAs */}
          {selected && (
            <button
              className="boutique-primary-btn"
              onClick={() => {
                const prev = localStorage.getItem("yumDessertType");
                if (prev !== selected) wipeDessertSelections();
                try {
                  localStorage.setItem("yumDessertType", selected);
                  localStorage.setItem("yumStep", "dessertMenu");
                } catch {}
                onSelectType(selected as DessertKey);
                onContinue();
              }}
              style={{
                display: "block",
                width: 250,
                margin: "16px auto 0",
              }}
            >
              Continue
            </button>
          )}

          <button
            className="boutique-back-btn"
            onClick={onBack}
            style={{
              display: "block",
              width: 250,
              margin: "10px auto 0",
            }}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default BatesDessertSelector;