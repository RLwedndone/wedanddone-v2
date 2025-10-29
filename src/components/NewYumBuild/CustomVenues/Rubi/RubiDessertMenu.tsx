// src/components/NewYumBuild/CustomVenues/Rubi/RubiDessertMenu.tsx
import React, { useEffect, useMemo, useState } from "react";
import FlavorModal from "../../dessert/FlavorModal";
import GoodiesModal from "../../dessert/GoodiesModal";
import StyleModal from "../../dessert/StyleModal";
import { GOODIE_CATALOG } from "../../dessert/dessertPricing";

interface RubiDessertMenuProps {
  dessertType: "tieredCake" | "smallCakeTreats" | "treatsOnly";
  flavorFilling: string[];
  setFlavorFilling: React.Dispatch<React.SetStateAction<string[]>>;
  onContinue: (selections: {
    flavorFilling: string[];
    cakeStyle?: string;
    treatType?: "" | "cupcakes" | "goodies";
    cupcakes?: string[];
    goodies?: string[];
  }) => void;
  onBack: () => void;
  onClose: () => void;
}

const png = (name: string) => `/assets/images/YumYum/${name}.png`;

const RubiDessertMenu: React.FC<RubiDessertMenuProps> = ({
  dessertType,
  flavorFilling,
  setFlavorFilling,
  onContinue,
  onBack,
  onClose,
}) => {
  const [showModal, setShowModal] = useState<
    "flavor" | "style" | "treatType" | "goodies" | "cupcakes" | null
  >(null);

  const [cakeStyle, setCakeStyle] = useState<string>("");
  const [treatType, setTreatType] = useState<"" | "cupcakes" | "goodies">("");
  const [goodies, setGoodies] = useState<string[]>([]);
  const [cupcakes, setCupcakes] = useState<string[]>([]);

  const goodiesList = useMemo(() => Object.keys(GOODIE_CATALOG), []);

  useEffect(() => {
    setTreatType("");
    setGoodies([]);
    setCupcakes([]);
    setCakeStyle("");
    setFlavorFilling([]);

    try {
      localStorage.setItem(
        "yumDessertSelections",
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

  useEffect(() => {
    const raw = localStorage.getItem("yumDessertSelections");
    if (!raw) return;
    try {
      const s = JSON.parse(raw);
      if (typeof s?.cakeStyle === "string") setCakeStyle(s.cakeStyle);
      if (s?.treatType === "cupcakes" || s?.treatType === "goodies") setTreatType(s.treatType);
      if (Array.isArray(s?.goodies)) setGoodies(s.goodies);
      if (Array.isArray(s?.cupcakes)) setCupcakes(s.cupcakes);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("yumStep", "dessertMenu");
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

  const canContinue = (): boolean => {
    if (dessertType === "tieredCake") return flavorFilling.length > 0 && !!cakeStyle;
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
      localStorage.setItem("yumDessertSelections", JSON.stringify(snap));
    } catch {}
  };

  const handleContinue = () => {
    const selections = { flavorFilling, cakeStyle, treatType, goodies, cupcakes };
    console.log("[RUBI][DessertMenu] continue with →", selections);
    persistSnapshot(selections);
    onContinue(selections);
  };

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 680 }}>
      {onClose && (
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
        </button>
      )}

      <div className="pixie-card__body">
        <h2 className="px-title-lg" style={{ marginBottom: "0.85rem", textAlign: "center" }}>
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
          style={{ width: 160, margin: "0 auto 20px", display: "block" }}
        />

        {(dessertType === "tieredCake" || dessertType === "smallCakeTreats") && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "2rem",
              marginBottom: "2rem",
            }}
          >
            <div onClick={() => setShowModal("flavor")}>
              <img
                src={png("cakeFlavorFilling")}
                alt="Cake Flavor"
                style={headerStyle}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              />
            </div>
            {flavorFilling.map((item) => (
              <div key={item} onClick={() => setShowModal("flavor")} style={selectionStyle}>
                {item}
              </div>
            ))}

            <div onClick={() => setShowModal("style")}>
              <img
                src={png("cake_style")}
                alt="Cake Style"
                style={headerStyle}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.08)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              />
            </div>
            {cakeStyle && (
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
                  onClick={() => setShowModal("goodies")}
                  style={headerStyle}
                />

                {(() => {
                  const byGroup: Record<string, string[]> = {};
                  for (const token of goodies) {
                    const [groupRaw, labelRaw] = String(token).split("::");
                    const group = groupRaw?.trim() || "Other treats";
                    const label = labelRaw?.trim() || token;
                    if (!byGroup[group]) byGroup[group] = [];
                    if (!byGroup[group].includes(label)) byGroup[group].push(label);
                  }
                  return Object.entries(byGroup).map(([group, labels]) => (
                    <div key={group} style={{ marginBottom: "1.25rem", textAlign: "center" }}>
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

        <div className="px-cta-col" style={{ marginTop: "1rem" }}>
          <button
            className="boutique-primary-btn"
            onClick={handleContinue}
            disabled={!canContinue()}
          >
            Continue
          </button>
          <button className="boutique-back-btn" onClick={onBack}>
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
        <div className="pixie-overlay" style={{ zIndex: 1001 }}>
          <StyleModal
            selected={cakeStyle ? [cakeStyle] : []}
            onChange={(vals) => {
              const next = vals[0] || "";
              setCakeStyle(next);
              persistSnapshot({ cakeStyle: next });
            }}
            onClose={() => setShowModal(null)}
          />
        </div>
      )}

      {showModal === "cupcakes" && (
        <FlavorModal
          title="Pick up to 2 cupcake flavors"
          selected={cupcakes}
          maxSelections={2}
          onChange={({ titles }) => {
            setCupcakes(titles);
            persistSnapshot({ cupcakes: titles });
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
              const snap = JSON.parse(localStorage.getItem("yumDessertSelections") || "{}");
              localStorage.setItem("yumDessertSelections", JSON.stringify({ ...snap, goodies: labels }));
            } catch {}
          }}
          onClose={() => setShowModal(null)}
        />
      )}

      {showModal === "treatType" && (
        <div className="pixie-overlay" style={{ zIndex: 1001 }}>
          <div className="pixie-card pixie-card--modal" style={{ maxWidth: 600, position: "relative" }}>
            <button className="pixie-card__close" onClick={() => setShowModal(null)} aria-label="Close">
              <img src={`${import.meta.env.BASE_URL}assets/icons/blue_ex.png`} alt="Close" />
            </button>

            <div className="pixie-card__body" style={{ textAlign: "center" }}>
              <h3 className="px-title-md" style={{ marginBottom: "1.25rem" }}>
                Which type of treat table would you like?
              </h3>

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
                  src={`${import.meta.env.BASE_URL}assets/images/YumYum/cupcake.png`}
                  alt="Cupcakes"
                  style={{
                    width: "80%",
                    maxWidth: 300,
                    borderRadius: 12,
                    border: treatType === "cupcakes" ? "3px solid #2c62ba" : "1px solid #ccc",
                  }}
                />
                <div style={{ fontWeight: "bold", marginTop: "0.5rem" }}>Cupcakes</div>
              </div>

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
                  src={`${import.meta.env.BASE_URL}assets/images/YumYum/goodies.png`}
                  alt="Goodies"
                  style={{
                    width: "80%",
                    maxWidth: 300,
                    borderRadius: 12,
                    border: treatType === "goodies" ? "3px solid #2c62ba" : "1px solid #ccc",
                  }}
                />
                <div style={{ fontWeight: "bold", marginTop: "0.5rem" }}>Goodies</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RubiDessertMenu;