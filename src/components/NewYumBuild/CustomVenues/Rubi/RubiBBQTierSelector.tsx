// src/components/NewYumBuild/CustomVenues/Rubi/RubiBBQTierSelector.tsx
import React, { useState } from "react";

/** BBQ-only ids */
export type RubiBBQTierId = "bbq_casual" | "bbq_standard" | "bbq_feast";

/** Selection payload for BBQ tiers (standalone) */
export type RubiTierSelectionBBQ = {
  id: RubiBBQTierId;         // only BBQ ids in this file
  prettyName: string;
  pricePerGuest: number;
  counts: {
    passedApps?: number;
    startersOrSoup?: number;
    entrees?: number;
    meats?: number;
    sides?: number;
    desserts?: number;
  };
};

type TierDef = {
  name: string;
  price: number;
  image: string;
  infoTitle: string;
  blurb: string;
  counts: RubiTierSelectionBBQ["counts"];
};

interface Props {
  defaultSelectedId?: RubiBBQTierId;
  onSelect: (sel: RubiTierSelectionBBQ) => void;
  onBack: () => void;
  onContinue: () => void;
  onClose?: () => void;
}

const BBQ_TIERS: Record<RubiBBQTierId, TierDef> = {
  bbq_casual: {
    name: "Casual BroJo",
    price: 32,
    image: `${import.meta.env.BASE_URL}assets/images/YumYum/Rubi/casual.jpg`,
    infoTitle: "CASUAL • $32 • Select 1 starter, 2 meats, 3 sides",
    blurb: "Great value: one starter, two pit-smoked meats, and three classic sides.",
    counts: { startersOrSoup: 1, meats: 2, sides: 3 },
  },
  bbq_standard: {
    name: "Standard BroJo",
    price: 38,
    image: `${import.meta.env.BASE_URL}assets/images/YumYum/Rubi/standard.jpg`,
    infoTitle: "STANDARD • $38 • Select 1 starter, 3 meats, 3 sides, 1 dessert",
    blurb: "Most popular: one starter, three meats, three sides, plus dessert.",
    counts: { startersOrSoup: 1, meats: 3, sides: 3, desserts: 1 },
  },
  bbq_feast: {
    name: "BroJo’s Feast",
    price: 45,
    image: "assets/images/YumYum/Rubi/feast.jpg",
    infoTitle: "FEAST • $45 • Select 1 starter, 3 meats, 4 sides, 2 desserts",
    blurb: "Max variety: one starter, three meats, four sides, and two desserts.",
    counts: { startersOrSoup: 1, meats: 3, sides: 4, desserts: 2 },
  },
};

const blue = "#2c62ba";

const RubiBBQTierSelector: React.FC<Props> = ({
  defaultSelectedId,
  onSelect,
  onBack,
  onContinue,
  onClose,
}) => {
  const [selected, setSelected] = useState<RubiBBQTierId | null>(defaultSelectedId ?? null);
  const tierIds: RubiBBQTierId[] = ["bbq_casual", "bbq_standard", "bbq_feast"];

  const titleJS: React.CSSProperties = {
    fontFamily: "'Jenna Sue','JennaSue',cursive",
    color: blue,
    fontSize: "2rem",
    lineHeight: 1.08,
    margin: "0 0 6px",
    textAlign: "center",
  };

  const priceLine: React.CSSProperties = {
    textAlign: "center",
    marginBottom: 8,
    color: "#5f6b7a",
    fontWeight: 600,
  };

  const imgWrap = (active: boolean): React.CSSProperties => ({
    borderRadius: 18,
    background: "#fff",
    boxShadow: active ? "0 0 28px 10px rgba(70,140,255,0.60)" : "0 1px 0 rgba(0,0,0,0.03)",
    cursor: "pointer",
    transition: "box-shadow .2s ease, transform .2s ease",
    border: "none",
  });

  const imgStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    height: "auto",
    borderRadius: 18,
  };

  const handleSelect = (id: RubiBBQTierId) => {
    const tier = BBQ_TIERS[id];
    setSelected(id);
    onSelect({
      id,
      prettyName: tier.name,
      pricePerGuest: tier.price,
      counts: tier.counts,
    });
    try { localStorage.removeItem("rubiMenuSelections"); } catch {}
    try { window.dispatchEvent(new CustomEvent("rubi:resetMenu")); } catch {}
  };

  return (
    <div className="pixie-card" style={{ maxWidth: 700, paddingTop: 28, paddingBottom: 28, margin: "0 auto" }}>
      {onClose && (
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
        </button>
      )}

      <h2
        style={{
          fontFamily: "'Jenna Sue','JennaSue',cursive",
          color: blue,
          fontSize: "2.2rem",
          textAlign: "center",
          margin: "0 0 12px",
          lineHeight: 1.1,
        }}
      >
        Brother John’s BBQ Packages
      </h2>

      <p className="px-prose-narrow" style={{ textAlign: "center", margin: "0 auto 18px", maxWidth: 560 }}>
        Tap a tier to preview what’s included. You’ll make your selections on the next screen.
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 22, alignItems: "start" }}>
        {tierIds.map((id) => {
          const tier = BBQ_TIERS[id];
          const isActive = selected === id;

          return (
            <div key={id} style={{ maxWidth: 380, justifySelf: "center" }}>
              <div style={titleJS}>{tier.name}</div>
              <div style={priceLine}>${tier.price} per person</div>

              <div
                role="button"
                tabIndex={0}
                aria-label={`Select ${tier.name}`}
                onClick={() => handleSelect(id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleSelect(id)}
                style={imgWrap(isActive)}
              >
                <img src={tier.image} alt={tier.name} style={imgStyle} />
              </div>

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
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{tier.infoTitle}</div>
                  <div style={{ color: "#4a4a4a" }}>{tier.blurb}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="px-cta-col" style={{ marginTop: 20 }}>
        <button
          className="boutique-primary-btn"
          onClick={onContinue}
          disabled={!selected}
          style={{ width: 240, opacity: selected ? 1 : 0.6, cursor: selected ? "pointer" : "not-allowed" }}
        >
          Make My Menu
        </button>
        <button className="boutique-back-btn" onClick={onBack} style={{ width: 240 }}>
          ⬅ Back
        </button>
      </div>
    </div>
  );
};

export default RubiBBQTierSelector;