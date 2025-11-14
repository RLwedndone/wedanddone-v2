// src/components/NewYumBuild/CustomVenues/Rubi/RubiBBQMenuBuilder.tsx
import React, { useEffect, useState } from "react";
import SelectionModal from "../../shared/SelectionModal";

/** Selections for the included BBQ package (Rubi ICON w/out alcohol). */
export interface RubiBBQSelections {
  passedApps: string[];            // ✅ new
  bbqStartersOrSalads: string[];   // ✅ renamed: 1 starter OR salad
  bbqMeats: string[];              // ✅ keep
  bbqSides: string[];              // ✅ keep
  notes?: string;
}

interface Props {
  /** Still passed from overlay; not used for counts anymore */
  selections: RubiBBQSelections;
  setSelections: (sel: RubiBBQSelections) => void;
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
}

const STORAGE_KEY = "rubiBBQSelections";

/** Category header images */
const IMG = {
  pig: `${import.meta.env.BASE_URL}assets/images/YumYum/piglet1.png`,
  passedApps: `${import.meta.env.BASE_URL}assets/images/YumYum/Rubi/passed_apps.png`,
  starters: `${import.meta.env.BASE_URL}assets/images/YumYum/Rubi/starters.png`,
  meats: `${import.meta.env.BASE_URL}assets/images/YumYum/Rubi/meats.png`,
  sides: `${import.meta.env.BASE_URL}assets/images/YumYum/sides.png`, // fallback below
};

const jsLine: React.CSSProperties = {
  fontFamily: "'Jenna Sue', cursive",
  fontSize: "2.4rem",
  color: "#2c62ba",
  lineHeight: 1.1,
};

/* ------------------------------------------------------------
   MENU DATA
------------------------------------------------------------- */

// ——— Passed Appetizers (choose 2) ———
const PASSED_APPS = [
  "Caprese Boats (v)",
  "Asparagus Bruschetta (v)",
  "Asparagus Wrapped with Prosciutto",
  "Smoked Chicken Salad Sliders",
  "Deviled Eggs (house-smoked bacon crumbles)",
  "Crostini — Ricotta & Chive Purée + Crispy Prosciutto",
  "Crostini — Caramelized Onion, Blue Cheese & Walnut",
  "Crostini — Roasted Red-Yellow Pepper + Fresh Herbs",
  "Crostini — Fresh Tomatoes + Garlic-Infused EVO",
  "Crostini — Smoked Brisket, White Bean Purée, Caramelized Onions, Sweet & Spicy BBQ",
  "Cucumber Guacamole Bites (v)",
  "Gazpacho Mexicana Shooters (v)",
  "Pulled Pork Sliders (with vinegar coleslaw)",
  "Smoked Brisket Sliders (Sweet & Spicy BBQ Sauce)",
  "Baked Brie & Bacon Jam in Phyllo Cups",
  "Meatballs (house-made BBQ sauce)",
  "Mini Crab Cakes (remoulade)",
  "Stuffed Cremini Mushrooms — Bacon, Caramelized Onions & Manchego",
  "Stuffed Cremini Mushrooms — Sundried Tomatoes & Asiago",
  "Pigs in a Blanket (spicy mustard)",
  "Buffalo Cauliflower Florets (v) — ranch or bleu cheese",
  "Smoked Chicken Flautas (guac crema & salsa roja)",
  "Mini Chimichangas — Chile Colorado (beef & red chili)",
  "Mini Chimichangas — Chile Verde (green chili pork)",
  "Mini Chimichangas — Salsa Roja",
  "Crispy Pork Belly Bites (spicy peach purée)",
];

