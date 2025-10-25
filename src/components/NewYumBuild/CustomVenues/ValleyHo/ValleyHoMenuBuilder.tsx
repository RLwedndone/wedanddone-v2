import React, { useEffect, useMemo, useState } from "react";
import SelectionModal from "../../shared/SelectionModal";
import { getAuth } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

/* ---------------- Types ---------------- */
export type ValleyHoService = "plated" | "stations";

export interface ValleyHoSelections {
  // shared
  hors: string[];

  // plated
  salad: string[];
  platedEntrees: string[]; // up to 3

  // stations
  stationA?: "pasta" | "rice";
  stationB?: "sliders" | "tacos";

  // pasta station
  pastaPicks: string[]; // pick 3

  // rice bowl station
  riceBases: string[];    // pick 2 of 4
  riceProteins: string[]; // pick 3 of 6

  // sliders / tacos
  sliderPicks: string[];  // pick 3
  tacoPicks: string[];    // pick 3

  // kids
  kids: {
    needed: boolean;
    count: number;
    picks: string[];
  };
}

interface Props {
  serviceOption: ValleyHoService;
  menuSelections: ValleyHoSelections;
  setMenuSelections: (m: ValleyHoSelections) => void;
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
}

/* ---------------- Assets ---------------- */
const IMG = {
  titlePig: `${import.meta.env.BASE_URL}assets/images/YumYum/piglet1.png`,
  hors: `${import.meta.env.BASE_URL}assets/images/YumYum/hors.png`,
  salad: `${import.meta.env.BASE_URL}assets/images/YumYum/salad.png`,
  entrees: `${import.meta.env.BASE_URL}assets/images/YumYum/Entrees.png`,

  antipasti: `${import.meta.env.BASE_URL}assets/images/YumYum/ValleyHo/antipasti.png`,

  pasta: `${import.meta.env.BASE_URL}assets/images/YumYum/ValleyHo/pasta.png`,
  rice: `${import.meta.env.BASE_URL}assets/images/YumYum/ValleyHo/ricebowls.png`,

  sliders: `${import.meta.env.BASE_URL}assets/images/YumYum/ValleyHo/sliders.png`,
  tacos: `${import.meta.env.BASE_URL}assets/images/YumYum/ValleyHo/tacobar.png`,
};

/* ---------------- Utils ---------------- */
function toFirestoreSafe<T>(obj: T): T {
  // Drops undefined so Firestore won't complain
  return JSON.parse(JSON.stringify(obj));
}

/* ---------------- Data ---------------- */

// Hors (use standard modal; we’ll just prefix with “Cold –/Hot –”)
const HORS_COLD = [
  "Cold – Avocado Bruschetta with Cotija Cheese, Pickled Chili, and Cilantro",
  "Cold – Heirloom Tomato Caprese Tart",
  "Cold – Warm Brie with Apricot Compote Crostini",
  "Cold – Tajin Spiced Watermelon with Feta and Mint",
  "Cold – Tuna Poke Cups with Wonton Shell, Sesame and Togarashi",
  "Cold – Smoked Salmon and Cucumber with Dill Lemon Cream",
  "Cold – Shrimp Ceviche Shooters",
];
const HORS_HOT = [
  "Hot – Green Chili Mac and Cheese Bite",
  "Hot – Truffle and Cheese Potato Croquette",
  "Hot – Veggie Stuffed Mushroom",
  "Hot – Mini Veggie Wellington",
  "Hot – Sundried Tomato and Basil Arancini",
  "Hot – Lobster Arancini",
  "Hot – Chicken Quesadilla Cones",
  "Hot – Chicken and Green Chili Empanadas",
  "Hot – Fiery Peach Bacon Wrapped Brisket",
  "Hot – Mini Beef Wellington with Horseradish Aioli",
  "Hot – Bacon Wrapped Scallop with Sesame Glaze",
];
const HORS_ALL = [...HORS_COLD, ...HORS_HOT];

