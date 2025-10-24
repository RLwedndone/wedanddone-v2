import React, { useEffect, useState } from "react";
import SelectionModal from "../../shared/SelectionModal";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

type Tier = "sunflower" | "rose" | "lily" | "dahlia";

export interface VicVerradoMenuSelections {
  tier: Tier;
  hors: string[];       // 0–3 depending on tier
  salads: string[];     // always 1
  entrees: string[];    // 1/1/2/3 per tier
  starch: string[];     // 1
  veg: string[];        // 1
}

interface Props {
  selectedTier: Tier; // comes from FlowerTierSelector
  menuSelections: VicVerradoMenuSelections;
  setMenuSelections: (s: VicVerradoMenuSelections) => void;
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
}

/* ───────────────────────── Menus ───────────────────────── */

const HORS = [
  // Hot
  "Herb Cheese-Stuffed Artichoke",
  "Portobello Arancini",
  "Raspberry Brie Phyllo Star",
  "Fig & Goat Cheese Flatbread",
  "Steak Fajita Tortilla Crisp",
  "Teriyaki Beef Skewers",
  "Coconut Shrimp Skewers",
  "Chicken Kabob w/ Peppers & Onions",
  "Bacon-Wrapped Scallops",
  "Spanakopita",

  // Platters
  "Gourmet Cheese Platter",
  "Charcuterie Board",
  "Spinach Artichoke Dip",
  "Fruit Platter",
  "Bruschetta Board",

  // Cold
  "Sonoran Chicken Pinwheels",
  "Southwest Beef on Blue Corn Cake",
  "Mini Antipasto Skewers",
  "Smoked Salmon on Pumpernickel",
  "Shrimp & Avocado Phyllo Cup",
  "Apple Brie on Toasted Brioche",
  "Vegetable Rice Paper Roll",
  "Pesto Chicken & Sweet Pepper Cup",
  "Prosciutto Goat Cheese Date Skewer",
  "Roast Beef Roulade on Marble Rye",
];

// Salads WITH descriptions (title – description)
const SALADS: string[] = [
  "Mixed Greens – Mesclun mix, carrots, red onion, tomatoes, croutons, ranch dressing",
  "Caesar – Chopped romaine, grated parmesan, croutons, Caesar dressing",
  "Spinach – Baby spinach, red onion, boiled egg, bacon, candied pecans, shallot vinaigrette",
  "Roasted Squash Salad – Arugula & spinach, walnuts, blue cheese, bourbon vinaigrette",
  "Wild Arugula – Maytag blue cheese, diced apple, candied walnuts, raspberry dressing",
  "Butter Lettuce – Orange supremes, roasted pecans, fontina, sherry vinaigrette",
  "The Wedge – Iceberg, bacon, tomato, cucumber, blue cheese crumbles, blue cheese dressing",
  "Caprese Salad – Fresh mozzarella, sliced roma tomatoes, basil strips, balsamic drizzle",
  "Baby Spinach – Tillamook aged white cheddar, crispy guanciale, candied pecans, smoked tomato dressing",
  "Strawberry Fields – Arugula, macadamia nuts, bruléed goat cheese crouton, strawberry vinaigrette",
  "Apple Salad – Spring mix, apple chips, pecans, goat cheese, white balsamic",
  "Southwest Salad – Romaine, roasted corn & black bean, tomato, tortilla strips, chipotle ranch",
];

const STARCHES = [
  "Creamy Boursin Polenta (GF)",
  "Smoked Cheddar Grits (GF)",
  "Citrus Scented Quinoa (GF)",
  "Creamy Herbed Risotto (GF)",
  "Rice Pilaf (GF)",
  "Wild Rice Pilaf (GF)",
  "Roasted Garlic Mashed Potatoes (GF)",
  "Gruyere Au Gratin Potatoes (GF)",
  "Roasted Red Potatoes (GF)",
  "Saffron Orzo with Black Beans",
  "Smashed Yukon Potatoes (GF)",
  "Roasted Fingerlings (GF)",
];

const VEGETABLES = [
  "Honey Glazed Baby Carrots",
  "Matchstick Vegetables",
  "Roasted Squash Medley",
  "Baby Zucchini & Patty Pans",
  "Garlic Sautéed Haricot Verts",
  "Bacon & Caramelized Onion Brussel Sprouts",
  "Roasted Cauliflower with Red Pepper",
  "Butter-Braised Broccolini",
  "Bacon Apple Braised Collard Greens",
];

