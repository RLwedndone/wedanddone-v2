// src/components/NewYumBuild/CustomVenues/Ocotillo/OcotilloMenuBuilder.tsx
import React, { useEffect, useState } from "react";
import SelectionModal from "../../shared/SelectionModal";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

/* ───────────────────────── Types ───────────────────────── */

export type OcotilloTier = "tier1" | "tier2" | "tier3";

export interface OcotilloMenuSelections {
  tier: OcotilloTier;
  appetizers: string[]; // up to 3
  salads: string[]; // up to 2
  entrees: string[]; // up to 3 (from tier list)
  desserts: string[]; // up to 1
}

interface Props {
  selectedTier: OcotilloTier;
  menuSelections: OcotilloMenuSelections;
  setMenuSelections: (s: OcotilloMenuSelections) => void;
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
}

/* ───────────────────────── Static Menu Data (Ocotillo 2025) ───────────────────────── */

// ✅ 2025 Appetizers (all presented as stationed)
const ocotilloAppetizers = [
  "Smoked Beets, Ricotta, Arugula, Pistachios, Truffle Honey",
  "Roasted Cauliflower, Kale Pesto, Mint, Basil, Lemon Olive Oil, Peanuts",
  "Grilled Heirloom Squash, Pumpkin Seed Mole, Date, Tamarind Sauce",
  "Hummus, Organic Raw Vegetables, Herb Tahini, Olives, Feta, Marinated Cucumbers, Grilled Pita",
  "Persian Cucumbers, Corona Beans, Shallots, Dill, Preserved Lemon Dressing",
  "Sundried Strawberries, Herbed Ricotta, Aged Balsamico, Grilled Bread",
  "Assorted Cheese, Nuts, Dried Fruits, Berries, Crackers, Compotes, Grilled Country Bread",
  "Falafel, Grilled Pita, Baba Ganoush, Preserved Lime Condiment, Greek Yogurt",
  "Assorted Seasonal Organic Fruit",
  "Grilled Lollipop Lamb Chops, Mint, Aged Balsamico, Pomegranate",
  "Prosciutto, Arugula, Burrata, Roasted Red Peppers, Garlic Crostini",
  "Smoked Prime Rib, Horseradish Crème Fraîche, Gem Lettuce, Buttermilk Sliders",
  "Chilled Gulf Shrimp, Cocktail Sauce, Atomic Horseradish, Lemon",
  "Grilled Baby Back Ribs, Toasted Garlic, Lemon Zest, Cherry Wood Balsamico",
  "Crispy Duck Wings, Sesame, Flax Seed, Chiles, Peanuts, Scallions",
  "Smoked Salmon, Seeded Toast, Lemon, Capers, Red Onion, Lemon Crème Fraîche",
  "Spanish Piquillo Peppers Stuffed with Crab Salad, Lemon Aioli, Tarragon, Sea Salt",
  "Grilled Chicken Shawarma, Greek Yogurt, Mint",
  "Grilled Shrimp, Cocktail Sauce, Atomic Horseradish, Lemon",
  "Kushi Oysters, Preserved Lemon, Shallot, Olive Oil",
  "Crispy Vegetarian Eggroll, Spicy Peanut Sauce",
  "Pork and Vegetable Pot Stickers, Toasted Sesame Sauce",
  "Beef Empanadas, Jalapeño Chimichurri",
  "Pigs in a Blanket, Cognac Mustard",
  "Caprese Skewer: Tomato, Mozzarella, Basil, Balsamico, Olive Oil",
];