// ——— Starters OR Salads (choose 1) ———
// We show full descriptions inside the modal, but we store/display only titles.
const SOS_ITEMS = [
  {
    title: "Deviled Eggs",
    desc: "house-smoked bacon ($1 upcharge per person)",
  },
  {
    title: "Chips & Dip",
    desc: "house-made tortilla chips, salsa verde, salsa roja & pico de gallo",
  },
  {
    title: "The Hot Mess",
    desc:
      "house-made tortilla chips topped with pulled pork, sour cream, guacamole, burnt end pit beans, salsa verde, queso fresco, pickled jalapeño",
  },
  {
    title: "Burnt End Nachos",
    desc:
      "house-made tortilla chips, burnt ends, spicy cheese sauce, jalapeños & chives",
  },
  {
    title: "Buffalo Cauliflower Florets",
    desc: "bleu cheese or ranch dip",
  },
  {
    title: "BroJo’s House Salad",
    desc:
      "romaine, cucumbers, cherry tomatoes, peppers, red onion, corn, tortilla crisps, cilantro-lime vinaigrette",
  },
  {
    title: "Iceberg Wedge",
    desc: "bleu cheese, bacon, cherry tomatoes, chives",
  },
  {
    title: "Pasta Salad",
    desc: "chilled cavatappi noodles tossed in tomato vinaigrette with fresh veggies",
  },
  {
    title: "Chophouse Spinach Salad",
    desc:
      "baby spinach, house-smoked bacon, bleu cheese crumbles, candied pecans, craisins, fresh strawberries, balsamic vinaigrette",
  },
];
const STARTERS_OR_SALADS_TITLES = SOS_ITEMS.map((i) => i.title);
const STARTERS_OR_SALADS_MODAL = SOS_ITEMS.map((i) => `${i.title} — ${i.desc}`);

// ——— Meats (choose 3) ———
const MEATS = [
  "Beef Brisket",
  "Pulled Pork",
  "Smoked Chicken",
  "Pork Belly",
  "Hot Links",
];

// ——— Sides (choose 4) ———
const SIDES = [
  "Yukon Gold Potato Salad",
  "Burnt End Pit Beans",
  "Mac & Cheese",
  "Firehouse Chili (Spicy)",
  "Vinegar Coleslaw",
  "Collard Greens",
  "Mashed Potatoes",
  "Roasted Zucchini and Corn Medley",
  "Fire Roasted Buttered Corn",
  "French Fries",
  "Sweet Potato Puree (maple butter)",
  "Buttered Green Beans",
];

/* ------------------------------------------------------------
   MODAL KEYS
------------------------------------------------------------- */
type ModalKey = "passedApps" | "startersOrSalads" | "meats" | "sides" | null;

