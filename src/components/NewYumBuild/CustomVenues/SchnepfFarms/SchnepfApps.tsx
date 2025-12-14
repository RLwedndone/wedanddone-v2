// src/components/NewYumBuild/CustomVenues/SchnepfFarms/SchnepfApps.tsx
import React, { useEffect, useState } from "react";

type AppKey =
  | "Charcuterie Board"
  | "Seasonal Fresh Fruit Platter"
  | "Seasonal Fresh Veggie Platter"
  | "Caprese Skewers"
  | "Peach Chipotle Meatballs"
  | "Hot Spinach Dip"
  | "Bruschetta";

interface SchnepfAppsProps {
  selected?: AppKey[];
  onChange?: (next: AppKey[]) => void;
  onContinue: () => void;
  onBack: () => void;
  onClose?: () => void;
}

const APPS: { key: AppKey; priceText: string; note?: string; tags?: string[] }[] = [
  {
    key: "Charcuterie Board",
    priceText: "$11.95 per person",
    note: "Assortment of gourmet meats & cheeses, jams, veg, breads & more (≈4oz/guest).",
  },
  {
    key: "Seasonal Fresh Fruit Platter",
    priceText: "$230.00 per platter",
    note: "Seasonal assortment; quality/selection varies by time of year. Each platter serves about 50 guests.",
    tags: ["V", "VG", "GF"],
  },
  {
    key: "Seasonal Fresh Veggie Platter",
    priceText: "$230.00 per platter",
    note: "Garden-picked vegetables with ranch. Each platter serves about 50 guests.",
    tags: ["V", "GF"],
  },
  {
    key: "Caprese Skewers",
    priceText: "$3.25 per skewer",
    note: "Cherry tomato, mozzarella, basil, balsamic. 50 skewers minimum",
    tags: ["V", "GF"],
  },
  {
    key: "Peach Chipotle Meatballs",
    priceText: "$275.00 per platter",
    note: "Italian-style meatballs tossed in peach chipotle. Each platter serves about 50 guests.",
  },
  {
    key: "Hot Spinach Dip",
    priceText: "$195.00 per platter",
    note: "Served with Schnepf Farms artisan bread. Each platter serves about 50 guests.",
    tags: ["V"],
  },
  {
    key: "Bruschetta",
    priceText: "$3.25 each",
    note: "Tomato, red onion, garlic, basil, balsamic on crostini. 50 piece minimum.",
    tags: ["V"],
  },
];

const Title: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2
    style={{
      fontFamily: "'Jenna Sue', cursive",
      color: "#2c62ba",
      fontSize: "2.1rem",
      textAlign: "center",
      margin: "0 0 0.75rem",
    }}
  >
    {children}
  </h2>
);

const SchnepfApps: React.FC<SchnepfAppsProps> = ({
  selected = [],
  onChange,
  onContinue,
  onBack,
  onClose,
}) => {
  const [picks, setPicks] = useState<AppKey[]>(selected);

  // persist + notify
  useEffect(() => {
    try {
      localStorage.setItem("schnepfAppsSelected", JSON.stringify(picks));
    } catch {}
    onChange?.(picks);
  }, [picks, onChange]);

  // restore if parent didn’t pass a value
  useEffect(() => {
    if (selected.length) return;
    try {
      const raw = localStorage.getItem("schnepfAppsSelected");
      if (raw) {
        const parsed = JSON.parse(raw) as AppKey[];
        if (Array.isArray(parsed)) {
          const valid = parsed.filter((k) => APPS.some((a) => a.key === k));
          setPicks(valid);
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggle = (key: AppKey) => {
    setPicks((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  };

  return (
    <div className="pixie-card wd-page-turn" style={{ maxWidth: 720, textAlign: "center" }}>
      <img
        src={`${import.meta.env.BASE_URL}assets/images/YumYum/Schnepf/apps.png`}
        alt="Appetizers"
        onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")}
        style={{ width: 180, margin: "0 auto 12px", display: "block", borderRadius: 12 }}
      />
  
      <h2
        style={{
          fontFamily: "'Jenna Sue', cursive",
          fontSize: "2.2rem",
          color: "#2c62ba",
          marginBottom: "0.75rem",
        }}
      >
        Appetizers
      </h2>
  
      <div
        style={{
          margin: "0 auto 1.5rem",
          padding: "1rem 1.25rem",
          background: "#fff",
          border: "1px solid #eaeaea",
          borderRadius: 16,
          maxWidth: 680,
          textAlign: "left",
        }}
      >
        {APPS.map((a, idx) => {
          const checked = picks.includes(a.key);
          return (
            <label
              key={a.key}
              style={{
                display: "grid",
                gridTemplateColumns: "28px 1fr",
                gap: "0.75rem",
                alignItems: "start",
                padding: "0.75rem 0",
                borderTop: idx === 0 ? "none" : "1px dashed #eee",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(a.key)}
                style={{ width: 20, height: 20, accentColor: "#2c62ba", marginTop: 2 }}
              />
              <div>
                <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{a.key}</div>
                <div style={{ color: "#0f172a", fontSize: ".95rem", marginTop: 2 }}>{a.priceText}</div>
                {a.note && (
                  <div style={{ color: "#475569", fontSize: ".9rem", marginTop: 2 }}>{a.note}</div>
                )}
                {Array.isArray(a.tags) && a.tags.length > 0 && (
  <div style={{ marginTop: 4, fontSize: ".8rem", color: "#64748b" }}>
    {a.tags.join(" • ")}
  </div>
)}
              </div>
            </label>
          );
        })}
      </div>
  
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
        <button className="boutique-primary-btn" onClick={onContinue} style={{ width: 250 }}>
          Continue
        </button>
        <button className="boutique-back-btn" onClick={onBack} style={{ width: 250 }}>
          ⬅ Back
        </button>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "#64748b",
              textDecoration: "underline",
              marginTop: 4,
              cursor: "pointer",
              fontSize: ".9rem",
            }}
          >
            Close
          </button>
        )}
      </div>
    </div>
  );
};

export default SchnepfApps;