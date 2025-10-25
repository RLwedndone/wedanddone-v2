// src/components/NewYumBuild/CustomVenues/Schnepf/SchnepfMenuBuilderCatering.tsx
import React, { useEffect, useMemo, useState } from "react";
import SelectionModal from "../../shared/SelectionModal";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import type { CuisineId } from "./SchnepfCuisineSelector";
import { getGuestState } from "../../../../utils/guestCountStore";

/* =========================
   Types
========================= */
export type PricingMode = "single" | "combo";

export interface SchnepfMenuSelections {
  salads: string[];
  entrees: string[];
  sides: string[];
}

type ChefFeeRule = { min: number; max?: number; chefs: number; fee: number };

type EntreeSingle = {
  kind: "single";
  id: string;
  label: string;
  price: number; // per person
};

type Entree = EntreeSingle;

interface CuisineData {
  name: string;
  entrees: Entree[];
  salads: string[];
  sides: string[];
  chefFee?: number;             // flat
  chefFeeRules?: ChefFeeRule[]; // tiered
  chefFeeNote?: string;
}

/* =========================
   DATA — single source of truth
========================= */
const C: Record<CuisineId, CuisineData> = {
  bbq: {
    name: "BBQ Dinner",
    entrees: [
      { kind: "single", id: "bbq-pork", label: "BBQ Pulled Pork Sliders", price: 26.5 },
      { kind: "single", id: "bbq-chicken", label: "Grilled Peach Chipotle Chicken (GF)", price: 30.5 },
      { kind: "single", id: "bbq-combo", label: "Pulled Pork Slider & Grilled Peach Chipotle Chicken", price: 34.75 },
    ],
    salads: ["House Salad with Tomatoes, Craisins, Feta, Croutons & Peppercorn Dressing"],
    sides: [
      "Mac N Cheese (V)",
      "Kettle Baked Beans (V, GF)",
      "Coleslaw (V, GF)",
      "Roasted Garden Fresh Seasonal Veggies (V, VG, GF)",
    ],
  },

  taco_bar: {
    name: "Taco Bar",
    entrees: [
      { kind: "single", id: "taco-both", label: "Chicken & Steak Street Tacos (corn or flour tortillas)", price: 26.5 },
    ],
    salads: ["House Salad with Tomatoes, Craisins, Feta, Croutons & Peppercorn Dressing"],
    sides: [
      "Tortilla Chips with Schnepf Farms' Salsas (V, VG, GF)",
      "Spanish Rice (V, VG, GF) OR Cilantro Lime White Rice (V, VG, GF)",
      "Ranch Style Black Beans (V, VG, GF)",
      "Cheese Quesadillas (V)",
    ],
    chefFee: 200,
    chefFeeNote: "A $200 chef fee applies to the Taco Bar.",
  },

  rustic_italian: {
    name: "Rustic Italian",
    entrees: [
      { kind: "single", id: "ri-chicken-herb",  label: "Grilled Italian Herb Chicken Breast (GF)", price: 30.5 },
      { kind: "single", id: "ri-chicken-parm",  label: "Chicken Parmigiana",                       price: 32.5 },
      { kind: "single", id: "ri-pork-marinara", label: "Roasted Pork Tenderloin in Marinara (GF)", price: 33.75 },
      { kind: "single", id: "ri-combo-chicken-parm", label: "Grilled Italian Herb Chicken Breast & Chicken Parmigiana", price: 40.0 },
      { kind: "single", id: "ri-combo-pork-chicken", label: "Roasted Pork Tenderloin in Marinara & Grilled Italian Herb Chicken Breast", price: 40.0 },
      { kind: "single", id: "ri-combo-pork-parm",    label: "Roasted Pork Tenderloin in Marinara & Chicken Parmigiana", price: 40.0 },
    ],
    salads: [
      "Garden Fresh House Salad w/ Tomatoes, Craisins, Feta Cheese, Croutons, and Schnepf Farms Vidalia Onion Peppercorn Dressing",
      "Caesar Salad",
    ],
    sides: [
      "Mac N Cheese (V)",
      "Garlic Mashed Potatoes (V, GF)",
      "Baked Penne Pasta with Seasonal Veggies, Mozzarella & Marinara (V)",
      "Roasted Garden Fresh Seasonal Veggies (V, VG, GF)",
    ],
  },

  classic_chicken: {
    name: "Classic Chicken Dinner",
    entrees: [
      { kind: "single", id: "cc-lemon",   label: "Grilled Chicken with Lemon Rosemary Herb Sauce (GF)", price: 30.5 },
      { kind: "single", id: "cc-mushroom", label: "Grilled Chicken with Mushroom Cream Sauce (GF)",      price: 30.5 },
    ],
    salads: [
      "Garden Fresh House Salad w/ Tomatoes, Craisins, Feta Cheese, Croutons, and Schnepf Farms Vidalia Onion Peppercorn Dressing",
      "Caesar Salad",
    ],
    sides: [
      "Mac N Cheese (V)",
      "Garlic Mashed Potatoes (V, GF)",
      "Baked Penne Pasta with Seasonal Veggies, Mozzarella & Marinara (V)",
      "Roasted Garden Fresh Seasonal Veggies (V, VG, GF)",
    ],
  },

  live_pasta: {
    name: "Live Action Pasta Bar",
    entrees: [
      { kind: "single", id: "pasta-penne-station", label: "Penne Pasta with Chicken & Sausage • Marinara / Alfredo / Pesto", price: 31.5 },
    ],
    salads: [
      "Garden Fresh House Salad w/ Tomatoes, Craisins, Feta Cheese, Croutons, and Schnepf Farms Vidalia Onion Peppercorn Dressing",
      "Caesar Salad",
    ],
    sides: [],
    chefFeeRules: [
      { min: 0,   max: 149, chefs: 2, fee: 200 },
      { min: 150,            chefs: 4, fee: 400 },
    ],
    chefFeeNote: "Chef fee scales with guest count: up to 149 guests require 2 chefs; 150+ guests require 4 chefs.",
  },

  wood_fired_pizza: {
    name: "Wood Fired Pizza Bar",
    entrees: [
      { kind: "single", id: "pizza-margherita", label: "French Thin Crust Margherita Pizza (V)", price: 29.5 },
      { kind: "single", id: "pizza-pepperoni",  label: "French Thin Crust Pepperoni Pizza",       price: 29.5 },
      { kind: "single", id: "pizza-veggie",     label: "French Thin Crust Veggie Lovers Pizza (V)", price: 29.5 },
    ],
    salads: [
      "Garden Fresh House Salad w/ Tomatoes, Craisins, Feta Cheese, Croutons, and Schnepf Farms Vidalia Onion Peppercorn Dressing",
      "Caesar Salad",
    ],
    sides: [],
    chefFeeRules: [
      { min: 0,  max: 74, chefs: 1, fee: 200 },
      { min: 75,           chefs: 2, fee: 400 },
    ],
    chefFeeNote: "Chef fee scales with guest count: 0–74 guests require 1 chef; 75+ guests require 2 chefs.",
  },

  prime_rib: {
    name: "Prime Rib",
    entrees: [{ kind: "single", id: "pr-carving", label: "Slow Roasted Prime Rib Carving Station (GF)", price: 61.95 }],
    salads: [
      "Garden Fresh House Salad w/ Tomatoes, Craisins, Feta Cheese, Croutons, and Schnepf Farms Vidalia Onion Peppercorn Dressing",
      "Caesar Salad",
    ],
    sides: [
      "Mac N Cheese (V)",
      "Garlic Mashed Potatoes (V, GF)",
      "Baked Penne Pasta with Seasonal Veggies, Mozzarella & Marinara (V)",
      "Roasted Garden Fresh Seasonal Veggies (V, VG, GF)",
    ],
    chefFee: 200,
    chefFeeNote: "A $200 chef fee applies to the Prime Rib carving station.",
  },
};

