import React, { useState } from "react";

/** Mexican-only ids */
export type RubiMexTierId = "mex_sensillo" | "mex_fiesta" | "mex_espectacular";

/** Shared selection payload shape (standalone) */
export type RubiTierSelection = {
  id: RubiMexTierId;              // only Mexican ids in this file
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
  counts: RubiTierSelection["counts"];
};

interface Props {
  defaultSelectedId?: RubiMexTierId;
  onSelect: (sel: RubiTierSelection) => void;
  onBack: () => void;
  onContinue: () => void;
  onClose?: () => void;
}

// Mexican tiers
const MEX_TIERS: Record<RubiMexTierId, TierDef> = {
  mex_sensillo: {
    name: "Sensillo",
    price: 28,
    image: "/assets/images/YumYum/Rubi/sensillo.jpg",
    infoTitle: "SENSILLO • $28 • 1 starter or soup, 1 entrée & 2 sides",
    blurb: "Streamlined set: one starter or soup, one entrée, and two sides.",
    counts: { startersOrSoup: 1, entrees: 1, sides: 2 },
  },
  mex_fiesta: {
    name: "Fiesta",
    price: 36,
    image: "/assets/images/YumYum/Rubi/fiesta.jpg",
    infoTitle:
      "FIESTA • $36 • 2 passed apps, 1 starter/soup, 1 entrée, 3 sides, 1 dessert",
    blurb:
      "Party spread: two passed appetizers plus starter, entrée, sides, and dessert.",
    counts: { passedApps: 2, startersOrSoup: 1, entrees: 1, sides: 3, desserts: 1 },
  },
  mex_espectacular: {
    name: "Espectacular",
    price: 45,
    image: "/assets/images/YumYum/Rubi/espectacular.jpg",
    infoTitle:
      "ESPECTACULAR • $45 • 2 passed apps, 2 starters/soup combo, 2 entrées, 3 sides, 1 dessert",
    blurb:
      "Showstopper: more courses and variety across apps, starters, entrees, and sides.",
    counts: { passedApps: 2, startersOrSoup: 2, entrees: 2, sides: 3, desserts: 1 },
  },
};

const blue = "#2c62ba";

const RubiMexTierSelector: React.FC<Props> = ({
  defaultSelectedId,
  onSelect,
  onBack,
  onContinue,
  onClose,
}) => {
  const [selected, setSelected] = useState<RubiMexTierId | null>(
    defaultSelectedId ?? null
  );

  const tierIds: RubiMexTierId[] = [
    "mex_sensillo",
    "mex_fiesta",
    "mex_espectacular",
  ];

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
    boxShadow: active
      ? "0 0 28px 10px rgba(70,140,255,0.60)"
      : "0 1px 0 rgba(0,0,0,0.03)",
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

  const handleSelect = (id: RubiMexTierId) => {
    const tier = MEX_TIERS[id];
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
    <div
      className="pixie-card"
      style={{ maxWidth: 700, paddingTop: 28, paddingBottom: 28, margin: "0 auto" }}
    >
      {onClose && (
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src="/assets/icons/pink_ex.png" alt="Close" />
        </button>
      )}

      {/* Header */}
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
        Brother John’s Mexican Packages
      </h2>

      <p
        className="px-prose-narrow"
        style={{ textAlign: "center", margin: "0 auto 18px", maxWidth: 560 }}
      >
        Tap a tier to preview what’s included. You’ll make your selections on the next screen.
      </p>

      {/* Grid of tier tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 22,
          alignItems: "start",
        }}
      >
        {tierIds.map((id) => {
          const tier = MEX_TIERS[id];
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
                onKeyDown={(e) =>
                  (e.key === "Enter" || e.key === " ") && handleSelect(id)
                }
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
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>
                    {tier.infoTitle}
                  </div>
                  <div style={{ color: "#4a4a4a" }}>{tier.blurb}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* CTA row */}
      <div className="px-cta-col" style={{ marginTop: 20 }}>
        <button
          className="boutique-primary-btn"
          onClick={onContinue}
          disabled={!selected}
          style={{
            width: 240,
            opacity: selected ? 1 : 0.6,
            cursor: selected ? "pointer" : "not-allowed",
          }}
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

export default RubiMexTierSelector;