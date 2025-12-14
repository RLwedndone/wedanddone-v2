// src/components/NewYumBuild/CustomVenues/Tubac/TubacTierSelector.tsx
import React, { useState, useMemo, useEffect } from "react";

// ── Types exposed to the overlay ─────────────────────────────
export type TubacTierId =
  | "silver" | "gold" | "platinum" // plated
  | "peridot" | "emerald" | "turquoise" | "diamond"; // buffet

export type TubacTierSelection = {
  id: TubacTierId;
  prettyName: string;
  pricePerGuest: number;
};

// ── Props ───────────────────────────────────────────────────
interface Props {
  serviceOption: "plated" | "buffet";
  defaultSelectedId?: TubacTierId;
  onSelect: (sel: TubacTierSelection) => void;
  onBack: () => void;
  onContinue: () => void;
  onClose: () => void;
}

// ── Data (PLATED) ───────────────────────────────────────────
const PLATED_TIERS: Record<"silver" | "gold" | "platinum", {
  name: string; price: number; image: string; infoTitle: string;
  items: { title: string; desc: string }[];
}> = {
  silver: {
    name: "Silver Tier",
    price: 96,
    image: `${import.meta.env.BASE_URL}assets/images/YumYum/Tubac/silver.jpg`,
    infoTitle: "SILVER TIER • SELECT TWO • 96",
    items: [
      { title: "Statler Chicken Veronique", desc: "Red grape & rosemary sauce, volcano rice, broccolini" },
      { title: "Grilled Faro Island Salmon", desc: "Volcano rice pilaf, butter braised asparagus, citrus beurre blanc, agra dolce drizzle" },
      { title: "Grilled Top Sirloin 6 oz.", desc: "Crème fraîche whipped potatoes, braised broccolini, port wine rosemary demi-glace" },
    ],
  },
  gold: {
    name: "Gold Tier",
    price: 106,
    image: `${import.meta.env.BASE_URL}assets/images/YumYum/Tubac/gold.jpg`,
    infoTitle: "GOLD TIER • SELECT TWO • 106",
    items: [
      { title: "Chicken Catalan", desc: "Prune & apricot sauce, roasted Yukon potatoes, asparagus" },
      { title: "Pan-Seared Halibut", desc: "Roasted Peruvian fingerling potatoes, brussels with fried pancetta, beurre blanc, wild flowers" },
      { title: "Grilled New York Strip Au Poivre", desc: "Roasted Yukon potatoes, braised broccolini, peppercorn cream demi-glace" },
    ],
  },
  platinum: {
    name: "Platinum Tier",
    price: 126,
    image: `${import.meta.env.BASE_URL}assets/images/YumYum/Tubac/platinum.jpg`,
    infoTitle: "PLATINUM TIER • SELECT TWO • 126",
    items: [
      { title: "Pan-Seared Chilean Sea Bass", desc: "Clam–bacon–green onion risotto, asparagus, leek & watercress nage" },
      { title: "Miso Honey Glazed Japanese Hamachi", desc: "Forbidden rice, baby bok choy, wakame, chile oil" },
      { title: "Grilled Beef Tenderloin Diane", desc: "Onion & Gouda au gratin potatoes, asparagus, brandy, forest mushrooms, Dijon demi-glace" },
    ],
  },
};