// Plated — salads (pick 1)
const SALADS = [
  "Mixed Greens, Heirloom Cherry Tomatoes, Radish, and Shaved Carrots with Champagne Vinaigrette",
  "Beefsteak Tomatoes, Fresh Mozzarella, Micro Basil with Balsamic Glaze, EVOO",
  "Roasted Farm Beets, Citrus, Goat Cheese, Spiced Pepitas, Pickled Onions and Arugula with Red Wine Vinaigrette",
  "Baby Greens with Poached Pear, Candied Pecans and Blue Cheese with Balsamic Vinaigrette",
  "Classic Caesar Salad with Shaved Parmesan and Garlic Croutons",
];

// Plated — entrées with prices (we’ll compute max selected price)
type EntreeItem = { label: string; price: number };
const PLATED_ENTREES: EntreeItem[] = [
  { label: "Roasted Free-Range Chicken Breast with Onion Pan Jus", price: 94 },
  { label: "Seared Scottish Salmon with Lemon Butter Sauce", price: 96 },
  { label: "Chef’s Seasonal White Fish with Spicy Romesco Sauce", price: 100 },
  { label: "Slow-Braised Beef Short Ribs with Cabernet Jus", price: 103 },
  { label: "Grilled Filet of Beef with Red Wine Demi-Glace", price: 106 },
  { label: "Chilean Sea Bass with White Miso Ponzu", price: 115 },
];

// Stations — pasta (pick 3)
const PASTA_PICKS = [
  "Cheese Tortellini – Roasted Tomatoes & Spinach, Creamy Pesto Sauce",
  "Carbonara – Smoked Bacon, Cracked Pepper, Parmesan, Peas",
  "Shrimp & Chorizo Orecchiette – Moroccan Cream, Scallion, Cherry Tomatoes",
  "Baked Ziti – Italian Sausage, Chili Flakes, Mozzarella",
  "Three Cheese & Vegetable Mostaccioli – Mushroom, Spinach, Zucchini, Provolone, Mozzarella, Parmesan",
];

// Stations — rice bowl (pick 2 bases, pick 3 proteins)
const RICE_BASES = ["Brown Rice", "Jasmine Rice", "Local Field Greens", "Cauliflower Rice"];
const RICE_PROTEINS = [
  "Korean BBQ Beef",
  "Southern Fried Chicken",
  "Grilled Salmon",
  "Sweet Chili Tofu",
  "Togarashi Dusted Shrimp",
  "Roasted Mushrooms",
];

// Stations — sliders (pick 3)
const SLIDERS = [
  "Angus Beef Sliders with Cheddar, Pickle Chips, Chipotle Ketchup",
  "Fried Chicken Sliders with Pickled Vegetables, Togarashi Aioli",
  "BBQ Pork Sliders with Dill Pickle, Tangy Coleslaw",
  "Turkey Sliders with Provolone, Bacon Aioli, Cured Tomatoes",
  "Vegetarian Black Bean with Red Pepper and Hummus",
];

// Stations — tacos (pick 3)
const TACOS = [
  "Marinated Shredded Chicken",
  "Pulled Pork Carnitas",
  "Chili Lime Shrimp",
  "Seasonal White Fish",
  "Citrus Marinated Carne Asada",
];

// Kids' Menu — options shown in one modal (pick 2 total)
const KIDS_OPTIONS = [
  // Starters
  "Starter — Caesar Salad with Shaved Parmesan and Garlic Croutons",
  "Starter — Romaine, Heirloom Cherry Tomatoes, and Cucumber with House-Made Ranch Dressing",
  "Starter — Fresh Fruit Cup",

  // Entrées
  "Entrée — Mac and Cheese",
  "Entrée — Grilled Chicken Breast with Fresh Steamed Vegetables",
  "Entrée — Chicken Tenders with French Fries",
  "Entrée — Spaghetti and Meatballs",
];

const subtleNote: React.CSSProperties = {
  fontSize: ".95rem",
  opacity: 0.75,
  marginTop: 4,
};

/* ---------------- Styles ---------------- */
const js: React.CSSProperties = {
  fontFamily: "'Jenna Sue', cursive",
  color: "#2c62ba",
  lineHeight: 1.15,
};
const line: React.CSSProperties = {
  ...js,
  fontSize: "1.8rem",
  marginTop: 6,
  cursor: "pointer",
};

