import React, { useEffect, useState } from "react";
import SelectionModal from "../../shared/SelectionModal";
import type { RubiTierSelectionBBQ } from "./RubiBBQTierSelector";

export interface RubiBBQSelections {
  bbqStarters: string[];
  bbqMeats: string[];
  bbqSides: string[];
  bbqDesserts: string[];
  notes?: string;
}

interface Props {
  tierSelection: RubiTierSelectionBBQ;
  selections: RubiBBQSelections;
  setSelections: (sel: RubiBBQSelections) => void;
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
}

const STORAGE_KEY = "rubiBBQSelections";

/** Images used in the category headers (clickable) */
const IMG = {
  pig: `${import.meta.env.BASE_URL}assets/images/YumYum/piglet1.png`,
  starters: `${import.meta.env.BASE_URL}assets/images/YumYum/apps.png`,
  meats: `${import.meta.env.BASE_URL}assets/images/YumYum/Rubi/meats.png`,
  // If you don’t have “sides.png” / “dessert.png”, feel free to point these
  // at any banner you prefer. The UI still works if images 404.
  sides: `${import.meta.env.BASE_URL}assets/images/YumYum/sides.png`,
  desserts: `${import.meta.env.BASE_URL}assets/images/YumYum/Rubi/desserts.png`,
};

const jsLine: React.CSSProperties = {
  fontFamily: "'Jenna Sue', cursive",
  fontSize: "2.4rem",
  color: "#2c62ba",
  lineHeight: 1.1,
};

/** Temporary menu items (swap for Rubi's real list when ready) */
const STARTERS = ["Cornbread Muffins", "Smoked Wings", "Loaded Fries"];
const MEATS = ["Brisket", "Pulled Pork", "Smoked Chicken", "Ribs"];
const SIDES = ["Mac & Cheese", "Coleslaw", "Baked Beans", "Potato Salad"];
const DESSERTS = ["Banana Pudding", "Brownies", "Peach Cobbler"];

type ModalKey = "starters" | "meats" | "sides" | "desserts" | null;

