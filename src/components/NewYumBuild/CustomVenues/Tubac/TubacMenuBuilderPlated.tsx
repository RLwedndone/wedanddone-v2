// src/components/NewYumBuild/CustomVenues/Tubac/TubacMenuBuilderPlated.tsx
import React, { useState, useEffect } from "react";
import SelectionModal from "../../shared/SelectionModal";
import { getAuth } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

type Tier = "silver" | "gold" | "platinum";

interface Props {
  selectedTier: Tier;
  menuSelections: {
    appetizers: string[];
    salads: string[];   // kept for compatibility
    entrees: string[];
    sides?: string[];
  };
  setMenuSelections: (m: Props["menuSelections"]) => void;
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
}

const IMG = {
  pig: `${import.meta.env.BASE_URL}assets/images/YumYum/piglet1.png`,
  apps: `${import.meta.env.BASE_URL}assets/images/YumYum/apps.png`,
  meals: `${import.meta.env.BASE_URL}assets/images/YumYum/Meals.png`,
  salads: `${import.meta.env.BASE_URL}assets/images/YumYum/salad.png`,
};

const PLATED_APPS: string[] = [
  "Bronzed Sea Scallop — golden potato purée, pork belly lardons, maple vinaigrette, chive oil",
  "Forest Mushroom & Herb Ragout — creamy polenta, chive oil",
  "Beef Wellington — goat cheese & mushroom duxelles, puff pastry, sauce béarnaise, cracked pepper",
  "Smoked Salmon — diced red onion, capers, dill crème fraîche, crostini",
];

const PLATED_SALADS: string[] = [
  "Caesar Salad — house-made focaccia croutons, Parmesan Reginato",
  "Baby Arugula Salad — sun-dried tart cherries, Fuji apples, candied pecans, Manchego, caramelized onion, apple vinaigrette",
  "Arizona Field Green Salad — jicama, heirloom tomatoes, pepitas, white balsamic vinaigrette",
  "Limestone Lettuce Salad — port braised pears, Gorgonzola, gastrique red onions, tart cherry vinaigrette",
];

const PLATED_ENTREES: Record<Tier, string[]> = {
  silver: [
    "Grilled Top Sirloin 6 oz — crème fraîche whipped potatoes, braised broccolini, port wine rosemary demi-glace",
    "Statler Chicken Veronique — red grape & rosemary sauce, volcano rice, broccolini",
    "Grilled Faro Island Salmon — volcano rice pilaf, butter braised asparagus, citrus beurre blanc, agra dolce drizzle",
  ],
  gold: [
    "Grilled NY Strip Au Poivre — roasted Yukon potatoes, braised broccolini, peppercorn cream demi-glace",
    "Chicken Catalan — prune & apricot sauce, roasted Yukon potatoes, asparagus",
    "Pan-Seared Halibut — roasted Peruvian fingerlings, brussels w/ fried pancetta, beurre blanc, wild flowers",
  ],
  platinum: [
    "Grilled Beef Tenderloin Diane — onion & gouda au gratin potatoes, asparagus, brandy, forest mushrooms, Dijon demi-glace",
    "Miso Honey Glazed Japanese Hamachi — forbidden rice, baby bok choy, wakame, chile oil",
    "Pan-Seared Chilean Sea Bass — clam, bacon & green onion risotto, asparagus, leek & watercress nage",
  ],
};

const jsLine: React.CSSProperties = {
  fontFamily: "'Jenna Sue', cursive",
  fontSize: "2rem",
  color: "#2c62ba",
  lineHeight: 1.1,
};

