import React, { useEffect } from "react";

interface Props {
  selectedTier: "peridot" | "emerald" | "turquoise" | "diamond";
  menuSelections: { appetizers: string[]; salads: string[]; entrees: string[]; sides?: string[] };
  setMenuSelections: (m: Props["menuSelections"]) => void;
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
}

const IMG = {
  pig: `${import.meta.env.BASE_URL}assets/images/YumYum/piglet1.png`,
  apps: `${import.meta.env.BASE_URL}assets/images/YumYum/apps.png`,
  sides: `${import.meta.env.BASE_URL}assets/images/YumYum/sides.png`,
  mains: `${import.meta.env.BASE_URL}assets/images/YumYum/mains.png`,
};

const BUFFET = {
  peridot: {
    pretty: "Peridot",
    appsFixed: [
      "Caesar Salad — focaccia croutons, Parmesan Reginato",
      "Arizona Heirloom Tomato Salad — ciliegine mozzarella, gastrique red onions, smoked sea salt, EVOO, basil",
    ],
    sidesFixed: [
      "Roasted Yukon Potatoes",
      "Stewed White Balsamic Tomato Risotto",
      "Braised Broccolini",
      "Roasted Squash (Italian seasonings)",
    ],
    entreesFixed: [
      "Pan-Seared Salmon — arugula pesto, capers, citrus butter sauce",
      "Chicken Scarpariello — white balsamic tomato risotto, Italian sausage, mushrooms, peppadews, fresh herbs pan sauce",
    ],
  },
  emerald: {
    pretty: "Emerald",
    appsFixed: [
      "Baby Arugula Salad — tart cherries, Fuji apples, candied pecans, Manchego, caramelized onion, apple vinaigrette",
      "Shrimp Cocktail — guajillo chile cocktail sauce, AZ lime wedges",
    ],
    sidesFixed: ["Crème Fraîche Whipped Potatoes", "Heirloom Rainbow Carrots", "Volcano Rice Pilaf", "Braised Broccolini"],
    entreeAlwaysIncluded: "Baseball Cut Top Sirloin — wild mushroom cabernet demi-glace",
    choiceChicken: "Chicken Veronique — braised w/ white wine, grapes & rosemary",
    choiceFish: "Wood-Grilled Salmon — confit cherry heirloom tomatoes, lemon beurre blanc",
  },
  turquoise: {
    pretty: "Turquoise",
    appsFixed: [
      "Arizona Heirloom Tomato Salad — ciliegine mozzarella, gastrique red onions, smoked sea salt, EVOO, basil",
      "Guajillo Spiked Caesar Salad — cotija, black bean salsa, corn frizzles",
    ],
    sidesFixed: ["Warm Corn & Flour Tortillas", "Calabacitas", "Roasted Yukon Potatoes (Chimayo chili crema)"],
    entreeAlwaysIncluded: "Annatto Rubbed New York Strip — grilled sliced & ranchero sauce",
    choiceChicken: "Chicken Asado — mojo sauce, sweet stewed tomatoes",
    choiceFish: "Pan-Seared Mahi Mahi — cucumber mango salsa, AZ citrus butter sauce",
  },
  diamond: {
    pretty: "Diamond",
    appsFixed: [
      "Heritage Salad — port braised pears, candied walnuts, gorgonzola, gastrique red onions, fig balsamic vinaigrette",
      "Chilled Seafood Platter — prawns, lobster tail, smoked salmon, guajillo cocktail sauce, green goddess aioli, capers, lemon & lime",
    ],
    sidesFixed: [
      "Beemster Gouda Au Gratin",
      "Slow Roasted Pork Belly & Green Onion Risotto",
      "Baby Carrots",
      "Roasted Asparagus (confit heirloom tomatoes)",
    ],
    entreesFixed: [
      "Beef Tenderloin Diane — brandy, wild mushroom & Dijon demi-glace",
      "Pan-Seared Halibut — leek & watercress nage",
    ],
  },
} as const;

const jsLine: React.CSSProperties = {
  fontFamily: "'Jenna Sue', cursive",
  fontSize: "2rem",
  color: "#2c62ba",
  lineHeight: 1.1,
};

