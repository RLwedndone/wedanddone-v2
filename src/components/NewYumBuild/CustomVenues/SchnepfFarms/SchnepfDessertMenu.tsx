import React, { useEffect, useMemo, useState } from "react";
import FlavorModal from "../../dessert/FlavorModal";
import GoodiesModal from "../../dessert/GoodiesModal";
import { GOODIE_CATALOG } from "../../dessert/dessertPricing";
import StyleModal from "../../dessert/StyleModal";

interface SchnepfDessertMenuProps {
  dessertType: "tieredCake" | "smallCakeTreats" | "treatsOnly";
  flavorFilling: string[];
  setFlavorFilling: React.Dispatch<React.SetStateAction<string[]>>;
  onContinue: (selections: {
    flavorFilling: string[];
    cakeStyle?: string;
    treatType?: "" | "cupcakes" | "goodies";
    cupcakes?: string[];  // titles
    goodies?: string[];   // "Group::Label" keys
  }) => void;
  onBack: () => void;
  onClose: () => void;
}

// helpers
const png = (name: string) => `/assets/images/YumYum/${name}.png`;
const LS_KEY = "schnepfDessertSelections"; // ⬅ namespaced

const SchnepfDessertMenu: React.FC<SchnepfDessertMenuProps> = ({
  dessertType,
  flavorFilling,
  setFlavorFilling,
  onContinue,
  onBack,
}) => {
  const [showModal, setShowModal] = useState<
    "flavor" | "style" | "treatType" | "goodies" | "cupcakes" | null
  >(null);

  const [cakeStyle, setCakeStyle] = useState<string>("");
  const [treatType, setTreatType] = useState<"" | "cupcakes" | "goodies">("");
  const [goodies, setGoodies] = useState<string[]>([]);
  const [cupcakes, setCupcakes] = useState<string[]>([]);

  // derive from catalog so venue stays in sync with master list
  const goodiesList = useMemo(() => Object.keys(GOODIE_CATALOG), []);

  // When dessertType changes, wipe transient picks (Schnepf-local)
  useEffect(() => {
    setTreatType("");
    setGoodies([]);
    setCupcakes([]);
    setCakeStyle("");
    setFlavorFilling([]);

    try {
      localStorage.setItem(
        LS_KEY,
        JSON.stringify({
          dessertType,
          flavorFilling: [],
          cakeStyle: "",
          treatType: "",
          goodies: [],
          cupcakes: [],
        })
      );
    } catch {}
  }, [dessertType, setFlavorFilling]);

  // Restore last snapshot if present
  useEffect(() => {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      if (typeof s?.cakeStyle === "string") setCakeStyle(s.cakeStyle);
      if (s?.treatType === "cupcakes" || s?.treatType === "goodies") setTreatType(s.treatType);
      if (Array.isArray(s?.goodies)) setGoodies(s.goodies);
      if (Array.isArray(s?.cupcakes)) setCupcakes(s.cupcakes);
    } catch {}
  }, []);

  const headerStyle: React.CSSProperties = {
    width: "260px",
    marginBottom: "1rem",
    cursor: "pointer",
    transition: "transform 0.3s ease-in-out",
    display: "block",
    marginLeft: "auto",
    marginRight: "auto",
  };

  const selectionStyle: React.CSSProperties = {
    fontFamily: "'Jenna Sue', cursive",
    fontSize: "2.2rem",
    color: "#2c62ba",
    marginBottom: "0.25rem",
    cursor: "pointer",
    transition: "opacity 0.3s",
    opacity: 0.9,
    textAlign: "center",
  };

  // allow 1 cake flavor combo; cupcake flavors reuse cake combo titles
  const cupcakeFlavorTitles = [
    "The Golden Orchid",
    "Arizona’s Sunshine Lemon Cake",
    "Strawberries & Champagne",
    "Aztec Chocolate",
    "Almond Raspberry",
    "Caramel Macchiato",
    "Taste of the Tropics",
  ];

  const canContinue = (): boolean => {
    if (dessertType === "tieredCake") {
      return flavorFilling.length > 0 && !!cakeStyle;
    }
    if (dessertType === "smallCakeTreats") {
      if (!flavorFilling.length || !cakeStyle || !treatType) return false;
      if (treatType === "goodies") return goodies.length > 0;
      if (treatType === "cupcakes") return cupcakes.length > 0;
      return false;
    }
    if (dessertType === "treatsOnly") {
      if (!treatType) return false;
      if (treatType === "goodies") return goodies.length > 0;
      if (treatType === "cupcakes") return cupcakes.length > 0;
      return false;
    }
    return false;
  };

  const persistSnapshot = (extra?: Partial<{
    flavorFilling: string[];
    cakeStyle: string;
    treatType: "" | "cupcakes" | "goodies";
    goodies: string[];
    cupcakes: string[];
  }>) => {
    const snap = {
      dessertType,
      flavorFilling,
      cakeStyle,
      treatType,
      goodies,
      cupcakes,
      ...(extra || {}),
    };
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(snap));
    } catch {}
  };

  const handleContinue = () => {
    const selections = { flavorFilling, cakeStyle, treatType, goodies, cupcakes };
    persistSnapshot(selections);
    onContinue(selections);
  };

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 680, position: "relative" }}>
      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2 className="px-title-lg" style={{ marginBottom: 12 }}>
          Build Your{" "}
          {dessertType === "tieredCake"
            ? "Tiered Cake"
            : dessertType === "smallCakeTreats"
            ? "Cake & Treat Table"
            : "Treats Table"}
        </h2>
  
        <img
          src={png("dessert_piglet")}
          alt="Dessert Piglet"
          className="px-media"
          style={{ width: 160, maxWidth: "90%", margin: "0 auto 16px", display: "block" }}
        />
  
        {(dessertType === "tieredCake" || dessertType === "smallCakeTreats") && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1.5rem", marginBottom: "1.5rem" }}>
            {/* Flavor/Filling */}
            <div onClick={() => setShowModal("flavor")}>
              <img
                src={png("cakeFlavorFilling")}
                alt="Cake Flavor"
                className="px-media"
                style={headerStyle}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              />
            </div>
            {flavorFilling.map((title) => (
              <div key={title} onClick={() => setShowModal("flavor")} style={selectionStyle}>
                {title}
              </div>
            ))}
  
            {/* Cake Style */}
            <div onClick={() => setShowModal("style")}>
              <img
                src={png("cake_style")}
                alt="Cake Style"
                className="px-media"
                style={headerStyle}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              />
            </div>
            {!!cakeStyle && (
              <div onClick={() => setShowModal("style")} style={selectionStyle}>
                {cakeStyle}
              </div>
            )}
          </div>
        )}
  
        {(dessertType === "smallCakeTreats" || dessertType === "treatsOnly") && (
          <>
            <img
              src={png("treat_types")}
              alt="Treat Table Type"
              className="px-media"
              onClick={() => setShowModal("treatType")}
              style={headerStyle}
            />
            {!!treatType && (
              <div style={selectionStyle}>{treatType === "cupcakes" ? "Cupcakes" : "Goodies"}</div>
            )}
  
            {treatType === "cupcakes" && (
              <>
                <img
                  src={png("cupcake_flavors")}
                  alt="Cupcake Flavors"
                  className="px-media"
                  onClick={() => setShowModal("cupcakes")}
                  style={headerStyle}
                />
                {cupcakes.map((title) => (
                  <div key={title} onClick={() => setShowModal("cupcakes")} style={selectionStyle}>
                    {title}
                  </div>
                ))}
              </>
            )}
  
            {treatType === "goodies" && (
              <>
                <img
                  src={png("goodies_selection")}
                  alt="Goodies Selection"
                  className="px-media"
                  onClick={() => setShowModal("goodies")}
                  style={headerStyle}
                />
  
                {/* Group selected goodies by their "Group::Label" tokens */}
                {(() => {
                  const byGroup: Record<string, string[]> = {};
                  for (const token of goodies) {
                    const [groupRaw, labelRaw] = String(token).split("::");
                    const group = (groupRaw || "Other treats").trim();
                    const label = (labelRaw || token).trim();
                    if (!byGroup[group]) byGroup[group] = [];
                    if (!byGroup[group].includes(label)) byGroup[group].push(label);
                  }
                  return Object.entries(byGroup).map(([group, labels]) => (
                    <div key={group} style={{ marginBottom: "1rem", textAlign: "center" }}>
                      <div
                        onClick={() => setShowModal("goodies")}
                        style={{
                          fontWeight: 700,
                          fontSize: "1.6rem",
                          color: "#2c62ba",
                          marginBottom: "0.5rem",
                          fontFamily: "'Jenna Sue', cursive",
                        }}
                      >
                        {group}
                      </div>
                      {labels.map((label) => (
                        <div
                          key={`${group}::${label}`}
                          onClick={() => setShowModal("goodies")}
                          style={{ ...selectionStyle, fontSize: "1.35rem", marginBottom: "0.25rem" }}
                        >
                          {label}
                        </div>
                      ))}
                    </div>
                  ));
                })()}
              </>
            )}
          </>
        )}
  
        {/* Actions */}
        <div className="px-cta-col" style={{ marginTop: 12 }}>
          <button
            className="boutique-primary-btn"
            onClick={handleContinue}
            disabled={!canContinue()}
            style={{ width: 250 }}
          >
            Continue
          </button>
          <button className="boutique-back-btn" onClick={onBack} style={{ width: 250 }}>
            Back
          </button>
        </div>
      </div>
  
      {/* Modals */}
      {showModal === "flavor" && (
        <FlavorModal
          selected={flavorFilling}
          onChange={({ titles }) => {
            setFlavorFilling(titles);
            persistSnapshot({ flavorFilling: titles });
            setShowModal(null);
          }}
          onClose={() => setShowModal(null)}
          maxSelections={1}
        />
      )}
  
      {showModal === "style" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 1001,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "1rem",
          }}
          onClick={() => setShowModal(null)}
        >
          <div style={{ maxWidth: 960, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <StyleModal
              selected={cakeStyle ? [cakeStyle] : []}
              onChange={(arr) => {
                const next = arr[0] || "";
                setCakeStyle(next);
                persistSnapshot({ cakeStyle: next });
              }}
              onClose={() => setShowModal(null)}
            />
          </div>
        </div>
      )}
  
      {showModal === "cupcakes" && (
        <FlavorModal
          title="Pick up to 2 cupcake flavors"
          selected={cupcakes}
          maxSelections={2}
          onChange={({ titles }) => {
            const filtered = titles.filter((t) => cupcakeFlavorTitles.includes(t));
            setCupcakes(filtered);
            persistSnapshot({ cupcakes: filtered });
            setShowModal(null);
          }}
          onClose={() => setShowModal(null)}
        />
      )}
  
      {showModal === "goodies" && (
        <GoodiesModal
          selected={goodies}
          onChange={(labels) => {
            setGoodies(labels);
            try {
              const snap = JSON.parse(localStorage.getItem(LS_KEY) || "{}");
              localStorage.setItem(LS_KEY, JSON.stringify({ ...snap, goodies: labels }));
            } catch {}
          }}
          onClose={() => setShowModal(null)}
        />
      )}
  
      {showModal === "treatType" && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            zIndex: 1001,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: "1rem",
          }}
        >
          <div
            style={{
              background: "#fff",
              padding: "2rem",
              borderRadius: 20,
              maxWidth: 600,
              width: "90%",
              maxHeight: "90vh",
              overflowY: "auto",
              textAlign: "center",
              position: "relative",
            }}
          >
            <button
              onClick={() => setShowModal(null)}
              style={{
                position: "absolute",
                top: "1rem",
                right: "1rem",
                background: "none",
                border: "none",
                fontSize: "1.5rem",
                cursor: "pointer",
              }}
              aria-label="Close"
            >
              ✖
            </button>
  
            <h3
              style={{
                fontFamily: "'Jenna Sue', cursive",
                fontSize: "2rem",
                color: "#2c62ba",
                marginBottom: "1.25rem",
              }}
            >
              Which type of treat table would you like?
            </h3>
  
            {/* Cupcakes */}
            <div
              onClick={() => {
                setTreatType("cupcakes");
                setGoodies([]);
                setShowModal(null);
                setTimeout(() => setShowModal("cupcakes"), 0);
                persistSnapshot({ treatType: "cupcakes", goodies: [], cupcakes });
              }}
              style={{ marginBottom: "1.5rem", cursor: "pointer" }}
            >
              <img
                src="/assets/images/YumYum/cupcake.png"
                alt="Cupcakes"
                className="px-media"
                style={{
                  width: "80%",
                  maxWidth: 300,
                  borderRadius: 12,
                  border: treatType === "cupcakes" ? "3px solid #2c62ba" : "1px solid #ccc",
                }}
              />
              <div style={{ fontWeight: "bold", marginTop: ".5rem" }}>Cupcakes</div>
            </div>
  
            {/* Goodies */}
            <div
              onClick={() => {
                setTreatType("goodies");
                setCupcakes([]);
                setShowModal(null);
                setTimeout(() => setShowModal("goodies"), 0);
                persistSnapshot({ treatType: "goodies", cupcakes: [], goodies });
              }}
              style={{ cursor: "pointer" }}
            >
              <img
                src="/assets/images/YumYum/goodies.png"
                alt="Goodies"
                className="px-media"
                style={{
                  width: "80%",
                  maxWidth: 300,
                  borderRadius: 12,
                  border: treatType === "goodies" ? "3px solid #2c62ba" : "1px solid #ccc",
                }}
              />
              <div style={{ fontWeight: "bold", marginTop: ".5rem" }}>Goodies</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SchnepfDessertMenu;