// ✅ 2025 Salads
const ocotilloSalads = [
  "Baby Arugula, Shaved Fennel, Roasted Apples, Burrata, Pecan, Mint, Herb Vinaigrette (v, gf)",
  "Baby Gem Lettuce Caesar, Garlic Crouton, Crispy Herbs, Shaved Parmesan, Caesar Dressing (v)",
  "Mixed Greens, Herb Hummus, Tomato, Cucumber, Seeds, Grains, Preserved Lemon Dressing (vg, gf)",
  "Gem Lettuces, Shaved Apples, Shaved Pears, Smoked Almonds, Sherry Dressing (vg, gf)",
  "Spinach, Roasted Squash, Crispy Black Rice, Red Onion, Parmesan, Ginger Vinaigrette (v, gf)",
  "Baby Lettuces, Tomato, Cucumber, Onion, Fennel, Shaved Carrot, Herbs, Red Wine Vinaigrette (v, gf)",
  "Italian Salad: Lettuces, Tomato, Cucumber, Chickpeas, Salami, Parmesan, Caper Vinaigrette (gf)",
  "Baby Red Gem Lettuce, Roasted Beets, Goat Cheese, Pistachios, Lemon Vinaigrette (v, gf)",
  "Butter Lettuces, Vanilla Poached Pears, Bleu Cheese, Almonds, Champagne Vinaigrette (v)",
  "Tuscan Kale, Sautéed Brussels Sprouts, Almonds, Parmesan, Chopped Egg, Herb Vinaigrette (v)",
  "Baby Spinach, Smoked Salmon, Red Onion, Mandarin Oranges, Sesame Vinaigrette (gf)",
  "Red and Yellow Endive, Blue Cheese, Shaved Apples, Zante Currants, Pecans, Truffle Dressing (v, gf)",
  "Butter Lettuces, Petite Herbs, Oranges, Ricotta, Pistachios, Champagne Vinaigrette (v, gf)",
  "Organic Lettuces, Strawberries, Roasted Pistachios, Farmers Cheese, Balsamic Vinaigrette (v, gf)",
];

// ✅ Entrées — broken out per tier
const ocotilloEntreesTier1 = [
  "Mesquite Grilled Ocotillo Chicken, Citrus, Chilies, Honey, Pecans, Date-Potato Salad (gf, df)",
  "Wood Roasted Chicken, Garlic Mashed Potatoes, Roasted Heirloom Carrots, Brown Gravy (gf)",
  "Pork Shank, Garlic Mashed Potatoes, Roasted Heirloom Carrots, Pork Jus (gf)",
  "Mesquite Grilled Baby Back Ribs, Garlic Mashed Potatoes, Lemon Spinach (gf)",
  "Grilled Scottish Salmon, Broccolini, Marble Potatoes, White Wine Sauce (gf)",
  "Mafaldine Pasta, Eggplant Ragu, Roasted Tomato, Kalamata Olives, Garlic Crumbs, Basil, Parmesan (v)",
  "Casarecce Pasta, Tomato, Toasted Garlic, Basil, White Wine Sauce OR Tomato Sauce (vg)",
  "Penne (Rice) Pasta, Tuscan Kale, Oven-Dried Tomatoes, Preserved Lemon, Garlic, Herbs, Parmesan (v, gf)",
];

const ocotilloEntreesTier2 = [
  "Mole Negro Chicken, Lime-Scented Brown Rice, Black Beans, Cilantro (gf)",
  "Pan-Seared Sea Bass, Roasted Beets, Fennel, Citrus Beurre Blanc Sauce (gf)",
  "Grilled Salmon, Roasted Delicata Squash, Cauliflower Purée, Preserved Lemon (gf)",
  "Seared Halibut, Mushrooms, Corn, Orzo, Greens, Saffron-Tomato Broth",
  "Grilled Ribeye, Garlic Mashed Potatoes, Roasted Heirloom Carrots, Red Wine Sauce (gf)",
  "Wood Fired Beef Ribs, Mole-BBQ Sauce, Parmesan-Truffle Fries (gf)",
  "Rigatoni Pasta, Braised Beef Ragu, Tomatoes, Roasted Garlic, Basil, Parmesan (gf)",
  "Seasonal Acorn Squash Stuffed with Mushrooms, Spinach, Forbidden Rice, Pumpkin Seed Mole (vg, gf)",
  "Baked Lumache, Grilled Chicken, Scallions, Braised Greens, Parmesan, White Wine Sauce",
];