/* ---------------- Component ---------------- */
const ValleyHoMenuBuilder: React.FC<Props> = ({
  serviceOption,
  menuSelections,
  setMenuSelections,
  onContinue,
  onBack,
  onClose,
}) => {
  const [show, setShow] = useState<
    | null
    | "hors"
    | "salad"
    | "entrees"
    | "pasta"
    | "riceBases"
    | "riceProteins"
    | "sliders"
    | "tacos"
    | "kids"
  >(null);

  // ---- persist helper ----
  const persist = (next: ValleyHoSelections) => {
    const safe = toFirestoreSafe(next);
    try {
      localStorage.setItem("yumStep", "valleyHoMenu");
      localStorage.setItem("valleyHoMenuSelections", JSON.stringify(safe));
    } catch {}
    const u = getAuth().currentUser;
    if (!u) return;
    setDoc(doc(db, "users", u.uid, "yumYumData", "valleyHoMenuSelections"), safe, {
      merge: true,
    }).catch(() => {});
    setDoc(
      doc(db, "users", u.uid),
      { progress: { yumYum: { step: "valleyHoMenu" } } },
      { merge: true }
    ).catch(() => {});
  };

  // local set + persist
  const update = (next: ValleyHoSelections) => {
    setMenuSelections(next);
    persist(next);
  };

  // Clamp rules whenever service changes
  useEffect(() => {
    const next: ValleyHoSelections = {
      hors: (menuSelections.hors || []).slice(0, 2),

      salad: (menuSelections.salad || []).slice(0, 1),
      platedEntrees: (menuSelections.platedEntrees || []).slice(0, 3),

      ...(menuSelections.stationA ? { stationA: menuSelections.stationA } : {}),
      ...(menuSelections.stationB ? { stationB: menuSelections.stationB } : {}),

      pastaPicks: (menuSelections.pastaPicks || []).slice(0, 3),
      riceBases: (menuSelections.riceBases || []).slice(0, 2),
      riceProteins: (menuSelections.riceProteins || []).slice(0, 3),

      sliderPicks: (menuSelections.sliderPicks || []).slice(0, 3),
      tacoPicks: (menuSelections.tacoPicks || []).slice(0, 3),

      // kids present & normalized
      kids: {
        needed: !!menuSelections.kids?.needed,
        count: Math.max(0, Number(menuSelections.kids?.count || 0)),
        picks: Array.isArray(menuSelections.kids?.picks)
          ? menuSelections.kids.picks.slice(0, KIDS_OPTIONS.length)
          : [],
      },
    };
    setMenuSelections(next);
    persist(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceOption]);

  // Per-guest price (for cart later)
  const perGuest = useMemo(() => {
    if (serviceOption === "stations") return 119;
    const priceByLabel = new Map(PLATED_ENTREES.map((e) => [e.label, e.price]));
    let max = 0;
    for (const lbl of menuSelections.platedEntrees || []) {
      max = Math.max(max, priceByLabel.get(lbl) || 0);
    }
    return max || 0;
  }, [serviceOption, menuSelections.platedEntrees]);

  useEffect(() => {
    // If Rice is chosen and bases are picked but proteins are empty, prompt proteins.
    if (
      serviceOption === "stations" &&
      menuSelections.stationA === "rice" &&
      (menuSelections.riceBases?.length || 0) > 0 &&
      (menuSelections.riceProteins?.length || 0) === 0 &&
      show === null
    ) {
      setShow("riceProteins");
    }
  }, [serviceOption, menuSelections.stationA, menuSelections.riceBases, menuSelections.riceProteins, show]);

  // Persist per-guest for downstream math
  useEffect(() => {
    try {
      localStorage.setItem("valleyHoPerGuest", String(perGuest || 0));
      localStorage.setItem("valleyHoService", serviceOption);
    } catch {}
  }, [perGuest, serviceOption]);

  // Row picker
  const pickRow = (slot: "A" | "B", choice: "pasta" | "rice" | "sliders" | "tacos") => {
    const next: ValleyHoSelections = { ...menuSelections };

    if (slot === "A") {
      if (choice !== "pasta" && choice !== "rice") return;
      next.stationA = choice;
      if (choice === "pasta") {
        next.riceBases = [];
        next.riceProteins = [];
      } else {
        next.pastaPicks = [];
      }
    } else {
      if (choice !== "sliders" && choice !== "tacos") return;
      next.stationB = choice;
      if (choice === "sliders") next.tacoPicks = [];
      else next.sliderPicks = [];
    }

    update(next);
  };

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 720 }}>
      {/* 🩷 Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <img
          src={IMG.titlePig}
          alt="Piglet Chef"
          className="px-media"
          style={{ width: 140, margin: "6px auto 16px" }}
        />

        <h2 className="px-title-lg" style={{ marginBottom: 6 }}>
          {serviceOption === "plated" ? "Your Plated Menu" : "Your Reception Stations"}
        </h2>

        {serviceOption === "stations" && (
          <div style={{ ...js, fontSize: "1.6rem", color: "#2c62ba", marginBottom: 14 }}>
            $119 per guest
          </div>
        )}

        <div className="px-prose-narrow" style={{ color: "#555", marginBottom: 16 }}>
          Select the courses below to make your menu!
        </div>

        {/* Hors (shared) */}
        <div style={{ marginBottom: 18 }}>
          <img
            src={IMG.hors}
            alt="Hand-Passed Hors d’oeuvres"
            onClick={() => setShow("hors")}
            style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
          />
          {(menuSelections.hors || []).map((x) => (
            <div key={x} style={line} onClick={() => setShow("hors")}>
              {x}
            </div>
          ))}
        </div>

        {serviceOption === "plated" ? (
          <>
            {/* Salad */}
            <div style={{ marginBottom: 18 }}>
              <img
                src={IMG.salad}
                alt="Salad"
                onClick={() => setShow("salad")}
                style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
              />
              {(menuSelections.salad || []).map((x) => (
                <div key={x} style={line} onClick={() => setShow("salad")}>
                  {x}
                </div>
              ))}
            </div>

            {/* Entrées */}
            <div style={{ marginBottom: 8 }}>
              <img
                src={IMG.entrees}
                alt="Entrées"
                onClick={() => setShow("entrees")}
                style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
              />
              {(menuSelections.platedEntrees || []).map((x) => (
                <div key={x} style={line} onClick={() => setShow("entrees")}>
                  {x}
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            {/* Antipasti included */}
            <div style={{ marginBottom: 18, textAlign: "center" }}>
              <img
                src={IMG.antipasti}
                alt="Antipasti Station (included)"
                style={{ width: 280, display: "block", margin: "0 auto 6px" }}
              />
              <div style={{ ...js, fontSize: "2.0rem", color: "#2c62ba", marginBottom: 6 }}>
                <strong>Included:</strong>
              </div>
              <div
                style={{
                  ...js,
                  fontSize: "1.8rem",
                  lineHeight: 1.4,
                  color: "#2c62ba",
                  maxWidth: 480,
                  margin: "0 auto",
                }}
              >
                Artisan Cured Meats • Imported & Domestic Cheeses • Grilled & Marinated Vegetables •
                Roasted Red Peppers • Olives • Housemade Crostini • Crackers • Mustards • Dips •
                Seasonal Fruits • Nuts • Pickled Garnishes
              </div>
            </div>

            {/* Row A — Pasta OR Rice Bowl */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 40px 1fr",
                alignItems: "center",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <img
                src={IMG.pasta}
                alt="Pasta Station"
                onClick={() => {
                  pickRow("A", "pasta");
                  setShow("pasta");
                }}
                style={{
                  width: "100%",
                  maxWidth: 280,
                  margin: "0 auto",
                  borderRadius: 12,
                  cursor: "pointer",
                  filter:
                    menuSelections.stationA && menuSelections.stationA !== "pasta"
                      ? "grayscale(100%) opacity(0.6)"
                      : "none",
                }}
              />
              <div style={{ ...js, fontSize: "2.8rem", color: "#2c62ba", textAlign: "center", lineHeight: 1 }}>
                or
              </div>
              <img
                src={IMG.rice}
                alt="Rice Bowl Station"
                onClick={() => {
                  pickRow("A", "rice");
                  setShow("riceBases"); // start with Bases modal
                }}
                style={{
                  width: "100%",
                  maxWidth: 280,
                  margin: "0 auto",
                  borderRadius: 12,
                  cursor: "pointer",
                  filter:
                    menuSelections.stationA && menuSelections.stationA !== "rice"
                      ? "grayscale(100%) opacity(0.6)"
                      : "none",
                }}
              />
            </div>

            {/* Selections under chosen tile */}
            {menuSelections.stationA === "pasta" ? (
              <div style={{ marginBottom: 14 }}>
                {(menuSelections.pastaPicks || []).map((x) => (
                  <div key={x} style={line} onClick={() => setShow("pasta")}>
                    {x}
                  </div>
                ))}
              </div>
            ) : menuSelections.stationA === "rice" ? (
              <div style={{ marginBottom: 14 }}>
                {(menuSelections.riceBases || []).map((x) => (
                  <div key={`base-${x}`} style={line} onClick={() => setShow("riceBases")}>
                    {x}
                  </div>
                ))}
                {(menuSelections.riceProteins || []).map((x) => (
                  <div key={`prot-${x}`} style={line} onClick={() => setShow("riceProteins")}>
                    {x}
                  </div>
                ))}
              </div>
            ) : null}

            {/* Row B — Sliders OR Tacos */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 40px 1fr",
                alignItems: "center",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <img
                src={IMG.sliders}
                alt="Slider Station"
                onClick={() => {
                  pickRow("B", "sliders");
                  setShow("sliders");
                }}
                style={{
                  width: "100%",
                  maxWidth: 280,
                  margin: "0 auto",
                  borderRadius: 12,
                  cursor: "pointer",
                  filter:
                    menuSelections.stationB && menuSelections.stationB !== "sliders"
                      ? "grayscale(100%) opacity(0.6)"
                      : "none",
                }}
              />
              <div style={{ ...js, fontSize: "2.8rem", color: "#2c62ba", textAlign: "center", lineHeight: 1 }}>
                or
              </div>
              <img
                src={IMG.tacos}
                alt="Street Taco Station"
                onClick={() => {
                  pickRow("B", "tacos");
                  setShow("tacos");
                }}
                style={{
                  width: "100%",
                  maxWidth: 280,
                  margin: "0 auto",
                  borderRadius: 12,
                  cursor: "pointer",
                  filter:
                    menuSelections.stationB && menuSelections.stationB !== "tacos"
                      ? "grayscale(100%) opacity(0.6)"
                      : "none",
                }}
              />
            </div>

            {menuSelections.stationB === "sliders" ? (
              <div style={{ marginBottom: 6 }}>
                {(menuSelections.sliderPicks || []).map((x) => (
                  <div key={x} style={line} onClick={() => setShow("sliders")}>
                    {x}
                  </div>
                ))}
              </div>
            ) : menuSelections.stationB === "tacos" ? (
              <div style={{ marginBottom: 6 }}>
                {(menuSelections.tacoPicks || []).map((x) => (
                  <div key={x} style={line} onClick={() => setShow("tacos")}>
                    {x}
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}

        {/* 🧒 Kids’ Menu (picks only — quantity handled in Cart) */}
<div style={{ marginTop: 18, marginBottom: 4, textAlign: "center" }}>
  <div style={{ ...js, fontSize: "1.6rem" }}>Kids’ Menu (optional)</div>

  {/* Open modal to make kids menu selections */}
  <button
    className="boutique-back-btn"
    style={{ width: 220, marginTop: 8 }}
    onClick={() => setShow("kids")}
  >
    Choose Kids’ Menu
  </button>

  {/* Summary when user has selected items */}
  {menuSelections.kids?.picks?.length > 0 && (
    <div className="px-prose-narrow" style={{ marginTop: 8, opacity: 0.85 }}>
      {menuSelections.kids.picks.join(", ")}
    </div>
  )}

  {/* Helper note */}
  <div className="px-prose-narrow" style={{ marginTop: 6, opacity: 0.6 }}>
    You’ll enter how many kids’ meals you need on the next screen.
  </div>
</div>

        {/* CTAs */}
        <div className="px-cta-col" style={{ marginTop: 14 }}>
          <button className="boutique-primary-btn" onClick={onContinue} style={{ width: 260 }}>
            Continue
          </button>
          <button className="boutique-back-btn" onClick={onBack} style={{ width: 260 }}>
            ⬅ Back
          </button>
        </div>
      </div>

      {/* ───────── Modals (standard SelectionModal) ───────── */}
      {show === "hors" && (
        <SelectionModal
          title="Hand-Passed Hors d’oeuvres — select up to 2"
          options={HORS_ALL}
          max={2}
          selected={menuSelections.hors}
          onChange={(sel) => {
            update({ ...menuSelections, hors: sel.slice(0, 2) });
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {/* Plated only */}
      {serviceOption === "plated" && show === "salad" && (
        <SelectionModal
          title="Salad — select 1"
          options={SALADS}
          max={1}
          selected={menuSelections.salad}
          onChange={(sel) => {
            update({ ...menuSelections, salad: sel.slice(0, 1) });
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {serviceOption === "plated" && show === "entrees" && (
        <SelectionModal
          title={`Entrées — select up to 3 • Your price = highest entrée selected ($${perGuest || 0}/guest)`}
          options={PLATED_ENTREES.map((e) => `${e.label} | $${e.price} per guest`)}
          max={3}
          selected={menuSelections.platedEntrees}
          onChange={(sel) => {
            const cleaned = sel.map((s) => {
              const idx = s.indexOf(" | $");
              return idx > -1 ? s.slice(0, idx) : s;
            });
            update({ ...menuSelections, platedEntrees: cleaned.slice(0, 3) });
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {/* Stations modals */}
      {serviceOption === "stations" && show === "pasta" && (
        <SelectionModal
          title="Pasta Station — select 3"
          options={PASTA_PICKS}
          max={3}
          selected={menuSelections.pastaPicks}
          onChange={(sel) => {
            update({ ...menuSelections, pastaPicks: sel.slice(0, 3) });
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {serviceOption === "stations" && show === "riceBases" && (
        <SelectionModal
          title="Rice Bowl Station — Bases (select 2)"
          options={RICE_BASES}
          max={2}
          selected={menuSelections.riceBases}
          onChange={(sel) => {
            update({ ...menuSelections, riceBases: sel.slice(0, 2) });
            // Defer next modal so the current can unmount cleanly
            setTimeout(() => setShow("riceProteins"), 0);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {serviceOption === "stations" && show === "riceProteins" && (
        <SelectionModal
          title="Rice Bowl Station — Proteins (select 3)"
          options={RICE_PROTEINS}
          max={3}
          selected={menuSelections.riceProteins}
          onChange={(sel) => {
            update({ ...menuSelections, riceProteins: sel.slice(0, 3) });
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {serviceOption === "stations" && show === "sliders" && (
        <SelectionModal
          title="Slider Station — select 3"
          options={SLIDERS}
          max={3}
          selected={menuSelections.sliderPicks}
          onChange={(sel) => {
            update({ ...menuSelections, sliderPicks: sel.slice(0, 3) });
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {serviceOption === "stations" && show === "tacos" && (
        <SelectionModal
          title="Street Taco Station — select 3"
          options={TACOS}
          max={3}
          selected={menuSelections.tacoPicks}
          onChange={(sel) => {
            update({ ...menuSelections, tacoPicks: sel.slice(0, 3) });
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {/* Kids modal */}
      {show === "kids" && (
  <SelectionModal
    title="Kids’ Menu — pick 2 (1 starter + 1 entrée)"
    options={KIDS_OPTIONS}
    max={2}
    selected={menuSelections.kids?.picks || []}
    onChange={(sel) => {
      const picks = sel.slice(0, 2);
      update({
        ...menuSelections,
        kids: {
          // keep whatever count is there (cart will set it later)
          count: menuSelections.kids?.count ?? 0,
          // mark needed if they’ve chosen anything
          needed: picks.length > 0,
          picks,
        },
      });
      setShow(null);
    }}
    onClose={() => setShow(null)}
  />
)}
    </div>
  );
};

export default ValleyHoMenuBuilder;