const RubiBBQMenuBuilder: React.FC<Props> = ({
  tierSelection,
  selections,
  setSelections,
  onContinue,
  onBack,
  onClose,
}) => {
  const [localSel, setLocalSel] = useState<RubiBBQSelections>(selections);
  const [show, setShow] = useState<ModalKey>(null);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // light coercion to make sure arrays exist
        setLocalSel({
          bbqStarters: parsed.bbqStarters ?? [],
          bbqMeats: parsed.bbqMeats ?? [],
          bbqSides: parsed.bbqSides ?? [],
          bbqDesserts: parsed.bbqDesserts ?? [],
          notes: parsed.notes ?? "",
        });
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save to localStorage whenever local selection changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localSel));
    } catch {
      /* ignore */
    }
  }, [localSel]);

  // Limits from tier
  const maxStarters = tierSelection.counts.startersOrSoup || 0;
  const maxMeats = tierSelection.counts.meats || 0;
  const maxSides = tierSelection.counts.sides || 0;
  const maxDesserts = tierSelection.counts.desserts || 0;

  const canContinue =
    localSel.bbqStarters.length >= maxStarters &&
    localSel.bbqMeats.length >= maxMeats &&
    localSel.bbqSides.length >= maxSides &&
    (maxDesserts === 0 || localSel.bbqDesserts.length >= maxDesserts);

  // Updaters (modal will call these)
  const updateStarters = (sel: string[]) =>
    setLocalSel((p) => ({ ...p, bbqStarters: sel.slice(0, maxStarters) }));
  const updateMeats = (sel: string[]) =>
    setLocalSel((p) => ({ ...p, bbqMeats: sel.slice(0, maxMeats) }));
  const updateSides = (sel: string[]) =>
    setLocalSel((p) => ({ ...p, bbqSides: sel.slice(0, maxSides) }));
  const updateDesserts = (sel: string[]) =>
    setLocalSel((p) => ({ ...p, bbqDesserts: sel.slice(0, maxDesserts) }));

  return (
    <div className="pixie-card" style={{ maxWidth: 780, margin: "0 auto" }}>
      {onClose && (
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
        </button>
      )}

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2 style={{ ...jsLine, fontSize: "2.4rem", marginBottom: 6 }}>Build Your BBQ Feast!</h2>
        <p className="px-prose-narrow" style={{ margin: "0 auto 10px", maxWidth: 520 }}>
          Tap a banner to choose items for each category.
        </p>

        <img
          src={IMG.pig}
          alt="Piglet Chef"
          className="px-media"
          style={{ width: 140, margin: "6px auto 18px", display: "block" }}
        />

        {/* Starters */}
        <div style={{ marginBottom: 22 }}>
          <img
            src={IMG.starters}
            alt="Starters"
            onClick={() => setShow("starters")}
            style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
          />
          {localSel.bbqStarters.map((s) => (
            <div
              key={s}
              style={{ ...jsLine, fontSize: "2.2rem", marginBottom: 12, lineHeight: 1.4 }}
              onClick={() => setShow("starters")}
            >
              {s}
            </div>
          ))}
        </div>

        {/* Meats */}
        <div style={{ marginBottom: 22 }}>
          <img
            src={IMG.meats}
            alt="Meats"
            onClick={() => setShow("meats")}
            style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
          />
          {localSel.bbqMeats.map((m) => (
            <div
              key={m}
              style={{ ...jsLine, fontSize: "2.2rem", marginBottom: 12, lineHeight: 1.4 }}
              onClick={() => setShow("meats")}
            >
              {m}
            </div>
          ))}
        </div>

        {/* Sides */}
        <div style={{ marginBottom: 22 }}>
          <img
            src={IMG.sides}
            alt="Sides"
            onClick={() => setShow("sides")}
            style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
            onError={(e) => {
              // simple fallback if sides.png doesn't exist
              (e.currentTarget as HTMLImageElement).src = `${import.meta.env.BASE_URL}assets/images/YumYum/salad.png`;
            }}
          />
          {localSel.bbqSides.map((s) => (
            <div
              key={s}
              style={{ ...jsLine, fontSize: "2.2rem", marginBottom: 12, lineHeight: 1.4 }}
              onClick={() => setShow("sides")}
            >
              {s}
            </div>
          ))}
        </div>

        {/* Desserts */}
        {maxDesserts > 0 && (
          <div style={{ marginBottom: 8 }}>
            <img
              src={IMG.desserts}
              alt="Desserts"
              onClick={() => setShow("desserts")}
              style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
            />
            {localSel.bbqDesserts.map((d) => (
              <div
                key={d}
                style={{ ...jsLine, fontSize: "2.2rem", marginBottom: 12, lineHeight: 1.4 }}
                onClick={() => setShow("desserts")}
              >
                {d}
              </div>
            ))}
          </div>
        )}

        <div className="px-cta-col" style={{ marginTop: 16 }}>
          <button
            className="boutique-primary-btn"
            onClick={() => {
              setSelections(localSel);
              onContinue();
            }}
            disabled={!canContinue}
            style={{ width: 250, opacity: canContinue ? 1 : 0.6 }}
          >
            Continue
          </button>
          <button className="boutique-back-btn" onClick={onBack} style={{ width: 250 }}>
            Back
          </button>
        </div>
      </div>

      {/* Modals */}
      {show === "starters" && (
        <SelectionModal
          title={`Starters — select ${maxStarters}`}
          options={STARTERS}
          max={maxStarters}
          selected={localSel.bbqStarters}
          onChange={(sel) => {
            updateStarters(sel);
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {show === "meats" && (
        <SelectionModal
          title={`Meats — select ${maxMeats}`}
          options={MEATS}
          max={maxMeats}
          selected={localSel.bbqMeats}
          onChange={(sel) => {
            updateMeats(sel);
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {show === "sides" && (
        <SelectionModal
          title={`Sides — select ${maxSides}`}
          options={SIDES}
          max={maxSides}
          selected={localSel.bbqSides}
          onChange={(sel) => {
            updateSides(sel);
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {show === "desserts" && maxDesserts > 0 && (
        <SelectionModal
          title={`Desserts — select ${maxDesserts}`}
          options={DESSERTS}
          max={maxDesserts}
          selected={localSel.bbqDesserts}
          onChange={(sel) => {
            updateDesserts(sel);
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}
    </div>
  );
};

export default RubiBBQMenuBuilder;