const STATIC_ENTREE_CUISINES = new Set<CuisineId>(["taco_bar", "wood_fired_pizza", "live_pasta"]);

/* =========================
   Per-cuisine allowances
========================= */
const ALLOWANCES: Record<CuisineId, { salads: number; entrees: number; sides: number }> = {
  bbq: { salads: 1, entrees: 1, sides: 2 },
  rustic_italian: { salads: 1, entrees: 1, sides: 2 },
  classic_chicken: { salads: 1, entrees: 1, sides: 2 },
  prime_rib: { salads: 1, entrees: 1, sides: 2 },
  taco_bar: { salads: 1, entrees: 1, sides: 0 },
  live_pasta: { salads: 1, entrees: 1, sides: 0 },
  wood_fired_pizza: { salads: 1, entrees: 1, sides: 0 },
};

const keyFor = (cuisineId: CuisineId) => `schnepfMenuSelections:${cuisineId}`;
const money = (n: number) => `$${n.toFixed(2)}/pp`;

/* =========================
   Component
========================= */
interface Props {
  cuisineId: CuisineId;
  options?: { salads: string[]; entrees: string[]; sides: string[] }; // legacy
  selections: SchnepfMenuSelections;
  setSelections: (next: SchnepfMenuSelections) => void;
  onContinue: () => void;
  onBack: () => void;
  onClose?: () => void;
}