/* Entrées differ by tier */
const ENTREES_BY_TIER: Record<Tier, string[]> = {
  sunflower: [
    "Chicken Marsala – Wild Mushroom Demi-Sauce",
    "Chicken Piccata – Lemon Caper Cream",
    "Oven Roasted Chicken – Herb Pan Jus (GF)",
    "Chicken Parmesan – Marinara & Mozzarella",
    "Grilled Cauliflower Steak – Herb Chimichurri (GF)",
  ],
  rose: [
    "Chicken Marsala – Wild Mushroom Demi-Sauce",
    "Chicken Piccata – Lemon Caper Cream",
    "Oven Roasted Chicken – Herb Pan Jus (GF)",
    "Chicken Parmesan – Marinara & Mozzarella",
    "Grilled Cauliflower Steak – Herb Chimichurri (GF)",
    "Grilled Sirloin – Rosemary Demi (GF)",
    "Herb-Crusted Salmon – Lemon Beurre Blanc",
    "Center-Cut Pork Chop – Roasted Apple Chutney (GF)",
    "Prime Rib – Au Jus & Horseradish (GF)",
    "Chicken Saltimbocca – Sage Pan Jus (GF)",
  ],
  lily: [
    "Chicken Marsala – Wild Mushroom Demi-Sauce",
    "Chicken Piccata – Lemon Caper Cream",
    "Oven Roasted Chicken – Herb Pan Jus (GF)",
    "Chicken Parmesan – Marinara & Mozzarella",
    "Grilled Cauliflower Steak – Herb Chimichurri (GF)",
    "Grilled Sirloin – Rosemary Demi (GF)",
    "Herb-Crusted Salmon – Lemon Beurre Blanc",
    "Center-Cut Pork Chop – Roasted Apple Chutney (GF)",
    "Prime Rib – Au Jus & Horseradish (GF)",
    "Chicken Saltimbocca – Sage Pan Jus (GF)",
    "Grilled Swordfish – Orange Chipotle Glaze (GF)",
    "Grilled Mahi Mahi – Olive Caper Relish (GF)",
    "Grilled Ribeye – Herb Butter (GF)",
    "Braised Short Rib (GF)",
    "Chicken Cordon Bleu – Mustard Demi",
  ],
  dahlia: [
    "Chicken Marsala – Wild Mushroom Demi-Sauce",
    "Chicken Piccata – Lemon Caper Cream",
    "Oven Roasted Chicken – Herb Pan Jus (GF)",
    "Chicken Parmesan – Marinara & Mozzarella",
    "Grilled Cauliflower Steak – Herb Chimichurri (GF)",
    "Grilled Sirloin – Rosemary Demi (GF)",
    "Herb-Crusted Salmon – Lemon Beurre Blanc",
    "Center-Cut Pork Chop – Roasted Apple Chutney (GF)",
    "Prime Rib – Au Jus & Horseradish (GF)",
    "Chicken Saltimbocca – Sage Pan Jus (GF)",
    "Grilled Swordfish – Orange Chipotle Glaze (GF)",
    "Grilled Mahi Mahi – Olive Caper Relish (GF)",
    "Grilled Ribeye – Herb Butter (GF)",
    "Braised Short Rib (GF)",
    "Chicken Cordon Bleu – Mustard Demi",
    "Alaskan Halibut – Tarragon Beurre Blanc (GF)",
    "Surf & Turf – Demi-Glace & Herb Butter (GF)",
    "Filet Mignon – Caramelized Onion Demi (GF)",
    "Chilean Sea Bass – Mango Pineapple Salsa (GF)",
    "Pork T-Bone – Grilled Apple Purée (GF)",
  ],
};

/* Pick limits by tier */
const LIMITS: Record<Tier, { hors: number; salads: number; entrees: number; starch: number; veg: number }> = {
  sunflower: { hors: 0, salads: 1, entrees: 1, starch: 1, veg: 1 },
  rose:      { hors: 1, salads: 1, entrees: 1, starch: 1, veg: 1 },
  lily:      { hors: 2, salads: 1, entrees: 2, starch: 1, veg: 1 },
  dahlia:    { hors: 3, salads: 1, entrees: 3, starch: 1, veg: 1 },
};

const TIER_LABEL: Record<Tier, string> = {
  sunflower: "Sunflower • $69 per guest",
  rose: "Rose • $79 per guest",
  lily: "Lily • $89 per guest",
  dahlia: "Dahlia • $99 per guest", // updated
};

