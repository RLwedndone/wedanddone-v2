import React, { useState, useEffect, useMemo } from "react";
import FlavorModal from "./FlavorModal";
import { GOODIE_CATALOG } from "../dessert/dessertPricing";
import GoodiesModal from "./GoodiesModal";
import { auth, db } from "../../../firebase/firebaseConfig";
import { doc, updateDoc } from "firebase/firestore";
import StyleModal from "./StyleModal";

interface YumMenuBuilderDessertProps {
  dessertType: "tieredCake" | "smallCakeTreats" | "treatsOnly";
  flavorFilling: string[];
  setFlavorFilling: React.Dispatch<React.SetStateAction<string[]>>;
  onContinue: (selections: {
    flavorFilling: string[];
    cakeStyle?: string;
    treatType?: "" | "cupcakes" | "goodies";
    cupcakes?: string[];  // flavor titles
    goodies?: string[];   // labels from GOODIE_CATALOG keys
    onClose?: () => void;
  }) => void;
  onBack: () => void;
  onClose: () => void;
}

// put this helper near the top of the file (outside the component)
const prettyGroup = (s: string) =>
  s
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase()); // "BROWNIES & BARS" -> "Brownies & Bars"

// helper for local images
const png = (name: string) =>
  `${import.meta.env.BASE_URL}assets/images/YumYum/${name}.png`;

const YumMenuBuilderDessert: React.FC<YumMenuBuilderDessertProps> = ({
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

  // put near the top of the file
const toSentenceCase = (s: string) =>
  s.toLowerCase().replace(/(^\w|[.?!]\s+\w)/g, (m) => m.toUpperCase());

const prettyGoodie = (key: string) => {
  const [group, label] = key.split("::");
  return `${toSentenceCase(group || "")} – ${label}`;
};

  // single values (cleaned up state)
  const [cakeStyle, setCakeStyle] = useState<string>("");
  const [treatType, setTreatType] = useState<"" | "cupcakes" | "goodies">("");
  const [goodies, setGoodies] = useState<string[]>([]);
  const [cupcakes, setCupcakes] = useState<string[]>([]);

  // derive goodies list straight from the catalog (keeps us in sync)
  const goodiesList = useMemo(() => Object.keys(GOODIE_CATALOG), []);

  useEffect(() => {
    // reset transient state whenever dessertType changes
    setTreatType("");
    setGoodies([]);
    setCupcakes([]);
    setCakeStyle("");
    setFlavorFilling([]);
    // and persist a blank snapshot so reloads stay clean
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
  }, [dessertType]);

  const handleCloseToDashboard = async () => {
    // Make the next open land on the “return / thank you” card
    try {
      localStorage.setItem("yumStep", "thankYouReturn");   // ✅ key you check when reopening
    } catch {}
  
    const user = auth.currentUser;
    if (user) {
      try {
        await updateDoc(doc(db, "users", user.uid), {
          "progress.yumYum.step": "thankYouReturn",
        });
      } catch (e) {
        console.warn("⚠️ Failed to persist return step:", e);
      }
    }
  
    // hand control back to the overlay/shell to close to dashboard
    if (onClose) onClose();
  };

  // restore last selections if present
  useEffect(() => {
    const saved = localStorage.getItem("yumDessertSelections");
    if (!saved) return;
    try {
      const s = JSON.parse(saved);
      if (typeof s?.cakeStyle === "string") setCakeStyle(s.cakeStyle);
      if (s?.treatType === "cupcakes" || s?.treatType === "goodies") setTreatType(s.treatType);
      if (Array.isArray(s?.goodies)) setGoodies(s.goodies);
      if (Array.isArray(s?.cupcakes)) setCupcakes(s.cupcakes);
    } catch {/* noop */}
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

  // cupcake flavors = same as cake combos (titles)
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
      localStorage.setItem("yumDessertSelections", JSON.stringify(snap));
    } catch {/* ignore */}
  };

  const handleContinue = () => {
    const selections = {
      flavorFilling,
      cakeStyle,
      treatType,
      goodies,
      cupcakes,
    };
    persistSnapshot(selections);
    onContinue(selections);
  };

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 680 }}>
  {onClose && (
    <button
      className="pixie-card__close"
      onClick={onClose}
      aria-label="Close"
    >
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
          {/* Flavor/Filling */}
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

          {/* Cake Style */}
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

      {/* CTAs */}
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

    {/* -------- Modals (standard modal card w/ blue X) -------- */}

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

export default YumMenuBuilderDessert;