// src/components/NewYumBuild/CustomVenues/Tubac/TubacHorsSelector.tsx
import React, { useEffect, useState } from "react";
import SelectionModal from "../../shared/SelectionModal";

interface Props {
  menuSelections: {
    horsPassed: string[];
    horsDisplayed: string[];
  };
  setMenuSelections: (m: { horsPassed: string[]; horsDisplayed: string[] }) => void;
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
}

const IMG = {
  pig: `${import.meta.env.BASE_URL}assets/images/YumYum/piglet1.png`,
  // 👇 you said you'll add these PNGs
  passed: `${import.meta.env.BASE_URL}assets/images/YumYum/Tubac/hand.png`,
  displayed: `${import.meta.env.BASE_URL}assets/images/YumYum/Tubac/displayed.png`,
};

const MAX_PASSED = 2;
const MAX_DISPLAYED = 1;

/* ---------------- Options ---------------- */
const PASSED_OPTIONS: string[] = [
  // Vegetarian
  "Tomato & Portabella Bruschetta",
  "Olive Tapenade & Garlic Fine Herb Goat Cheese Bruschetta",
  "Vegetable Spring Roll — ponzu drizzle",
  "Roasted Butternut Squash Compote & Goat Cheese Bruschetta",
  // Seafood
  "Smoked Salmon Mousse Cucumber Bites — capers",
  "Bacon Wrapped Shrimp — citrus chile BBQ sauce",
  "Seared Ahi Tuna on a Wonton Crisp — caramelized soy onions, wasabi crema",
  // Meats
  "Shaved Prosciutto Flatbread — orange fig jam, arugula, brie",
  "Beef & Manchego Empanadas — guajillo chili crema",
  "Chicken Empanadas — hatch green chili crema",
  "Mushroom Duxelles Beef Wellington Bites",
];

const DISPLAYED_OPTIONS: string[] = [
  "Charcuterie Board — artisan cheese, Genoa salami, prosciutto, roasted mini sweet peppers, gherkins, country olives, sweety drop peppers, apple fig chutney, beer mustard crostini’s, artisan crackers",
  "Antipasto Platter — grilled asparagus, roasted mushrooms, artichokes, roasted peppers, country olives, artisan salami, Italian cheese",
];

/* ---------------- Styles ---------------- */
const titleJS: React.CSSProperties = {
  fontFamily: "'Jenna Sue', cursive",
  color: "#2c62ba",
  fontSize: "2rem",
  lineHeight: 1.08,
  marginBottom: 8,
  textAlign: "center",
};

const lineJS: React.CSSProperties = {
  fontFamily: "'Jenna Sue', cursive",
  color: "#2c62ba",
  fontSize: "1.7rem",
  lineHeight: 1.1,
  cursor: "pointer",
};

const TubacHorsSelector: React.FC<Props> = ({
  menuSelections,
  setMenuSelections,
  onContinue,
  onBack,
  onClose,
}) => {
  const [show, setShow] = useState<null | "passed" | "displayed">(null);

  // clamp + persist on mount
  useEffect(() => {
    const next = {
      horsPassed: (menuSelections.horsPassed || []).slice(0, MAX_PASSED),
      horsDisplayed: (menuSelections.horsDisplayed || []).slice(0, MAX_DISPLAYED),
    };
    setMenuSelections(next);
    try {
      localStorage.setItem("yumStep", "hors");
      localStorage.setItem("tubacHorsSelections", JSON.stringify(next));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (next: { horsPassed: string[]; horsDisplayed: string[] }) => {
    setMenuSelections(next);
    try {
      localStorage.setItem("tubacHorsSelections", JSON.stringify(next));
    } catch {}
  };

  return (
    <div className="pixie-card wd-page-turn" style={{ maxWidth: 700 }}>
      {/* Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2 style={titleJS}>Choose Your Hors d’oeuvres</h2>
        <p className="px-prose-narrow" style={{ maxWidth: 560, margin: "0 auto 14px" }}>
          Pick <strong>up to {MAX_PASSED} butler-passed</strong> hors d’oeuvres and{" "}
          <strong>{MAX_DISPLAYED} displayed</strong> platter. You’ll choose service style next.
        </p>

        <img
          src={IMG.pig}
          alt="Piglet Chef"
          style={{ width: 140, margin: "6px auto 18px", display: "block" }}
        />

        {/* Butler-Passed */}
        <div style={{ marginBottom: 22 }}>
          <img
            src={IMG.passed}
            alt="Butler-Passed Hors d’oeuvres"
            onClick={() => setShow("passed")}
            style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
          />
          {menuSelections.horsPassed.length === 0 && (
            <div className="px-prose-narrow" style={{ opacity: 0.8 }}>
              Tap to choose up to {MAX_PASSED} passed hors d’oeuvres
            </div>
          )}
          {menuSelections.horsPassed.map((h) => (
            <div key={h} style={lineJS} onClick={() => setShow("passed")}>
              {h}
            </div>
          ))}
        </div>

        {/* Displayed */}
        <div style={{ marginBottom: 8 }}>
          <img
            src={IMG.displayed}
            alt="Displayed Hors d’oeuvres"
            onClick={() => setShow("displayed")}
            style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
          />
          {menuSelections.horsDisplayed.length === 0 && (
            <div className="px-prose-narrow" style={{ opacity: 0.8 }}>
              Tap to choose {MAX_DISPLAYED} displayed platter
            </div>
          )}
          {menuSelections.horsDisplayed.map((h) => (
            <div key={h} style={lineJS} onClick={() => setShow("displayed")}>
              {h}
            </div>
          ))}
        </div>

        {/* CTAs */}
        <div className="px-cta-col" style={{ marginTop: 16 }}>
          <button className="boutique-primary-btn" onClick={onContinue} style={{ width: 250 }}>
            Continue
          </button>
          <button className="boutique-back-btn" onClick={onBack} style={{ width: 250 }}>
            Back
          </button>
        </div>
      </div>

      {/* Modals */}
      {show === "passed" && (
        <SelectionModal
          title={`Passed Hors d’oeuvres — choose up to ${MAX_PASSED}`}
          options={PASSED_OPTIONS}
          max={MAX_PASSED}
          selected={menuSelections.horsPassed}
          onChange={(sel) => {
            const next = {
              horsPassed: sel.slice(0, MAX_PASSED),
              horsDisplayed: menuSelections.horsDisplayed,
            };
            persist(next);
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {show === "displayed" && (
        <SelectionModal
          title={`Displayed Platters — choose ${MAX_DISPLAYED}`}
          options={DISPLAYED_OPTIONS}
          max={MAX_DISPLAYED}
          selected={menuSelections.horsDisplayed}
          onChange={(sel) => {
            const next = {
              horsPassed: menuSelections.horsPassed,
              horsDisplayed: sel.slice(0, MAX_DISPLAYED),
            };
            persist(next);
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}
    </div>
  );
};

export default TubacHorsSelector;