const TubacMenuBuilderBuffet: React.FC<Props> = ({
  selectedTier,
  menuSelections,
  setMenuSelections,
  onContinue,
  onBack,
  onClose,
}) => {
  const data = (BUFFET as any)[selectedTier];
  const pretty = data.pretty as string;
  const isChoiceTier = !!data.entreeAlwaysIncluded; // Emerald / Turquoise

  const persist = (next: Props["menuSelections"]) => {
    try {
      localStorage.setItem("yumStep", "menu");
      localStorage.setItem("tubacBuffetSelections", JSON.stringify(next));
      localStorage.setItem("yumMenuSelections", JSON.stringify(next)); // back-compat
    } catch {}
  };

  // fresh slate on tier change
  useEffect(() => {
    const next = { appetizers: [], salads: [], sides: [], entrees: [] };
    setMenuSelections(next);
    persist(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTier]);

  // listen for external resets (from tier screen)
  useEffect(() => {
    const reset = () => {
      const next = { appetizers: [], salads: [], sides: [], entrees: [] };
      setMenuSelections(next);
      try {
        localStorage.removeItem("tubacBuffetSelections");
        localStorage.removeItem("yumMenuSelections");
      } catch {}
    };
    window.addEventListener("tubac:resetMenu", reset);
    return () => window.removeEventListener("tubac:resetMenu", reset);
  }, [setMenuSelections]);

  // radio choice for Emerald/Turquoise
  const currentChoice = (menuSelections.entrees?.[0] as string | undefined) || "";
  const setChoice = (value: "chicken" | "fish") => {
    const entree = value === "chicken" ? data.choiceChicken : data.choiceFish;
    const next = { ...menuSelections, entrees: [entree] };
    setMenuSelections(next);
    persist(next);
  };

  const topLine = isChoiceTier ? `Build your ${pretty} buffet` : `Here’s your ${pretty} buffet!`;

  return (
    <div className="pixie-card wd-page-turn" style={{ maxWidth: 700 }}>
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2 style={{ ...jsLine, fontSize: "2.2rem", marginBottom: 6 }}>{topLine}</h2>

        {isChoiceTier && (
          <p className="px-prose-narrow" style={{ margin: "0 auto 10px", maxWidth: 520 }}>
            Your buffet includes the beef entrée below, plus your choice of <strong>chicken</strong> <em>or</em> <strong>fish</strong>.
          </p>
        )}

        <img src={IMG.pig} alt="Piglet Chef" style={{ width: 140, margin: "6px auto 18px", display: "block" }} />

        {/* Apps */}
        <div style={{ marginBottom: 22 }}>
          <img src={IMG.apps} alt="Appetizers" style={{ width: 260, display: "block", margin: "0 auto 6px" }} />
          {data.appsFixed.map((a: string) => (
            <div key={a} style={jsLine}>{a}</div>
          ))}
        </div>

        {/* Sides */}
        <div style={{ marginBottom: 22 }}>
          <img src={IMG.sides} alt="Sides" style={{ width: 260, display: "block", margin: "0 auto 6px" }} />
          {data.sidesFixed.map((s: string) => (
            <div key={s} style={jsLine}>{s}</div>
          ))}
        </div>

        {/* Mains / Entrées */}
        <div style={{ marginBottom: 10 }}>
          <img src={IMG.mains} alt="Mains" style={{ width: 260, display: "block", margin: "0 auto 6px" }} />

          {/* Peridot / Diamond: fixed mains */}
          {!isChoiceTier &&
            (data.entreesFixed || []).map((e: string) => (
              <div key={e} style={jsLine}>{e}</div>
            ))}

          {/* Emerald / Turquoise: beef included + chicken OR fish choice */}
          {isChoiceTier && (
            <div style={{ maxWidth: 560, margin: "0 auto" }}>
              <div style={{ ...jsLine, marginBottom: 8 }}>{data.entreeAlwaysIncluded}</div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto 1fr",
                  alignItems: "center",
                  gap: 10,
                  margin: "8px 0 12px",
                }}
              >
                <div style={{ ...jsLine, fontSize: "1.5rem" }}>{data.choiceChicken}</div>
                <div style={{ fontWeight: 700, color: "#2c62ba" }}>— or —</div>
                <div style={{ ...jsLine, fontSize: "1.5rem" }}>{data.choiceFish}</div>
              </div>

              <div role="group" aria-label="Choose chicken or fish" style={{ display: "flex", justifyContent: "center", gap: 18 }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="tubac-main-choice"
                    value="chicken"
                    checked={currentChoice === data.choiceChicken}
                    onChange={() => setChoice("chicken")}
                  />
                  Chicken
                </label>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="radio"
                    name="tubac-main-choice"
                    value="fish"
                    checked={currentChoice === data.choiceFish}
                    onChange={() => setChoice("fish")}
                  />
                  Fish
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="px-cta-col" style={{ marginTop: 16 }}>
          <button className="boutique-primary-btn" onClick={onContinue} style={{ width: 250 }}>
            Continue
          </button>
          <button className="boutique-back-btn" onClick={onBack} style={{ width: 250 }}>
            Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default TubacMenuBuilderBuffet;