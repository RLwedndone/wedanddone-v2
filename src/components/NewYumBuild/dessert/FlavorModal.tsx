import React, { useEffect, useMemo, useState } from "react";

export interface FlavorModalChangePayload {
  titles: string[];
  subtitle: string;
}

interface FlavorModalProps {
  selected: string[];
  onChange: (payload: FlavorModalChangePayload) => void;
  onClose: () => void;
  title?: string;
  maxSelections?: number;
}

const combos = [
  {
    key: "goldenOrchid",
    title: "Malted Vanilla",
    desc:
      "All vanilla, all the way! Our Vanilla Butter Cake, filled with our malted vanilla cream and finished with Vanilla Italian Meringue Buttercream.",
    img: "/assets/images/YumYum/Flavor_Icons/malted_vanilla.png",
  },
  {
    key: "sunshineLemon",
    title: "Arizona’s Sunshine Lemon Cake",
    desc: "Bright Lemon Cake, filled with Lemon Cream & intense Lemon Curd.",
    img: "/assets/images/YumYum/Flavor_Icons/sunshine_lemon.png",
  },
  {
    key: "strawberriesChampagne",
    title: "Strawberries & Champagne",
    desc:
      "An all time favorite… Our delicate Sparkling Champagne Cake layered with Strawberry Cream.",
    img: "/assets/images/YumYum/Flavor_Icons/strawberries_champagne.png",
  },
  {
    key: "aztecChocolate",
    title: "Aztec Chocolate",
    desc:
      "Our moist Chocolate Brown Sugar Cake, layered with our cinnamon & cayenne pepper chocolate mousse.",
    img: "/assets/images/YumYum/Flavor_Icons/aztec_chocolate.png",
  },
  {
    key: "almondRaspberry",
    title: "Almond Raspberry",
    desc: "Tender Almond Poppy Seed Cake, layered with Raspberry Cream.",
    img: "/assets/images/YumYum/Flavor_Icons/almond_raspberry.png",
  },
  {
    key: "caramelMacchiato",
    title: "Caramel Macchiato",
    desc:
      "Our Vanilla cake, layered with Espresso Buttercream & drizzled with our very own Caramel Sauce.",
    img: "/assets/images/YumYum/Flavor_Icons/caramel_macchiato.png",
  },
  {
    key: "tangerineDream",
    title: "Tangerine Dream",
    desc: "Our light Tangerine Chiffon Cake paired with Whipped Mascarpone Cream.",
    img: "/assets/images/YumYum/Flavor_Icons/tangerine_dream.png",
  },
] as const;

export const flavorCombos = combos.map((c) => ({
  key: c.key,
  title: c.title,
  description: c.desc,
  imageSrc: c.img,
}));