const SchnepfMenuBuilderCatering: React.FC<Props> = ({
  cuisineId,
  selections,
  setSelections,
  onContinue,
  onBack,
  onClose,
}) => {
  const [gc, setGC] = useState(0);
  const [showModal, setShowModal] = useState<"salads" | "entrees" | "sides" | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  const rules = useMemo(() => ALLOWANCES[cuisineId], [cuisineId]);
  const cuisine = useMemo(() => C[cuisineId], [cuisineId]);

  // 🔎 Debug when cuisine changes
  useEffect(() => {
    console.log("[SCH][Menu] cuisine changed →", {
      cuisineId,
      cuisineName: cuisine?.name,
      entreeCount: cuisine?.entrees?.length,
    });
  }, [cuisineId, cuisine]);

  // guest count sync
  useEffect(() => {
    let alive = true;
    const hydrate = async () => {
      const st = await getGuestState();
      if (!alive) return;
      setGC(Number(st.value || 0));
    };
    hydrate();
    const sync = () => hydrate();
    window.addEventListener("guestCountUpdated", sync);
    window.addEventListener("guestCountLocked", sync);
    window.addEventListener("guestCountUnlocked", sync);
    return () => {
      alive = false;
      window.removeEventListener("guestCountUpdated", sync);
      window.removeEventListener("guestCountLocked", sync);
      window.removeEventListener("guestCountUnlocked", sync);
    };
  }, []);

  // chef fee calculator
  const chefFeeFor = (guests: number) => {
    if (cuisine.chefFeeRules?.length) {
      const rule = cuisine.chefFeeRules.find((r) => guests >= r.min && (r.max == null || guests <= r.max));
      return rule ? rule.fee : 0;
    }
    return cuisine.chefFee || 0;
  };

  // seed static entrée cuisines
  useEffect(() => {
    if (!STATIC_ENTREE_CUISINES.has(cuisineId)) return;
    const first = C[cuisineId].entrees.find((e) => e.kind === "single") as EntreeSingle | undefined;
    if (!first) return;
    if (selections.entrees[0] !== first.label) {
      const next: SchnepfMenuSelections = { ...selections, entrees: [first.label] };
      setSelections(next);
      persist(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuisineId]);

  // restore
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (user) => {
      const already = selections.salads.length || selections.entrees.length || selections.sides.length;
      const idToLabel = (id: string) => (cuisine.entrees as EntreeSingle[]).find((e) => e.id === id)?.label ?? id;

      if (user && !already) {
        try {
          const ref = doc(db, "users", user.uid, "yumYumData", keyFor(cuisineId));
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const saved = snap.data() as any;
            const legacyEntrees = Array.isArray(saved?.entreeIds) ? saved.entreeIds.map(idToLabel) : [];
            setSelections({
              salads: saved?.salads ?? [],
              entrees: (saved?.entrees && saved.entrees.length ? saved.entrees : legacyEntrees) ?? [],
              sides: saved?.sides ?? [],
            });
            return;
          }
        } catch (e) {
          console.error("❌ Error fetching Schnepf menu selections:", e);
        }
      }

      if (!already) {
        try {
          const raw = localStorage.getItem(keyFor(cuisineId));
          if (raw) {
            const parsed = JSON.parse(raw) as any;
            const legacyEntrees = Array.isArray(parsed?.entreeIds) ? parsed.entreeIds.map(idToLabel) : [];
            setSelections({
              salads: parsed?.salads ?? [],
              entrees: (parsed?.entrees && parsed.entrees.length ? parsed.entrees : legacyEntrees) ?? [],
              sides: parsed?.sides ?? [],
            });
          }
        } catch {
          /* ignore */
        }
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cuisineId]);

  const persist = (next: SchnepfMenuSelections) => {
    const trimmed = { salads: next.salads ?? [], entrees: next.entrees ?? [], sides: next.sides ?? [] };
    try {
      localStorage.setItem(keyFor(cuisineId), JSON.stringify(trimmed));
      localStorage.setItem("yumStep", "schnepfMenu");
    } catch {}
    onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      try {
        await setDoc(doc(db, "users", user.uid, "yumYumData", keyFor(cuisineId)), trimmed, { merge: true });
        await setDoc(doc(db, "users", user.uid), { progress: { yumYum: { step: "schnepfMenu" } } }, { merge: true });
      } catch (e) {
        console.error("❌ Error saving Schnepf menu selections:", e);
      }
    });
  };

  const handleModalClose = (type: "salads" | "entrees" | "sides", picked: string[]) => {
    const max = rules[type];
    const clamped = picked.slice(0, Math.max(0, max));
    const next: SchnepfMenuSelections = { ...selections };
    if (type === "salads") next.salads = clamped;
    if (type === "sides") next.sides = clamped;
    if (type === "entrees") next.entrees = clamped; // one entrée line (combo counts as single)
    setSelections(next);
    persist(next);
    setShowModal(null);
  };

  // UI config
  const orderedSections: Array<"entrees" | "salads" | "sides"> = ["entrees", "salads", "sides"];
  const bannerSrc: Record<"entrees" | "salads" | "sides", string> = {
    entrees: `${import.meta.env.BASE_URL}assets/images/YumYum/Entrees.png`,
    salads: `${import.meta.env.BASE_URL}assets/images/YumYum/salad.png`,
    sides: `${import.meta.env.BASE_URL}assets/images/YumYum/sides.png`,
  };
  const titleMap: Record<"entrees" | "salads" | "sides", string> = {
    entrees: "Entrées",
    salads: "Salads",
    sides: "Sides",
  };

  const pickedByType = (type: "entrees" | "salads" | "sides") =>
    type === "entrees" ? selections.entrees : type === "salads" ? selections.salads : selections.sides;

  const optionsByType = (type: "entrees" | "salads" | "sides") => {
    if (type === "entrees") {
      return cuisine.entrees.map((e) => (e.kind === "single" ? `${e.label} — ${money(e.price)}` : e.label));
    }
    if (type === "salads") {
      if (cuisineId === "bbq" || cuisineId === "taco_bar") {
        return (cuisine.salads || []).map((s) =>
          /^House Salad with Tomatoes/i.test(s)
            ? "House Salad with Tomatoes, Craisins, Feta, & Croutons"
            : s
        );
      }
      return cuisine.salads;
    }
    return cuisine.sides;
  };

  const normalizeEntreePicks = (picks: string[]) =>
    picks.map((p) => p.replace(/\s—\s\$\d+\.\d{2}\/pp$/, ""));

  // ============== RENDER ==============
  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 560, position: "relative" }}>
      {/* 🩷 Pink X Close */}
      {onClose && (
        <button className="pixie-card__close" aria-label="Close" onClick={onClose}>
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
        </button>
      )}

      <div className="pixie-card__body" style={{ textAlign: "center", padding: "2rem 2.5rem" }}>
        <h2
          style={{
            fontFamily: "'Jenna Sue', cursive",
            fontSize: "2.2rem",
            color: "#2c62ba",
            textAlign: "center",
            marginBottom: 6,
          }}
        >
          Build your Schnepf Farms menu
        </h2>

        <img
          src={`${import.meta.env.BASE_URL}assets/images/YumYum/piglet1.png`}
          alt="Piglet Chef"
          style={{ width: 160, margin: "0 auto 24px", display: "block" }}
        />

        {orderedSections.map((type) => {
          if (type === "sides" && rules.sides <= 0) return null;

          const displayPicked = pickedByType(type);
          const opts = optionsByType(type);
          const isStaticEntrees = type === "entrees" && STATIC_ENTREE_CUISINES.has(cuisineId);

          return (
            <div key={type} style={{ textAlign: "center", marginBottom: "2rem" }}>
              <img
                src={bannerSrc[type]}
                alt={titleMap[type]}
                onClick={
                  isStaticEntrees
                    ? undefined
                    : () => {
                        console.log("[SCH][Menu] open modal →", {
                          type,
                          cuisineId,
                          cuisineName: cuisine.name,
                          optionsPreview: opts,
                        });
                        setShowModal(type);
                      }
                }
                onMouseEnter={() => !isStaticEntrees && setHovered(type)}
                onMouseLeave={() => !isStaticEntrees && setHovered(null)}
                style={{
                  width: 260,
                  cursor: isStaticEntrees ? "default" : "pointer",
                  transition: "transform .25s ease",
                  transform: hovered === type && !isStaticEntrees ? "scale(1.05)" : "scale(1)",
                  borderRadius: 12,
                }}
              />

              {/* Static vs interactive entrée rendering */}
              {isStaticEntrees ? (
                <>
                  {cuisine.entrees
                    .filter((e) => e.kind === "single")
                    .map((e) => (
                      <div
                        key={`static-${e.id}`}
                        style={{
                          fontFamily: "'Jenna Sue', cursive",
                          fontSize: "2.0rem",
                          color: "#2c62ba",
                          marginTop: ".35rem",
                        }}
                      >
                        {e.label}
                      </div>
                    ))}
                  {(cuisine.chefFee != null || cuisine.chefFeeRules?.length) && (
                    <div
                      style={{
                        marginTop: ".5rem",
                        fontFamily: "'Jenna Sue', cursive",
                        color: "#2c62ba",
                        fontSize: "1.5rem",
                      }}
                    >
                      Chef fee for {gc} guests: ${chefFeeFor(gc).toFixed(2)}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {type === "entrees" && (cuisine.chefFee != null || cuisine.chefFeeRules?.length) && (
                    <div
                      style={{
                        marginTop: ".5rem",
                        fontFamily: "'Jenna Sue', cursive",
                        color: "#2c62ba",
                        fontSize: "1.5rem",
                      }}
                    >
                      Chef fee for {gc} guests: ${chefFeeFor(gc).toFixed(2)}
                    </div>
                  )}

                  {displayPicked.map((item) => (
                    <div
                      key={`${type}-${item}`}
                      onClick={() => setShowModal(type)}
                      style={{
                        fontFamily: "'Jenna Sue', cursive",
                        fontSize: "2.00rem",
                        color: "#2c62ba",
                        cursor: "pointer",
                        marginTop: ".35rem",
                      }}
                    >
                      {item}
                    </div>
                  ))}
                  {displayPicked.length === 0 && <div style={{ marginTop: ".5rem" }}>&nbsp;</div>}
                </>
              )}

              {/* Section modal (hidden for static entrée cuisines) */}
              {!isStaticEntrees && showModal === type && (
                <SelectionModal
                  key={`${cuisineId}-${type}`}   // ⬅️ force remount when cuisine/section changes
                  title={
                    type === "entrees"
                      ? `Select ${rules.entrees} Entrée${rules.entrees > 1 ? "s" : ""}`
                      : type === "salads"
                      ? `Select ${rules.salads} Salad${rules.salads > 1 ? "s" : ""}`
                      : `Select up to ${rules.sides} Side${rules.sides > 1 ? "s" : ""}`
                  }
                  options={opts}
                  max={rules[type]}
                  selected={
                    type === "entrees"
                      ? displayPicked.map((p) => p.replace(/\s—\s\$\d+\.\d{2}\/pp$/, ""))
                      : displayPicked
                  }
                  onChange={() => { /* no-op; commit on close */ }}
                  onClose={(picked) =>
                    handleModalClose(type, type === "entrees" ? normalizeEntreePicks(picked) : picked)
                  }
                  renderOption={
                    type === "salads"
                      ? ({ option, selected, setSelected }) => {
                          if (!/^House Salad with Tomatoes/i.test(option)) return null;
                          const base = "House Salad with Tomatoes, Craisins, Feta, & Croutons";
                          const pepper = `${base} — Schnepf Farms Vidalia Onion Peppercorn Dressing`;
                          const ranch = `${base} — Ranch Dressing`;
                          return (
                            <div style={{ marginBottom: "0.75rem" }}>
                              <div style={{ fontWeight: 700, marginBottom: ".35rem" }}>{base}</div>
                              <label style={{ display: "block", marginTop: ".25rem" }}>
                                <input type="checkbox" checked={selected.includes(pepper)} onChange={() => setSelected([pepper])} />
                                <span style={{ marginLeft: 8 }}>
                                  Schnepf Farms Vidalia Onion Peppercorn Dressing
                                </span>
                              </label>
                              <label style={{ display: "block", marginTop: ".25rem" }}>
                                <input type="checkbox" checked={selected.includes(ranch)} onChange={() => setSelected([ranch])} />
                                <span style={{ marginLeft: 8 }}>Ranch Dressing</span>
                              </label>
                            </div>
                          );
                        }
                      : undefined
                  }
                />
              )}
            </div>
          );
        })}

        {/* Bottom CTAs — stacked like template */}
        <div
          className="px-cta-col"
          style={{ marginTop: "1.25rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}
        >
          <button
            className="boutique-primary-btn"
            onClick={() => {
              try { localStorage.setItem("yumStep", "schnepfCart"); } catch {}
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
    </div>
  );
};

export default SchnepfMenuBuilderCatering;