const ocotilloEntreesTier3 = [
  "Dry Aged Ribeye Set with Marrow, Roasted Fingerling Potatoes, Red Wine Sauce (gf)",
  "Roasted Turbot, Hearts of Palm, Pea Shoots, Baby Lettuces, Carrot Nage (gf)",
  "Porcini Crusted Ribeye, Roasted Brussels Sprouts, Potato Gratin, Truffle Sauce (gf)",
  "Prime Beef Filet, Buttered Marble Potatoes, Roasted Brussels Sprouts, Bordelaise Sauce (gf)",
  "Braised Bone-In Short Rib, Marrow, Mashed Potatoes, Root Vegetables, Chianti Sauce (gf)",
  "Chitarra Pasta, Clams, Sausage, White Wine, Parsley, Calabrian Chili, Parmesan",
  "Short Rib Ravioli, Melted Leeks, Truffle Sauce, Shaved Parmesan, Pistachio Crumbs",
  "Radiatore Pasta, Gulf Shrimp, Roasted Fennel, Basil, Mint, Serrano, White Wine Sauce",
  "Seared Diver Scallops, Roasted Fennel, Cherries, Baby Arugula, Vermouth Butter Sauce (gf)",
  "Crispy Half Duck, Roasted Apples, Braised Red Cabbage, Currants, Duck Jus (gf)",
  "Ravioli of Sweet Corn & Ricotta, Roasted Scallops, Basil, Shaved Chili, White Wine Sauce",
];

// helper map so we can look up entrees by tier
const ENTREES_BY_TIER: Record<OcotilloTier, string[]> = {
  tier1: ocotilloEntreesTier1,
  tier2: ocotilloEntreesTier2,
  tier3: ocotilloEntreesTier3,
};

// ✅ Desserts — Tiered structure
const ocotilloDessertsByTier = {
  tier1: [
    "Assorted Dessert Shooters (v)",
    "Assorted Cookies & Brownies (v)",
    "Mini Chocolate Ganache Tartlets (v)",
    "Mini Fruit Tartlets (v)",
    "Seasonal Mini Cupcakes (v)",
    "Mini Lemon Bars (v)",
    "Mini Cheesecake Bites (v)",
  ],
  tier2: [
    "Assorted Mini Pastries (v)",
    "Mini Chocolate Pots de Crème (v, gf)",
    "Mini Key Lime Pies (v)",
    "Mini Crème Brûlée (v, gf)",
    "Mini Seasonal Cakes (v)",
    "Mini Cannoli (v)",
  ],
  tier3: [
    // tier 3 = tier1 + tier2 (full access)
    "Assorted Dessert Shooters (v)",
    "Assorted Cookies & Brownies (v)",
    "Mini Chocolate Ganache Tartlets (v)",
    "Mini Fruit Tartlets (v)",
    "Seasonal Mini Cupcakes (v)",
    "Mini Lemon Bars (v)",
    "Mini Cheesecake Bites (v)",
    "Assorted Mini Pastries (v)",
    "Mini Chocolate Pots de Crème (v, gf)",
    "Mini Key Lime Pies (v)",
    "Mini Crème Brûlée (v, gf)",
    "Mini Seasonal Cakes (v)",
    "Mini Cannoli (v)",
  ],
};

/* Pick limits (same for all three tiers) */
const LIMITS = {
  appetizers: 3,
  salads: 2,
  entrees: 3,
  desserts: 1,
};

/* Tier labels for header */
const TIER_LABEL: Record<OcotilloTier, string> = {
  tier1: "Tier 1 • $85 per guest",
  tier2: "Tier 2 • $110 per guest",
  tier3: "Tier 3 • $135 per guest",
};

/* ───────────────────────── Component ───────────────────────── */