/* ------------------------------------------------------------
   COMPONENT
------------------------------------------------------------- */
const RubiBBQMenuBuilder: React.FC<Props> = ({
  selections,
  setSelections,
  onContinue,
  onBack,
  onClose,
}) => {
  // hydrate from props (cart may have snapshot)
  const [localSel, setLocalSel] = useState<RubiBBQSelections>(selections);
  const [show, setShow] = useState<ModalKey>(null);

  // Load from localStorage on mount (if present)
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setLocalSel({
          passedApps: parsed.passedApps ?? [],
          bbqStartersOrSalads: parsed.bbqStartersOrSalads ?? [],
          bbqMeats: parsed.bbqMeats ?? [],
          bbqSides: parsed.bbqSides ?? [],
          notes: parsed.notes ?? "",
        });
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Save current selection to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localSel));
    } catch {
      /* ignore */
    }
  }, [localSel]);

  // Included limits (fixed — not tier-based)
  const maxPassedApps = 2;
  const maxStartersOrSalads = 1;
  const maxMeats = 3;
  const maxSides = 4;

  const canContinue =
    localSel.passedApps.length === maxPassedApps &&
    localSel.bbqStartersOrSalads.length === maxStartersOrSalads &&
    localSel.bbqMeats.length === maxMeats &&
    localSel.bbqSides.length === maxSides;

  return (
    <div className="pixie-card" style={{ maxWidth: 780, margin: "0 auto" }}>
      {onClose && (
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
        </button>
      )}

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2 style={{ ...jsLine, fontSize: "2.4rem", marginBottom: 6 }}>
          Build Your BBQ Feast!
        </h2>
        <p className="px-prose-narrow" style={{ margin: "0 auto 10px", maxWidth: 520 }}>
          Tap a banner to choose items for each category.
        </p>

        <img
          src={IMG.pig}
          alt="Piglet Chef"
          className="px-media"
          style={{ width: 140, margin: "6px auto 18px", display: "block" }}
        />

        {/* Passed Appetizers (2) */}
        <div style={{ marginBottom: 22 }}>
          <img
            src={IMG.passedApps}
            alt="Passed Appetizers"
            onClick={() => setShow("passedApps")}
            style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
          />
          {localSel.passedApps.map((a) => (
            <div
              key={a}
              style={{ ...jsLine, fontSize: "2.2rem", marginBottom: 12, lineHeight: 1.4 }}
              onClick={() => setShow("passedApps")}
            >
              {a}
            </div>
          ))}
        </div>

        {/* Starters or Salads (1) */}
        <div style={{ marginBottom: 22 }}>
          <img
            src={IMG.starters}
            alt="Starters or Salads"
            onClick={() => setShow("startersOrSalads")}
            style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
          />
          {localSel.bbqStartersOrSalads.map((s) => (
            <div
              key={s}
              style={{ ...jsLine, fontSize: "2.2rem", marginBottom: 12, lineHeight: 1.4 }}
              onClick={() => setShow("startersOrSalads")}
            >
              {s}
            </div>
          ))}
        </div>

        {/* Meats (3) */}
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

        {/* Sides (4) */}
        <div style={{ marginBottom: 8 }}>
          <img
            src={IMG.sides}
            alt="Sides"
            onClick={() => setShow("sides")}
            style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).src =
                `${import.meta.env.BASE_URL}assets/images/YumYum/salad.png`;
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

        {/* Jenna Sue footer note */}
        <p style={{ ...jsLine, fontSize: "2rem", marginTop: 18 }}>
          Freshly baked “Barrio Bakery” bread rolls are included.
        </p>
      </div>

      {/* Modals */}
      {show === "passedApps" && (
        <SelectionModal
          title={`Passed Appetizers — select ${2}`}
          options={PASSED_APPS}
          max={2}
          selected={localSel.passedApps}
          onChange={(sel) => {
            setLocalSel((p) => ({ ...p, passedApps: sel.slice(0, 2) }));
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {show === "startersOrSalads" && (
        <SelectionModal
          title={`Starters or Salads — select ${1}`}
          options={STARTERS_OR_SALADS_MODAL}
          max={1}
          // show the selected items in modal state by mapping stored titles → full text
          selected={STARTERS_OR_SALADS_MODAL.filter((opt) =>
            localSel.bbqStartersOrSalads.includes(opt.split(" — ")[0])
          )}
          onChange={(sel) => {
            // modal returns "Title — description"; store only the Title
            const titles = sel.map((s) => s.split(" — ")[0]).slice(0, 1);
            setLocalSel((p) => ({ ...p, bbqStartersOrSalads: titles }));
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {show === "meats" && (
        <SelectionModal
          title={`Meats — select ${3}`}
          options={MEATS}
          max={3}
          selected={localSel.bbqMeats}
          onChange={(sel) => {
            setLocalSel((p) => ({ ...p, bbqMeats: sel.slice(0, 3) }));
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {show === "sides" && (
        <SelectionModal
          title={`Sides — select ${4}`}
          options={SIDES}
          max={4}
          selected={localSel.bbqSides}
          onChange={(sel) => {
            setLocalSel((p) => ({ ...p, bbqSides: sel.slice(0, 4) }));
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}
    </div>
  );
};

export default RubiBBQMenuBuilder;