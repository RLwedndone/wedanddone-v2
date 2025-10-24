import React, { useEffect, useMemo, useState } from "react";

/* =========================
   Types
========================= */
export type CuisineId =
  | "bbq"
  | "taco_bar"
  | "rustic_italian"
  | "classic_chicken"
  | "live_pasta"
  | "wood_fired_pizza"
  | "prime_rib";

export interface Cuisine {
  id: CuisineId;
  name: string;
  priceLabel: string;   // human-readable (may be a range / plus fee)
  heroImg: string;      // local asset path
  details: string;      // one-line details shown under price
  includes: string[];   // bullets shown when expanded
}

export interface CuisineSelection {
  id: CuisineId;
  name: string;
  priceLabel: string;
}

interface Props {
  onSelect: (selection: CuisineSelection) => void;
  onContinue: () => void;
  onBack: () => void;                 // 👈 NEW
  defaultSelectedId?: CuisineId;
}

const STORAGE_KEY = "schnepf:cuisine";

/* =========================
   Data
========================= */
const CUISINES: Cuisine[] = [
  {
    id: "bbq",
    name: "BBQ Dinner",
    priceLabel: "$26.50 – $34.75 per person",
    heroImg: "/assets/images/YumYum/Schnepf/bbq.png",
    details: "Your choice of BBQ entrée, One Salad, Two Sides",
    includes: ["Choose one BBQ entrée", "One salad", "Two sides"],
  },
  {
    id: "taco_bar",
    name: "Taco Bar",
    priceLabel: "$26.50 per person + $200 chef fee",
    heroImg: "/assets/images/YumYum/tacoBar.png",
    details:
      "Chicken & steak street tacos (corn or flour), One Salad, Chips, Rice, Beans, Quesadillas",
    includes: [
      "Chicken & steak street tacos (corn or flour tortillas)",
      "One salad",
      "Chips & salsa",
      "Spanish rice & beans",
      "Cheese quesadillas",
    ],
  },
  {
    id: "rustic_italian",
    name: "Rustic Italian",
    priceLabel: "$30.50 – $35.95 per person",
    heroImg: "/assets/images/YumYum/Schnepf/italian.png",
    details: "Your choice of Italian entrée, One Salad, Two Sides",
    includes: [
      "Choose one Italian entrée",
      "One salad",
      "Two sides",
      "Fresh baked baguette & butter",
    ],
  },
  {
    id: "classic_chicken",
    name: "Classic Chicken Dinner",
    priceLabel: "$30.50 per person",
    heroImg: "/assets/images/YumYum/Schnepf/chicken.png",
    details: "Your choice of Chicken entrée, One Salad, Two Sides",
    includes: [
      "Choose one chicken entrée",
      "One salad",
      "Two sides",
      "Fresh baked baguette & butter",
    ],
  },
  {
    id: "live_pasta",
    name: "Live Action Pasta Bar",
    priceLabel: "$31.50 per person + $200 chef fee",
    heroImg: "/assets/images/YumYum/Schnepf/pasta.png",
    details:
      "Penne pasta with chicken & sausage, guest’s choice of sauce, baguette & butter, One Salad",
    includes: [
      "Live chef station",
      "Penne pasta with chicken & sausage",
      "Guest’s choice of sauce",
      "One salad",
      "Fresh baked baguette & butter",
    ],
  },
  {
    id: "wood_fired_pizza",
    name: "Wood Fired Pizza Bar",
    priceLabel: "$29.50 per person + $200 chef fee",
    heroImg: "/assets/images/YumYum/Schnepf/pizza.png",
    details: "French thin-crust pizzas, baguette & butter, One Salad",
    includes: [
      "Assorted French thin-crust pizzas",
      "One salad",
      "Fresh baked baguette & butter",
    ],
  },
  {
    id: "prime_rib",
    name: "Prime Rib",
    priceLabel: "$61.95 per person + $200 chef fee",
    heroImg: "/assets/images/YumYum/Schnepf/pime_rib.png",
    details:
      "Prime rib carving station, baguette & butter, One Salad, Two Sides",
    includes: [
      "Prime rib carving station",
      "One salad",
      "Two sides",
      "Fresh baked baguette & butter",
    ],
  },
];

