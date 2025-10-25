// src/components/NewYumBuild/CustomVenues/Encanterra/EncanterraMenuBuilder.tsx
import React, { useEffect, useMemo, useState } from "react";
import SelectionModal from "../../shared/SelectionModal";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

/* ───────── Types ───────── */
export type Tier = "oneCarat" | "twoCarat" | "threeCarat";

export interface EncanterraMenuSelections {
  tier: Tier;
  hors: string[];    // 2/2/3 depending on tier
  salads: string[];  // 1
  entrees: string[]; // 3/2/1 depending on tier (1 = plated duet)
  sides: string[];   // 2
}

interface Props {
  selectedTier: Tier; // from DiamondTierSelector
  menuSelections: EncanterraMenuSelections;
  setMenuSelections: (s: EncanterraMenuSelections) => void;
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
}

/* ───────── Data ───────── */
const HORS: string[] = [
  "Bruschetta – tomato | basil | goat cheese | crostini",
  "Mango Crostini – mango | tomato | red bell pepper | onion",
  "Arancini Risotto – mozzarella | basil marinara",
  "Spinach & Artichoke Cup – cream cheese | filo cup",
  "Vegetable Egg Roll – hoisin sauce",
  "Roasted Beef Empanadas – jalapeño cilantro cream",
  "Bacon Wrapped Asparagus – brown sugar | spices",
  "Italian Meatball – marinara | ciabatta",
  "Pork Pot Stickers – black bean sauce | chili oil | stir fry veggie",
  "Mini Beef Wellington – beef tenderloin | mushroom",
  "Coconut Chicken Skewer – thai chili sauce",
  "Chipotle Chicken Cup – jalapeño cilantro cream",
  "Miniature Crab Cake – cajun remoulade",
  "Mini Shrimp Cocktail – cocktail sauce | lemon twist",
];

const SALADS: string[] = [
  "Garden Greens – cucumber | matchstick carrots | tomato | red onion | champagne vin",
  "Romaine Hearts – shaved parmesan | herb croutons | creamy caesar dressing",
  "Baby Spinach – strawberries | feta | candied pecans | honey poppy seed dressing",
  "Classic Wedge – bleu cheese crumbles | candied bacon | tomato | red onion | creamy ranch",
];

const ENTREES: string[] = [
  "Braised Beef Short Rib (gluten free) – burgundy wine sauce",
  "Pork Tenderloin (gluten free) – red onion jam | port wine demi",
  "Herb Roasted Chicken (gluten free) – sweet tomato cream",
  "Roasted Chicken Breast",
  "Pecan Crusted Salmon (gluten free) – bourbon brown sugar glaze",
  "Potato Chip Crusted Cod – lemon dill beurre blanc",
  "Shrimp Scampi Pasta (plated option only) – tomato | fresh herbs",
  "Pappardelle Pasta (vegetarian) – local seasonal vegetables | roasted plum tomato sauce",
];

const SIDES: string[] = [
  "Creamy Parmesan Herbed Risotto",
  "Caramelized Shallot Whipped Potatoes",
  "Rosemary & Sea Salt Roasted Fingerling Potatoes",
  "Roasted Garlic Whipped Potatoes",
  "Au Gratin Potatoes",
  "Herb Wild Rice",
  "Rice Pilaf",
  "Broccolini Spears",
  "Grilled Asparagus Spears",
  "Roasted Brussels Sprouts",
  "Dilled Baby Carrots",
  "Honey Glazed Green Beans & Carrots",
];

/* Pick limits by tier */
const LIMITS: Record<Tier, { hors: number; salads: number; entrees: number; sides: number }> = {
  oneCarat:   { hors: 2, salads: 1, entrees: 3, sides: 2 }, // guest chooses 1 at table from 3
  twoCarat:   { hors: 2, salads: 1, entrees: 2, sides: 2 },
  threeCarat: { hors: 3, salads: 1, entrees: 1, sides: 2 }, // plated duet
};

const TIER_LABEL: Record<Tier, string> = {
  oneCarat: "1 Carat • $60 per guest",
  twoCarat: "2 Carat • $70 per guest",
  threeCarat: "3 Carat • $85 per guest",
};

const entreeMaxFor = (tier: Tier) => (tier === "threeCarat" ? 2 : LIMITS[tier].entrees);