const FlavorModal: React.FC<FlavorModalProps> = ({
  selected,
  onChange,
  onClose,
  title = "Select your cake flavor & filling combo!",
  maxSelections = 1,
}) => {
  const titleToKey = useMemo(
    () => Object.fromEntries(combos.map((c) => [c.title, c.key])),
    []
  );
  const keyToTitle = useMemo(
    () => Object.fromEntries(combos.map((c) => [c.key, c.title])),
    []
  );

  const [pickedKeys, setPickedKeys] = useState<string[]>([]);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  useEffect(() => {
    if (selected?.length) {
      const asKeys = selected.map((t) => titleToKey[t]).filter(Boolean) as string[];
      setPickedKeys(asKeys.slice(0, maxSelections));
      setActiveKey(asKeys[0] ?? null);
    } else {
      setPickedKeys([]);
      setActiveKey(null);
    }
  }, [selected, maxSelections, titleToKey]);

  const toggle = (key: string) => {
    setActiveKey(key);
    if (maxSelections === 1) {
      setPickedKeys([key]);
      return;
    }
    setPickedKeys((prev) => {
      const has = prev.includes(key);
      if (has) return prev.filter((k) => k !== key);
      if (prev.length >= maxSelections) return prev;
      return [...prev, key];
    });
  };

  const handleSave = () => {
    const titles = pickedKeys.map((k) => keyToTitle[k]).filter(Boolean) as string[];
    const subtitle =
      titles.length <= 1
        ? titles[0] || ""
        : titles.slice(0, 2).join(" & ") + (titles.length > 2 ? "…" : "");
    onChange({ titles, subtitle });
    onClose();
  };

  const canSave = pickedKeys.length > 0 && pickedKeys.length <= maxSelections;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.08)",
        zIndex: 2000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 12,
      }}
    >
      <div
        style={{
          background: "#fff",
          width: "min(640px, 96vw)",
          maxHeight: "88vh",
          overflowY: "auto",
          borderRadius: 18,
          padding: "18px 18px 22px",
          position: "relative",
          boxShadow: "0 18px 50px rgba(0,0,0,0.18)",
          scrollbarWidth: "none", // ✅ hides scrollbar for Firefox
        }}
      >
        <style>
          {`
            /* ✅ hides scrollbar for WebKit browsers */
            div::-webkit-scrollbar {
              display: none;
            }
          `}
        </style>

        {/* 🔹 Blue X Close */}
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          <img
            src="/assets/icons/blue_ex.png"
            alt="Close"
            style={{ width: 22, height: 22 }}
          />
        </button>

        <div style={{ textAlign: "center", marginBottom: 4 }}>
          <img
            src="/assets/images/YumYum/filling_icon.png"
            alt=""
            style={{ width: 56, height: 56, display: "inline-block" }}
          />
        </div>

        <h3
          style={{
            textAlign: "center",
            fontSize: "1.9rem",
            fontFamily: "'Jenna Sue', cursive",
            color: "#2c62ba",
            margin: "6px 0 16px",
          }}
        >
          {title}
          {maxSelections > 1 && (
            <span
              style={{
                display: "block",
                fontSize: ".95rem",
                color: "#666",
                fontFamily: "Nunito, system-ui, sans-serif",
                marginTop: 4,
              }}
            >
              Pick up to {maxSelections}
            </span>
          )}
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {combos.map((c) => {
            const isPicked = pickedKeys.includes(c.key);
            const showDesc = activeKey === c.key;
            return (
              <div
                key={c.key}
                style={{
                  width: "min(86vw, 290px)",
                  margin: "0 auto",
                }}
              >
                <button
  onClick={() => toggle(c.key)}
  style={{
    display: "block",
    width: "100%",
    background: "#fff",
    border: isPicked ? "2px solid transparent" : "1.5px solid #e7e7e7", // ✅ soften border
    borderRadius: 14,
    padding: 10,
    cursor: "pointer",
    transition: "box-shadow 0.25s ease, transform 0.2s ease",
    boxShadow: isPicked
      ? "0 0 12px 4px rgba(44,98,186,0.35)" // ✅ soft glowing blue halo
      : "0 1px 3px rgba(0,0,0,0.05)",
    transform: isPicked ? "scale(1.03)" : "scale(1)", // ✅ subtle pop when active
  }}
>
                  <div
                    style={{
                      width: "100%",
                      aspectRatio: "1 / 1",
                      borderRadius: 12,
                      overflow: "hidden",
                      marginBottom: 8,
                    }}
                  >
                    <img
                      src={c.img}
                      alt={c.title}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  </div>
                  <div
                    style={{
                      fontFamily: "'Jenna Sue', cursive",
                      fontSize: "1.7rem",
                      color: "#2c62ba",
                      lineHeight: 1.2,
                      textAlign: "center",
                    }}
                  >
                    {c.title}
                  </div>
                </button>

                {showDesc && (
                  <div
                    style={{
                      marginTop: 8,
                      marginBottom: 2,
                      padding: "8px 10px",
                      borderRadius: 12,
                      border: "1px dashed #e7e7e7",
                      background: "#fafbff",
                      fontFamily: "Nunito, system-ui, sans-serif",
                      fontSize: ".9rem",
                      color: "#444",
                      lineHeight: 1.4,
                    }}
                  >
                    <strong style={{ color: "#2c62ba" }}>{c.title}:</strong> {c.desc}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
          <button
            className="boutique-primary-btn"
            onClick={handleSave}
            disabled={!canSave}
            style={{ minWidth: 220, opacity: canSave ? 1 : 0.6 }}
          >
            Add to Menu
          </button>
        </div>
      </div>
    </div>
  );
};

export default FlavorModal;