const VicVerradoMenuBuilderCatering: React.FC<Props> = ({
  selectedTier,
  menuSelections,
  setMenuSelections,
  onContinue,
  onBack,
  onClose,
}) => {
  const [showModal, setShowModal] = useState<null | "hors" | "salads" | "entrees" | "starch" | "veg">(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Initialize tier + restore selections if present
  useEffect(() => {
    // If incoming state has a different tier, reset counts but preserve where possible
    const next: VicVerradoMenuSelections = {
      tier: selectedTier,
      hors: (menuSelections.hors || []).slice(0, LIMITS[selectedTier].hors),
      salads: (menuSelections.salads || []).slice(0, 1),
      entrees: (menuSelections.entrees || []).slice(0, LIMITS[selectedTier].entrees),
      starch: (menuSelections.starch || []).slice(0, 1),
      veg: (menuSelections.veg || []).slice(0, 1),
    };
    setMenuSelections(next);
    persist(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTier]);

  // First time load: Firestore → localStorage fallback
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      if (!user) {
        // guest → local only
        const local = localStorage.getItem("vicVerradoMenuSelections");
        if (local) {
          try {
            const parsed = JSON.parse(local) as VicVerradoMenuSelections;
            setMenuSelections(parsed);
          } catch {}
        }
        return;
      }

      try {
        const ref = doc(db, "users", user.uid, "yumYumData", "vicVerradoMenuSelections");
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const saved = snap.data() as VicVerradoMenuSelections;
          setMenuSelections(saved);
        } else {
          // seed with tier
          const seeded: VicVerradoMenuSelections = {
            tier: selectedTier,
            hors: [],
            salads: [],
            entrees: [],
            starch: [],
            veg: [],
          };
          setMenuSelections(seeded);
          persist(seeded);
        }
      } catch (e) {
        console.error("❌ Error fetching Vic/Verrado selections:", e);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = (next: VicVerradoMenuSelections) => {
    localStorage.setItem("vicVerradoMenuSelections", JSON.stringify(next));
    localStorage.setItem("yumStep", "vicVerradoMenu");

    onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      try {
        await setDoc(
          doc(db, "users", user.uid, "yumYumData", "vicVerradoMenuSelections"),
          next,
          { merge: true }
        );
        await setDoc(
          doc(db, "users", user.uid),
          { progress: { yumYum: { step: "vicVerradoMenu" } } },
          { merge: true }
        );
      } catch (e) {
        console.error("❌ Error saving Vic/Verrado selections:", e);
      }
    });
  };

  const limits = LIMITS[menuSelections.tier || selectedTier];
  const entreesList = ENTREES_BY_TIER[menuSelections.tier || selectedTier];

  const picked = (k: keyof VicVerradoMenuSelections) =>
    (menuSelections[k] as string[]) || [];

  const open = (k: typeof showModal) => setShowModal(k);

  const closeWith = (k: Exclude<typeof showModal, null>, selections: string[]) => {
    const next: VicVerradoMenuSelections = { ...menuSelections };

    switch (k) {
      case "hors":
        next.hors = selections.slice(0, limits.hors);
        break;
      case "salads":
        next.salads = selections.slice(0, 1);
        break;
      case "entrees":
        next.entrees = selections.slice(0, limits.entrees);
        break;
      case "starch":
        next.starch = selections.slice(0, 1);
        break;
      case "veg":
        next.veg = selections.slice(0, 1);
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
    { key: "hors", label: "Hors d’oeuvres", img: "/assets/images/YumYum/hors.png", show: limits.hors > 0 },
    { key: "salads", label: "Salads", img: "/assets/images/YumYum/salad.png", show: true },
    { key: "entrees", label: "Entrées", img: "/assets/images/YumYum/Entrees.png", show: true },
    { key: "starch", label: "Starch", img: "/assets/images/YumYum/starch.png", show: true },
    { key: "veg", label: "Vegetable", img: "/assets/images/YumYum/Veggie.png", show: true },
  ];

  return (
    <>
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
        src="/assets/images/YumYum/piglet1.png"
        alt="Piglet Chef"
        style={{ width: "160px", margin: "0 auto 30px", display: "block" }}
      />

      {sections.filter(s => s.show).map(({ key, label, img }) => {
        const sel = picked(key as keyof VicVerradoMenuSelections);
        return (
          <div key={key} style={{ textAlign: "center", marginBottom: "2rem" }}>
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

      <div style={{ marginTop: "1rem" }}>
        <button
          className="boutique-primary-btn"
          onClick={() => {
            localStorage.setItem("yumStep", "vicVerradoCart");
            onContinue();
          }}
        >
          Continue
        </button>
        <button className="boutique-back-btn" onClick={onBack} style={{ marginTop: "1rem" }}>
          Back
        </button>
      </div>

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
          title={`Select ${limits.entrees} Entrée${limits.entrees > 1 ? "s" : ""}`}
          options={entreesList}
          max={limits.entrees}
          selected={menuSelections.entrees}
          onChange={(s) => closeWith("entrees", s)}
          onClose={() => setShowModal(null)}
        />
      )}

      {showModal === "starch" && (
        <SelectionModal
          title="Select 1 Starch"
          options={STARCHES}
          max={1}
          selected={menuSelections.starch}
          onChange={(s) => closeWith("starch", s)}
          onClose={() => setShowModal(null)}
        />
      )}

      {showModal === "veg" && (
        <SelectionModal
          title="Select 1 Vegetable"
          options={VEGETABLES}
          max={1}
          selected={menuSelections.veg}
          onChange={(s) => closeWith("veg", s)}
          onClose={() => setShowModal(null)}
        />
      )}
    </>
  );
};

export default VicVerradoMenuBuilderCatering;