const OcotilloMenuBuilder: React.FC<Props> = ({
  selectedTier,
  menuSelections,
  setMenuSelections,
  onContinue,
  onBack,
  onClose,
}) => {
  const [showModal, setShowModal] = useState<
    null | "appetizers" | "salads" | "entrees" | "desserts"
  >(null);

  const [hovered, setHovered] = useState<string | null>(null);

  // Init / sync tier and enforce limits across categories
  useEffect(() => {
    const next: OcotilloMenuSelections = {
      tier: selectedTier,
      appetizers: (menuSelections.appetizers || []).slice(
        0,
        LIMITS.appetizers
      ),
      salads: (menuSelections.salads || []).slice(0, LIMITS.salads),
      entrees: (menuSelections.entrees || []).slice(0, LIMITS.entrees),
      desserts: (menuSelections.desserts || []).slice(0, LIMITS.desserts),
    };
    setMenuSelections(next);
    persist(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTier]);

  // First load: hydrate from Firestore or localStorage
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      if (!user) {
        const local = localStorage.getItem("ocotilloMenuSelections");
        if (local) {
          try {
            const parsed = JSON.parse(local) as OcotilloMenuSelections;
            setMenuSelections(parsed);
          } catch {}
        }
        return;
      }

      try {
        const ref = doc(
          db,
          "users",
          user.uid,
          "yumYumData",
          "ocotilloMenuSelections"
        );
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const saved = snap.data() as OcotilloMenuSelections;
          setMenuSelections(saved);
        } else {
          const seeded: OcotilloMenuSelections = {
            tier: selectedTier,
            appetizers: [],
            salads: [],
            entrees: [],
            desserts: [],
          };
          setMenuSelections(seeded);
          persist(seeded);
        }
      } catch (e) {
        console.error("❌ Error fetching Ocotillo selections:", e);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // persist helper
  const persist = (next: OcotilloMenuSelections) => {
    localStorage.setItem("ocotilloMenuSelections", JSON.stringify(next));
    localStorage.setItem("yumStep", "ocotilloMenu");

    onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      try {
        await setDoc(
          doc(db, "users", user.uid, "yumYumData", "ocotilloMenuSelections"),
          next,
          { merge: true }
        );
        await setDoc(
          doc(db, "users", user.uid),
          { progress: { yumYum: { step: "ocotilloMenu" } } },
          { merge: true }
        );
      } catch (e) {
        console.error("❌ Error saving Ocotillo selections:", e);
      }
    });
  };

  // derive the entree options for THIS tier
  const entreesList = ENTREES_BY_TIER[menuSelections.tier || selectedTier];

  const picked = (k: keyof OcotilloMenuSelections) =>
    (menuSelections[k] as string[]) || [];

  const open = (k: typeof showModal) => setShowModal(k);

  const closeWith = (
    k: Exclude<typeof showModal, null>,
    selections: string[]
  ) => {
    const next: OcotilloMenuSelections = { ...menuSelections };

    switch (k) {
      case "appetizers":
        next.appetizers = selections.slice(0, LIMITS.appetizers);
        break;
      case "salads":
        next.salads = selections.slice(0, LIMITS.salads);
        break;
      case "entrees":
        next.entrees = selections.slice(0, LIMITS.entrees);
        break;
      case "desserts":
        next.desserts = selections.slice(0, LIMITS.desserts);
        break;
    }

    setMenuSelections(next);
    persist(next);
    setShowModal(null);
  };

  // Sections shown in the builder UI
  const sections: Array<{
    key: typeof showModal;
    label: string;
    img: string;
  }> = [
    {
      key: "appetizers",
      label: "Appetizers",
      img: `${import.meta.env.BASE_URL}assets/images/YumYum/Ocotillo/stationed.png`,
    },
    {
      key: "salads",
      label: "Salads",
      img: `${import.meta.env.BASE_URL}assets/images/YumYum/salad.png`,
    },
    {
      key: "entrees",
      label: "Entrées",
      img: `${import.meta.env.BASE_URL}assets/images/YumYum/Entrees.png`,
    },
    {
      key: "desserts",
      label: "Desserts",
      img: `${import.meta.env.BASE_URL}assets/images/YumYum/Rubi/desserts.png`,
    },
  ];

  return (
    <div
      className="pixie-card pixie-card--modal"
      style={{ maxWidth: 680, textAlign: "center" }}
    >
      {/* close button */}
      {onClose && (
        <button
          className="pixie-card__close"
          onClick={onClose}
          aria-label="Close"
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
            alt="Close"
          />
        </button>
      )}

      <div className="pixie-card__body">
        {/* Header with tier + piglet */}
        <h2
          style={{
            fontFamily: "'Jenna Sue', cursive",
            fontSize: "2.2rem",
            color: "#2c62ba",
            textAlign: "center",
          }}
        >
          {TIER_LABEL[selectedTier]}
        </h2>

        <img
          src={`${import.meta.env.BASE_URL}assets/images/YumYum/piglet1.png`}
          alt="Piglet Chef"
          style={{
            width: "160px",
            margin: "0 auto 30px",
            display: "block",
          }}
        />

        {/* Category tiles */}
        {sections.map(({ key, label, img }) => {
          const sel = picked(key as keyof OcotilloMenuSelections);
          return (
            <div
              key={key}
              style={{
                textAlign: "center",
                marginBottom: "2rem",
              }}
            >
              <img
                src={img}
                alt={label}
                onClick={() => open(key)}
                onMouseEnter={() => setHovered(label)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  width: "260px",
                  cursor: "pointer",
                  transition: "transform .3s ease",
                  transform:
                    hovered === label ? "scale(1.05)" : "scale(1)",
                  borderRadius: "12px",
                }}
              />

              {sel.map((item) => (
                <div
                  key={`${label}-${item}`}
                  onClick={() => open(key)}
                  style={{
                    fontFamily: "'Nunito', sans-serif",
                    fontSize: "1rem",
                    color: "#2c62ba",
                    cursor: "pointer",
                    marginTop: "0.35rem",
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          );
        })}

        {/* CTAs */}
        <div style={{ marginTop: "1rem" }}>
          <button
            className="boutique-primary-btn"
            onClick={() => {
              localStorage.setItem("yumStep", "ocotilloCart");
              onContinue();
            }}
          >
            Continue
          </button>

          <button
            className="boutique-back-btn"
            onClick={onBack}
            style={{ marginTop: "1rem" }}
          >
            Back
          </button>
        </div>
      </div>

      {/* Modals */}
      {showModal === "appetizers" && (
        <SelectionModal
          title={`Select up to ${LIMITS.appetizers} Appetizers`}
          options={ocotilloAppetizers}
          max={LIMITS.appetizers}
          selected={menuSelections.appetizers}
          onChange={(s) => closeWith("appetizers", s)}
          onClose={() => setShowModal(null)}
        />
      )}

      {showModal === "salads" && (
        <SelectionModal
          title={`Select up to ${LIMITS.salads} Salads`}
          options={ocotilloSalads}
          max={LIMITS.salads}
          selected={menuSelections.salads}
          onChange={(s) => closeWith("salads", s)}
          onClose={() => setShowModal(null)}
        />
      )}

      {showModal === "entrees" && (
        <SelectionModal
          title={`Select up to ${LIMITS.entrees} Entrées`}
          options={entreesList}
          max={LIMITS.entrees}
          selected={menuSelections.entrees}
          onChange={(s) => closeWith("entrees", s)}
          onClose={() => setShowModal(null)}
        />
      )}

      {showModal === "desserts" && (
        <SelectionModal
          title={`Select ${LIMITS.desserts} Dessert`}
          options={ocotilloDessertsByTier[selectedTier]}
          max={LIMITS.desserts}
          selected={menuSelections.desserts}
          onChange={(s) => closeWith("desserts", s)}
          onClose={() => setShowModal(null)}
        />
      )}
    </div>
  );
};

export default OcotilloMenuBuilder;