// ── Data (BUFFET) ───────────────────────────────────────────
const BUFFET_TIERS: Record<"peridot" | "emerald" | "turquoise" | "diamond", {
  name: string; price: number; image: string; infoTitle: string;
  entrees: string[]; note?: string;
}> = {
  peridot: {
    name: "Peridot Buffet",
    price: 96,
    image: `${import.meta.env.BASE_URL}assets/images/YumYum/Tubac/peri.jpg`,
    infoTitle: "BUFFET • PERIDOT • $96",
    entrees: [
      "Pan-Seared Salmon (arugula pesto, capers, citrus butter sauce)",
      "Chicken Scarpariello (white balsamic tomato risotto, Italian sausage, mushrooms, peppadews, fresh herbs pan sauce)",
    ],
  },
  emerald: {
    name: "Emerald Buffet",
    price: 102,
    image: `${import.meta.env.BASE_URL}assets/images/YumYum/Tubac/emerald.jpg`,
    infoTitle: "BUFFET • EMERALD • $102",
    entrees: [
      "Baseball Cut Top Sirloin (wild mushroom cabernet demi-glace)",
      "Wood-Grilled Salmon (confit cherry tomatoes, lemon beurre blanc)",
      "or Chicken Veronique (grapes & rosemary)",
    ],
  },
  turquoise: {
    name: "Turquoise Buffet",
    price: 102,
    image: `${import.meta.env.BASE_URL}assets/images/YumYum/Tubac/turquoise.jpg`,
    infoTitle: "BUFFET • TURQUOISE • $102",
    entrees: [
      "Annatto Rubbed New York Strip (ranchero sauce)",
      "Pan-Seared Mahi Mahi (cucumber mango salsa, AZ citrus butter sauce)",
      "or Chicken Asado (mojo sauce, sweet stewed tomatoes)",
    ],
  },
  diamond: {
    name: "Diamond Buffet",
    price: 129,
    image: `${import.meta.env.BASE_URL}assets/images/YumYum/Tubac/diamond.jpg`,
    infoTitle: "BUFFET • DIAMOND • $129 • 30 person minimum",
    entrees: [
      "Beef Tenderloin Diane (brandy, wild mushroom, Dijon demi-glace)",
      "Pan-Seared Halibut (leek & watercress nage)",
    ],
    note: "30 person minimum",
  },
};

const blue = "#2c62ba";