/* ───────── Component ───────── */
const EncanterraMenuBuilder: React.FC<Props> = ({
  selectedTier,
  menuSelections,
  setMenuSelections,
  onContinue,
  onBack,
  onClose,
}) => {
  const [showModal, setShowModal] = useState<null | "hors" | "salads" | "entrees" | "sides">(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Tier 2 (buffet) cannot choose plated-only Shrimp Scampi
  const isTier2 = (menuSelections.tier || selectedTier) === "twoCarat";
  const FILTERED_ENTREES = useMemo(
    () => ENTREES.filter((e) => !(isTier2 && e.startsWith("Shrimp Scampi Pasta"))),
    [isTier2]
  );

  // Initialize tier + normalize caps (and filter based on tier rules)
  useEffect(() => {
    const currentTier = selectedTier;
    const maxEntrees = entreeMaxFor(currentTier);

    const cleanedEntrees = (menuSelections.entrees || [])
      .filter((e) => !(currentTier === "twoCarat" && e.startsWith("Shrimp Scampi Pasta")))
      .slice(0, maxEntrees);

    const next: EncanterraMenuSelections = {
      tier: currentTier,
      hors: (menuSelections.hors || []).slice(0, LIMITS[currentTier].hors),
      salads: (menuSelections.salads || []).slice(0, 1),
      entrees: cleanedEntrees,
      sides: (menuSelections.sides || []).slice(0, 2),
    };

    setMenuSelections(next);
    persist(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTier]);

  // First load: Firestore → localStorage fallback
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      if (!user) {
        const local = localStorage.getItem("encanterraMenuSelections");
        if (local) {
          try {
            setMenuSelections(JSON.parse(local) as EncanterraMenuSelections);
          } catch {}
        }
        return;
      }

      try {
        const ref = doc(db, "users", user.uid, "yumYumData", "encanterraMenuSelections");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          setMenuSelections(snap.data() as EncanterraMenuSelections);
        } else {
          const seeded: EncanterraMenuSelections = {
            tier: selectedTier,
            hors: [],
            salads: [],
            entrees: [],
            sides: [],
          };
          setMenuSelections(seeded);
          persist(seeded);
        }
      } catch (e) {
        console.error("❌ Error fetching Encanterra selections:", e);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (next: EncanterraMenuSelections) => {
    localStorage.setItem("encanterraMenuSelections", JSON.stringify(next));
    localStorage.setItem("yumStep", "encanterraMenu");

    onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      try {
        await setDoc(
          doc(db, "users", user.uid, "yumYumData", "encanterraMenuSelections"),
          next,
          { merge: true }
        );
        await setDoc(
          doc(db, "users", user.uid),
          { progress: { yumYum: { step: "encanterraMenu" } } },
          { merge: true }
        );
      } catch (e) {
        console.error("❌ Error saving Encanterra selections:", e);
      }
    });
  };

  const limits = LIMITS[menuSelections.tier || selectedTier];

  const picked = (k: keyof EncanterraMenuSelections) =>
    (menuSelections[k] as string[]) || [];

  const open = (k: typeof showModal) => setShowModal(k);

  const closeWith = (k: Exclude<typeof showModal, null>, selections: string[]) => {
    const next: EncanterraMenuSelections = { ...menuSelections };

    switch (k) {
      case "hors":
        next.hors = selections.slice(0, limits.hors);
        break;
      case "salads":
        next.salads = selections.slice(0, 1);
        break;
      case "entrees": {
        const max = entreeMaxFor(menuSelections.tier || selectedTier);
        const filtered = selections.filter(
          (e) => !((menuSelections.tier || selectedTier) === "twoCarat" && e.startsWith("Shrimp Scampi Pasta"))
        );
        next.entrees = filtered.slice(0, max);
        break;
      }
      case "sides":
        next.sides = selections.slice(0, 2);
        break;
    }

    setMenuSelections(next);
    persist(next);
    setShowModal(null);
  };

  const sections: Array<{
    key: typeof showModal;
    label: string;
    img: string;
    show: boolean;
  }> = [
    { key: "hors",    label: "Hors d’oeuvres", img: `${import.meta.env.BASE_URL}assets/images/YumYum/hors.png`,     show: limits.hors > 0 && HORS.length > 0 },
    { key: "salads",  label: "Salads",         img: `${import.meta.env.BASE_URL}assets/images/YumYum/salad.png`,    show: true },
    { key: "entrees", label: "Entrées",        img: `${import.meta.env.BASE_URL}assets/images/YumYum/Entrees.png`,  show: true },
    { key: "sides",   label: "Sides",          img: `${import.meta.env.BASE_URL}assets/images/YumYum/sides.png`,    show: true },
  ];

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 560, position: "relative" }}>
      {/* 🩷 Pink X */}
      <button className="pixie-card__close" aria-label="Close" onClick={onClose}>
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div
        className="pixie-card__body"
        style={{ textAlign: "center", padding: "2rem 2.5rem" }} // extra white space
      >
        <h2
          className="px-title-lg"
          style={{ fontSize: "2.2rem", color: "#2c62ba", marginBottom: 6, fontFamily: "'Jenna Sue', cursive" }}
        >
          {TIER_LABEL[selectedTier]}
        </h2>

        <img
          src={`${import.meta.env.BASE_URL}assets/images/YumYum/piglet1.png`}
          alt="Piglet Chef"
          style={{ width: 160, margin: "0 auto 24px", display: "block" }}
        />

        {sections.filter((s) => s.show).map(({ key, label, img }) => {
          const sel = picked(key as keyof EncanterraMenuSelections);
          return (
            <div key={key} style={{ textAlign: "center", marginBottom: "2rem" }}>
              <img
                src={img}
                alt={label}
                onClick={() => open(key)}
                onMouseEnter={() => setHovered(label)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  width: 260,
                  cursor: "pointer",
                  transition: "transform .25s ease",
                  transform: hovered === label ? "scale(1.05)" : "scale(1)",
                  borderRadius: 12,
                }}
              />
              {sel.map((item) => (
  <div
    key={`${label}-${item}`}
    onClick={() => open(key)}
    style={{
      fontFamily: "'Jenna Sue', cursive",
      fontSize: "1.85rem",
      color: "#2c62ba",
      cursor: "pointer",
      marginTop: "0.4rem",
      lineHeight: 1.25,
    }}
  >
    {item}
  </div>
))}
            </div>
          );
        })}

        {/* CTAs — stacked */}
        <div className="px-cta-col" style={{ marginTop: "1.25rem" }}>
          <button
            className="boutique-primary-btn"
            onClick={() => {
              localStorage.setItem("yumStep", "encanterraCart");
              onContinue();
            }}
            style={{ width: 250 }}
          >
            Continue
          </button>
          <button className="boutique-back-btn" onClick={onBack} style={{ width: 250 }}>
            Back
          </button>
        </div>
      </div>

      {/* ── Modals ── */}
      {showModal === "hors" && (
        <SelectionModal
          title={`Select up to ${limits.hors} Hors d’oeuvres`}
          options={HORS}
          max={limits.hors}
          selected={menuSelections.hors}
          onChange={(s) => closeWith("hors", s)}
          onClose={() => setShowModal(null)}
        />
      )}

      {showModal === "salads" && (
        <SelectionModal
          title="Select 1 Salad"
          options={SALADS}
          max={1}
          selected={menuSelections.salads}
          onChange={(s) => closeWith("salads", s)}
          onClose={() => setShowModal(null)}
        />
      )}

      {showModal === "entrees" && (
        <SelectionModal
          title={`Select ${entreeMaxFor(menuSelections.tier)} Entrée${
            entreeMaxFor(menuSelections.tier) > 1 ? "s" : ""
          }${menuSelections.tier === "threeCarat" ? " (paired duet)" : ""}`}
          options={FILTERED_ENTREES}
          max={entreeMaxFor(menuSelections.tier)}
          selected={menuSelections.entrees}
          onChange={(s) => closeWith("entrees", s)}
          onClose={() => setShowModal(null)}
        />
      )}

      {showModal === "sides" && (
        <SelectionModal
          title="Select 2 Sides"
          options={SIDES}
          max={2}
          selected={menuSelections.sides}
          onChange={(s) => closeWith("sides", s)}
          onClose={() => setShowModal(null)}
        />
      )}
    </div>
  );
};

export default EncanterraMenuBuilder;