const TubacMenuBuilderPlated: React.FC<Props> = ({
  selectedTier,
  menuSelections,
  setMenuSelections,
  onContinue,
  onBack,
  onClose,
}) => {
  const [show, setShow] = useState<null | "apps" | "salads" | "entrees">(null);

  // clamp on mount / when tier changes
  useEffect(() => {
    const next = {
      ...menuSelections,
      appetizers: (menuSelections.appetizers || []).slice(0, 2),
      salads: (menuSelections.salads || []).slice(0, 1),
      entrees: (menuSelections.entrees || []).slice(0, 2),
    };
    setMenuSelections(next);
    persist(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTier]);

  const persist = (next: Props["menuSelections"]) => {
    try {
      localStorage.setItem("yumStep", "menu");
      localStorage.setItem("yumMenuSelections", JSON.stringify(next));
    } catch {}
    const u = getAuth().currentUser;
    if (!u) return;
    setDoc(doc(db, "users", u.uid, "yumYumData", "menuSelections"), next, { merge: true }).catch(() => {});
    setDoc(doc(db, "users", u.uid), { progress: { yumYum: { step: "menu" } } }, { merge: true }).catch(() => {});
  };

  const update = (next: Props["menuSelections"]) => { setMenuSelections(next); persist(next); };

  // ✅ derive options exactly like Vic Verrado
  const entreesForTier = PLATED_ENTREES[selectedTier] ?? [];
  // quick sanity check in dev
  if (import.meta?.env?.MODE !== "production") {
    // Will print once per render, that's fine while debugging
    console.log("[Tubac Plated] tier:", selectedTier, "options:", entreesForTier.length);
  }

  return (
    <div className="pixie-card" style={{ maxWidth: 700 }}>
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2 style={{ ...jsLine, fontSize: "2.2rem", marginBottom: 6 }}>Your {selectedTier} Menu</h2>
        <p className="px-prose-narrow" style={{ margin: "0 auto 10px", maxWidth: 520 }}>
          Select below to create your menu.
        </p>

        <img src={IMG.pig} alt="Piglet Chef" style={{ width: 140, margin: "6px auto 18px", display: "block" }} />

        {/* Apps */}
<div style={{ marginBottom: 22 }}>
  <img
    src={IMG.apps}
    alt="Appetizers"
    onClick={() => setShow("apps")}
    style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
  />
  {menuSelections.appetizers.map((a) => (
    <div
      key={a}
      style={{
        ...jsLine,
        fontSize: "1.6rem",
        marginBottom: 12,       // ⬅️ adds breathing room between selections
        lineHeight: 1.4,        // ⬅️ more elegant spacing for multi-line items
      }}
      onClick={() => setShow("apps")}
    >
      {a}
    </div>
  ))}
</div>

{/* Salads (pick 1) */}
<div style={{ marginBottom: 22 }}>
  <img
    src={IMG.salads}
    alt="Salads"
    onClick={() => setShow("salads")}
    style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
  />
  {menuSelections.salads.map((s) => (
    <div
      key={s}
      style={{ ...jsLine, fontSize: "1.6rem", marginBottom: 12, lineHeight: 1.4 }}
      onClick={() => setShow("salads")}
    >
      {s}
    </div>
  ))}
</div>

{/* Entrees */}
<div style={{ marginBottom: 8 }}>
  <img
    src={IMG.meals}
    alt="Entrées"
    onClick={() => setShow("entrees")}
    style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
  />
  {menuSelections.entrees.map((e) => (
    <div
      key={e}
      style={{
        ...jsLine,
        fontSize: "1.6rem",
        marginBottom: 12,       // ⬅️ space between entrée lines
        lineHeight: 1.4,
      }}
      onClick={() => setShow("entrees")}
    >
      {e}
    </div>
  ))}
</div>

        <div className="px-cta-col" style={{ marginTop: 16 }}>
          <button className="boutique-primary-btn" onClick={onContinue} style={{ width: 250 }}>Continue</button>
          <button className="boutique-back-btn" onClick={onBack} style={{ width: 250 }}>Back</button>
        </div>
      </div>

      {/* Modals */}
      {show === "apps" && (
        <SelectionModal
          title="Appetizers — select up to 2"
          options={PLATED_APPS}
          max={2}
          selected={menuSelections.appetizers}
          onChange={(sel) => { update({ ...menuSelections, appetizers: sel.slice(0, 2) }); setShow(null); }}
          onClose={() => setShow(null)}
        />
      )}

{show === "salads" && (
  <SelectionModal
    title="Salads — select 1"
    options={PLATED_SALADS}
    max={1}
    selected={menuSelections.salads}
    onChange={(sel) => { update({ ...menuSelections, salads: sel.slice(0, 1) }); setShow(null); }}
    onClose={() => setShow(null)}
  />
)}

      {show === "entrees" && (
        <SelectionModal
          title="Entrées — select up to 2"    
          options={entreesForTier}            
          max={2}
          selected={menuSelections.entrees}
          onChange={(sel) => { update({ ...menuSelections, entrees: sel.slice(0, 2) }); setShow(null); }}
          onClose={() => setShow(null)}
        />
      )}
    </div>
  );
};

export default TubacMenuBuilderPlated;