const TubacTierSelector: React.FC<Props> = ({
  serviceOption,
  defaultSelectedId,
  onSelect,
  onBack,
  onContinue,
  onClose,
}) => {
  const [selected, setSelected] = useState<TubacTierId | null>(defaultSelectedId || null);

  const tierIds = useMemo<TubacTierId[]>(() => {
    return serviceOption === "plated"
      ? (["silver", "gold", "platinum"] as TubacTierId[])
      : (["peridot", "emerald", "turquoise", "diamond"] as TubacTierId[]);
  }, [serviceOption]);

  const isPlated = serviceOption === "plated";

  // ⚡ Reset picks whenever a DIFFERENT tier is chosen
  const handleSelect = (id: TubacTierId) => {
    const changing = id !== selected;
    setSelected(id);
  
    // Pass selection up (price/name)
    if (isPlated) {
      const t = PLATED_TIERS[id as "silver" | "gold" | "platinum"];
      onSelect({ id, prettyName: t.name, pricePerGuest: t.price });
    } else {
      const t = BUFFET_TIERS[id as "peridot" | "emerald" | "turquoise" | "diamond"];
      onSelect({ id, prettyName: t.name, pricePerGuest: t.price });
    }
  
    if (changing) {
      // 🔥 clear ANY prior menu caches so the next screen is blank
      try {
        localStorage.removeItem("yumMenuSelections");        // plated
        localStorage.removeItem("tubacBuffetSelections");    // buffet (common name)
        localStorage.removeItem("tubacMenuSelections");      // alt name just in case
        localStorage.removeItem("tubacSelectedItems");       // alt name just in case
        localStorage.removeItem("tubacPlatedTwoApps");       // upsell flag (plated)
      } catch {}
  
      // tell whichever builder is mounted to purge its in-memory state
      try {
        window.dispatchEvent(new CustomEvent("tubac:resetMenu"));
      } catch {}
    }
  };

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
    marginBottom: 10,
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

  // If serviceOption changes and the current selected tier isn't valid for that service,
// clear it. Also seed from defaultSelectedId when valid.
useEffect(() => {
  const allowed = serviceOption === "plated"
    ? (["silver", "gold", "platinum"] as TubacTierId[])
    : (["peridot", "emerald", "turquoise", "diamond"] as TubacTierId[]);

  if (!selected || !allowed.includes(selected)) {
    // Prefer defaultSelectedId if it's valid for this service
    if (defaultSelectedId && allowed.includes(defaultSelectedId)) {
      setSelected(defaultSelectedId);
    } else {
      setSelected(null);
    }
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [serviceOption]);

// Also react to defaultSelectedId changes directly (e.g., resume flow)
useEffect(() => {
  if (!defaultSelectedId) return;
  const allowed = serviceOption === "plated"
    ? (["silver", "gold", "platinum"] as TubacTierId[])
    : (["peridot", "emerald", "turquoise", "diamond"] as TubacTierId[]);
  if (allowed.includes(defaultSelectedId)) setSelected(defaultSelectedId);
}, [defaultSelectedId, serviceOption]);

  return (
    <div
      className="pixie-card wd-page-turn"
      style={{ maxWidth: 700, paddingTop: 28, paddingBottom: 28, margin: "0 auto" }}
    >
      {/* Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      {/* Jenna Sue header */}
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
        {isPlated ? "Plated Dinner Tiers" : "Buffet Dinner Tiers"}
      </h2>

      <p className="px-prose-narrow" style={{ textAlign: "center", margin: "0 auto 18px", maxWidth: 560 }}>
        Tap a tier to preview what’s included. You’ll make your selections on the next screen.
      </p>

      {/* Tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 22,
          alignItems: "start",
        }}
      >
        {tierIds.map((id) => {
          const isActive = selected === id;

          const d = isPlated
            ? PLATED_TIERS[id as "silver" | "gold" | "platinum"]
            : BUFFET_TIERS[id as "peridot" | "emerald" | "turquoise" | "diamond"];

          return (
            <div key={id} style={{ maxWidth: 380, justifySelf: "center" }}>
              {/* Name + price ABOVE the tile */}
              <div style={titleJS}>{d.name}</div>
              <div style={priceLine}>${d.price} per person</div>

              {/* Image-only tile */}
              <div
                role="button"
                tabIndex={0}
                aria-label={`Select ${d.name}`}
                onClick={() => handleSelect(id)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && handleSelect(id)}
                style={imgWrap(isActive)}
              >
                <img src={d.image} alt={d.name} style={imgStyle} />
              </div>

              {/* Expanded info under tile */}
{/* Expanded info under tile */}
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
    <div style={{ fontWeight: 700, marginBottom: 6 }}>{d.infoTitle}</div>

    {isPlated ? (
      <>
        {(() => {
          // Strongly type the plated items
          const items = PLATED_TIERS[id as "silver" | "gold" | "platinum"].items as {
            title: string; desc: string;
          }[];

          // By data order, the beef is always the 3rd item
          const [first, second, beef] = items;

          return (
            <>
              {/* Always-included entrée first */}
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                <li style={{ marginBottom: 8 }}>
                  <div style={{ fontWeight: 600 }}>{beef.title}</div>
                  <div style={{ color: "#444", fontSize: ".95rem", lineHeight: 1.4 }}>
                    {beef.desc}
                  </div>
                </li>
              </ul>

              {/* Divider */}
              <div style={{ margin: "8px 0 6px", fontStyle: "italic", color: "#4a4a4a" }}>
                Your choice of chicken or fish:
              </div>

              {/* Remaining two entrées */}
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {[first, second].map((it: { title: string; desc: string }, i: number) => (
                  <li key={i} style={{ marginBottom: 6 }}>
                    <div style={{ fontWeight: 600 }}>{it.title}</div>
                    <div style={{ color: "#444", fontSize: ".95rem", lineHeight: 1.4 }}>
                      {it.desc}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          );
        })()}
      </>
    ) : (
      <>
        {/* Buffet tiers unchanged */}
        <div style={{ marginBottom: 6, color: "#4a4a4a" }}>
          Buffet entrées included in this tier:
        </div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>
          {BUFFET_TIERS[id as "peridot" | "emerald" | "turquoise" | "diamond"].entrees.map(
            (e: string, i: number) => (
              <li key={i} style={{ marginBottom: 6 }}>{e}</li>
            )
          )}
        </ul>
        {!!BUFFET_TIERS[id as "peridot" | "emerald" | "turquoise" | "diamond"].note && (
          <div style={{ marginTop: 8, fontStyle: "italic", color: "#4a4a4a" }}>
            {BUFFET_TIERS[id as "peridot" | "emerald" | "turquoise" | "diamond"].note}
          </div>
        )}
      </>
    )}
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

export default TubacTierSelector;