/* =========================
   Component
========================= */
const SchnepfCuisineSelector: React.FC<Props> = ({
  onSelect,
  onContinue,
  onBack,                 // 👈 NEW
  defaultSelectedId,
}) => {
  const [expanded, setExpanded] = useState<CuisineId | null>(null);
  const [selected, setSelected] = useState<CuisineId | null>(null);

  // hydrate selection
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: CuisineSelection = JSON.parse(raw);
        setSelected(parsed.id);
      } else if (defaultSelectedId) {
        setSelected(defaultSelectedId);
      }
    } catch {
      /* noop */
    }
  }, [defaultSelectedId]);

  const selectedCuisine = useMemo(
    () => CUISINES.find((c) => c.id === selected) || null,
    [selected]
  );

  const persist = (sel: CuisineSelection) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sel));
    } catch {}
  };

  const handleChoose = (c: Cuisine) => {
    setSelected(c.id);
    const sel: CuisineSelection = {
      id: c.id,
      name: c.name,
      priceLabel: c.priceLabel,
    };
    onSelect(sel);
    persist(sel);
    setExpanded((cur) => (cur === c.id ? cur : c.id));
  };

  return (
    <div
    className="pixie-card"
    style={{
      maxWidth: 700,
      paddingTop: 28,
      paddingBottom: 28,
      paddingLeft: 24,
      paddingRight: 24,
      margin: "0 auto",
      boxSizing: "border-box",
    }}
  >
      {/* Header */}
      <h2
        style={{
          fontFamily: "'Jenna Sue','JennaSue',cursive",
          color: "#2c62ba",
          fontSize: "2rem",
          textAlign: "center",
          margin: "0 0 10px",
          lineHeight: 1.1,
        }}
      >
        Choose your cuisine
      </h2>
  
      <p className="px-prose-narrow" style={{ textAlign: "center", margin: "0 auto 18px", maxWidth: 560 }}>
        Tap a tile to preview what’s included. You’ll choose salads, entrées, and sides next.
      </p>
  
      {/* Cuisine Tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 22,
          alignItems: "start",
        }}
      >
        {CUISINES.map((c) => {
          const isActive = selected === c.id;
  
          return (
            <div key={c.id} style={{ maxWidth: 380, justifySelf: "center" }}>
              {/* Title and Price */}
              <div style={{ fontWeight: 900, fontSize: "1.05rem", color: "#1f2a44" }}>{c.name}</div>
              <div style={{ fontWeight: 900, fontSize: ".95rem", color: "#2c62ba", marginBottom: 6 }}>{c.priceLabel}</div>
  
              {/* Image Tile */}
              <div
                role="button"
                tabIndex={0}
                aria-label={`Select ${c.name}`}
                onClick={() => handleChoose(c)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleChoose(c)}
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                  cursor: "pointer",
                  border: isActive ? "3px solid #2c62ba" : "1px solid #e8ecff",
                  boxShadow: isActive ? "0 10px 28px rgba(44,98,186,.25)" : "0 8px 18px rgba(0,0,0,.08)",
                  outline: "none",
                }}
              >
                <img
                  src={c.heroImg}
                  alt={c.name}
                  style={{ display: "block", width: "100%", height: "auto", objectFit: "cover" }}
                />
              </div>
  
              {/* Small detail line */}
              <div style={{ marginTop: 6, color: "#556", fontSize: ".9rem" }}>{c.details}</div>
  
              {/* Expanded info */}
              {isActive && (
                <div
                  style={{
                    marginTop: 10,
                    padding: "10px 12px",
                    borderRadius: 12,
                    background: "#f7fbff",
                    border: "1px solid #d6ebff",
                    textAlign: "left",
                  }}
                >
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>This dinner includes</div>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {c.includes.map((line, i) => (
                      <li key={i} style={{ marginBottom: 6 }}>
                        {line}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>
  
      {/* Footer */}
<div
  className="px-cta-col"
  style={{
    marginTop: 24,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
  }}
>
  <div style={{ fontSize: "0.98rem", minHeight: 20, textAlign: "center" }}>
    {selectedCuisine ? (
      <>
        You’ve selected <strong>{selectedCuisine.name}</strong> —{" "}
        <strong>{selectedCuisine.priceLabel}</strong>
      </>
    ) : (
      <span style={{ opacity: 0.8 }}>Select a cuisine to continue</span>
    )}
  </div>

  {/* Buttons stacked */}
  <button
    className="boutique-primary-btn"
    onClick={onContinue}
    disabled={!selectedCuisine}
    style={{
      width: 260,
      opacity: selectedCuisine ? 1 : 0.6,
      cursor: selectedCuisine ? "pointer" : "not-allowed",
    }}
  >
    Continue to Menu ✨
  </button>
  <button
    className="boutique-back-btn"
    onClick={onBack}
    style={{ width: 260 }}
  >
    ⬅ Back
  </button>
      </div>
    </div>
  );
};

export default SchnepfCuisineSelector;