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

/* ───────────────────────── Static Menu Data ───────────────────────── */
/* NOTE: These strings are cleaned-up "pretty menu line" versions */

const APPETIZERS: string[] = [
  // Vegetarian Appetizer Platters
  "Smoked Beets, Ricotta, Arugula, Pistachios, Truffle Honey",
  "Roasted Cauliflower, Kale Pesto, Mint, Basil, Lemon Olive Oil, Peanuts",
  "Grilled Heirloom Squash, Pumpkin Seed Mole, Date, Tamarind Sauce",
  "Hummus, Organic Raw Vegetables, Herb Tahini, Olives, Feta, Marinated Cucumbers, Grilled Pita",
  "Persian Cucumbers, Corona Beans, Shallots, Dill, Preserved Lemon Dressing",
  "Sundried Strawberries, Herbed Ricotta, Aged Balsamico, Grilled Bread",
  "Assorted Cheese, Nuts, Dried Fruits, Berries, Crackers, Compotes, Grilled Country Bread",
  "Falafel, Grilled Pita, Baba Ganoush, Preserved Lime Condiment, Greek Yogurt",
  "Assorted Seasonal Organic Fruit",

  // Non-Vegetarian / Passed Appetizers (treated as part of the appetizer station for now)
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

const SALADS: string[] = [
  "Baby Arugula, Shaved Fennel, Roasted Apples, Burrata, Pecan, Mint, Herb Vinaigrette",
  "Baby Gem Lettuce Caesar, Garlic Crouton, Crispy Herbs, Shaved Parmesan, Caesar Dressing",
  "Mixed Greens, Herb Hummus, Tomato, Cucumber, Seeds, Grains, Preserved Lemon Dressing",
  "Red Gem Lettuces, Shaved Apples, Shaved Pears, Smoked Almonds, Sherry Dressing",
  "Spinach, Roasted Squash, Crispy Black Rice, Red Onion, Parmesan, Ginger Vinaigrette",
  "Baby Lettuces, Tomato, Cucumber, Onion, Fennel, Shaved Carrot, Herbs, Red Wine Vinaigrette",
  "Italian Salad: Lettuces, Tomato, Cucumber, Chickpeas, Salami, Parmesan, Caper Vinaigrette",
  "Baby Red Gem Lettuce, Roasted Beets, Goat Cheese, Pistachios, Lemon Vinaigrette",
  "Butter Lettuces, Vanilla Poached Pears, Bleu Cheese, Almonds, Champagne Vinaigrette",
  "Tuscan Kale, Sautéed Brussels Sprouts, Almonds, Parmesan, Chopped Egg, Herb Vinaigrette",
  "Baby Spinach, Smoked Salmon, Red Onion, Mandarin Oranges, Sesame Vinaigrette",
  "Red and Yellow Endive, Blue Cheese, Shaved Apples, Zante Currants, Pecans, Truffle Dressing",
  "Grilled Quail Salad, Arugula, Pink Grapefruit, Mint, Pecans, Lemon–Black Pepper Vinaigrette",
  "Butter Lettuces, Petite Herbs, Oranges, Ricotta, Pistachios, Champagne Vinaigrette",
  "Fattoush Salad: Greens, Herb Hummus, Tomato, Cucumber, Seeds, Grains, Feta, Preserved Lemon Dressing",
  "Organic Lettuces, Strawberries, Roasted Pistachios, Farmers Cheese, Balsamic Vinaigrette",
];

/* Entrées differ by tier */
const ENTREES_BY_TIER: Record<OcotilloTier, string[]> = {
  tier1: [
    "Mesquite Grilled Ocotillo Chicken, Citrus, Chiles, Honey, Pecans, Date–Potato Salad",
    "Wood Roasted Chicken, Garlic Mashed Potatoes, Roasted Heirloom Carrots, Brown Gravy",
    "Baked Creste Di Gallo Pasta, Grilled Chicken, Scallions, Braised Greens, Parmesan",
    "Pork Shank, Garlic Mashed Potatoes, Roasted Heirloom Carrots, Pork Jus",
    "Grilled Scottish Salmon on Broccolini Salad, Marble Potatoes, Chardonnay Butter Sauce",
    "Baked Lumache Pasta, Roasted Squash, Braised Greens, Goat Cheese, Herbs (V)",
    "Buckwheat Tortiglioni, Tuscan Kale, Oven-Dried Tomatoes, Preserved Lemon, Garlic, Herbs, Parmesan (GF/V)",
    "Casarecce Pasta, Tomato, Toasted Garlic, Basil, White Wine, Parmesan (V)",
  ],
  tier2: [
    "Seared Halibut, Mushrooms, Corn, Orzo, Greens, Saffron–Tomato Broth",
    "Mole Negro Chicken, Lime-Scented Brown Rice, Black Beans, Cilantro",
    "Grilled Salmon, Roasted Delicata Squash, Cauliflower Purée, Preserved Lemon",
    "Grilled Ribeye, Garlic Mashed Potatoes, Roasted Heirloom Carrots, Red Wine Sauce",
    "Wood Fired Beef Ribs, Mole-BBQ Sauce, Parmesan Truffle Fries",
    "Mediterranean Chicken, Roasted Fennel, Black Barley, Dried Barberries, Lemon Vinaigrette",
    "Rigatoni Pasta, Braised Beef Ragu, Tomatoes, Roasted Garlic, Basil, Parmesan",
    "Mesquite Grilled Baby Back Ribs, Garlic Mashed Potatoes, Lemon Spinach (GF)",
    "Seasonal Acorn Squash Stuffed with Mushrooms, Spinach, Forbidden Rice, Pumpkin Seed Mole (V)",
    "Charred Sweet Potato, Avocado, Herb Salad, Pickled Shallots, Pasilla Chili Sauce (V)",
    "Crispy Half Duck, Roasted Apples, Braised Red Cabbage, Currants, Duck Jus",
    "Ravioli of Sweet Corn & Ricotta, Roasted Scallops, Basil, Shaved Chili, White Wine Sauce",
  ],
  tier3: [
    "Pan-Seared Sea Bass, Roasted Beets, Fennel, Citrus Beurre Blanc Sauce",
    "Prime New York, Roasted Fingerling Potatoes, Lemon Spinach, Truffle Sauce",
    "Roasted Turbot, Hearts of Palm, Pea Shoots, Baby Lettuces, Carrot Nage",
    "Porcini Crusted Ribeye, Roasted Brussels Sprouts, Potato Gratin, Red Wine Sauce",
    "Prime Beef Filet, Buttered Marble Potatoes, Roasted Brussels Sprouts, Bordelaise Sauce",
    "Braised Bone-In Short Rib, Marrow, Mashed Potatoes, Root Vegetable, Chianti Sauce",
    "Roasted Quail, Porcini Stuffing, Foie Gras, Truffles, Potato Dauphinoise, Natural Jus",
    "Chitarra Pasta, Clams, Sausage, White Wine, Parsley, Calabrian Chili, Parmesan",
    "Short Rib Ravioli, Melted Leeks, Truffle Sauce, Shaved Parmesan, Pistachio Crumbs",
    "Tagliatelle Pasta, Gulf Shrimp, Roasted Fennel, Basil Mint, Serranos, White Wine Sauce",
    "Chestnut–Ricotta Ravioli, Brussel Sprout Leaves, Brandy, Sage, Amaretti Crumbs",
    "Seared Diver Scallops, Roasted Fennel, Cherries, Baby Arugula, Vermouth Butter Sauce (GF)",
  ],
};

const DESSERTS: string[] = [
  "Flourless Chocolate Cake – Raspberry Coulis, Chantilly, Fresh Berries",
  "Vanilla Panna Cotta – Strawberry Soup, Fresh Berries",
  "Pineapple Upside-Down Cake – Caramel, Pineapple Chip, Molasses Ice Cream",
  "Sticky Toffee Pudding – Brown Sugar Citrus Caramel, Candied Orange, Vanilla Ice Cream",
];

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
  // which modal is open
  const [showModal, setShowModal] = useState<null | "appetizers" | "salads" | "entrees" | "desserts">(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Init / sync tier and enforce limits across categories
  useEffect(() => {
    const next: OcotilloMenuSelections = {
      tier: selectedTier,
      appetizers: (menuSelections.appetizers || []).slice(0, LIMITS.appetizers),
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
        const ref = doc(db, "users", user.uid, "yumYumData", "ocotilloMenuSelections");
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
      img: `${import.meta.env.BASE_URL}assets/images/YumYum/hors.png`,
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
      img: `${import.meta.env.BASE_URL}assets/images/YumYum/dessert_piglet.png`,
    },
  ];

  return (
    <>
      {/* Header with tier + piglet just like other venues */}
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
                transform: hovered === label ? "scale(1.05)" : "scale(1)",
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

      {/* Modals */}
      {showModal === "appetizers" && (
        <SelectionModal
          title={`Select up to ${LIMITS.appetizers} Appetizers`}
          options={APPETIZERS}
          max={LIMITS.appetizers}
          selected={menuSelections.appetizers}
          onChange={(s) => closeWith("appetizers", s)}
          onClose={() => setShowModal(null)}
        />
      )}

      {showModal === "salads" && (
        <SelectionModal
          title={`Select up to ${LIMITS.salads} Salads`}
          options={SALADS}
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
          options={DESSERTS}
          max={LIMITS.desserts}
          selected={menuSelections.desserts}
          onChange={(s) => closeWith("desserts", s)}
          onClose={() => setShowModal(null)}
        />
      )}
    </>
  );
};

export default OcotilloMenuBuilder;