// src/components/NewYumBuild/CustomVenues/Rubi/RubiMexMenuBuilder.tsx
import React, { useEffect, useMemo, useState } from "react";
import SelectionModal from "../../shared/SelectionModal";
import type { RubiTierSelection as RubiMexTierSelection } from "./RubiMexTierSelector";

export interface RubiMexSelections {
  mexPassedApps: string[];
  mexStartersOrSoup: string[];   // combined storage for starters + soups
  mexEntrees: string[];
  mexSides: string[];
  mexDesserts: string[];
  notes?: string;
}

interface Props {
  tierSelection: RubiMexTierSelection;
  selections: RubiMexSelections;
  setSelections: (sel: RubiMexSelections) => void;
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
}

const STORAGE_KEY = "rubiMexSelections";

/* --- Art assets (png banners + chef pig) --- */
const IMG = {
  pig: `${import.meta.env.BASE_URL}assets/images/YumYum/piglet1.png`,
  passed: `${import.meta.env.BASE_URL}assets/images/YumYum/apps.png`,
  startersOrSoup: `${import.meta.env.BASE_URL}assets/images/YumYum/Rubi/starters.png`,
  starters: `${import.meta.env.BASE_URL}assets/images/YumYum/Rubi/starters.png`,
  soups: `${import.meta.env.BASE_URL}assets/images/YumYum/Rubi/soups.png`,   // fallback handled below
  entrees: `${import.meta.env.BASE_URL}assets/images/YumYum/Entrees.png`,
  sides: `${import.meta.env.BASE_URL}assets/images/YumYum/sides.png`,
  desserts: `${import.meta.env.BASE_URL}assets/images/YumYum/Rubi/desserts.png`,
};

const jsLine: React.CSSProperties = {
  fontFamily: "'Jenna Sue','JennaSue',cursive",
  fontSize: "2rem",
  color: "#2c62ba",
  lineHeight: 1.15,
};

/* ====================== MENU DATA ====================== */
/** Passed Apps meta – modal shows description; some have variants picked inline on the card */
type AppMeta = { name: string; desc?: string; variants?: string[] };

const PASSED_META: AppMeta[] = [
  {
    name: "Gazpacho Mexicana Shooters (v)",
    desc: "Tomato, peppers, cucumber, jalapeño, salsa magi, zesty lime tomato sauce served chilled",
  },
  {
    name: "Ceviche Tostadas",
    desc: "Aguacate crema. Choice of shrimp, scallop or white fish",
    variants: ["Shrimp", "Scallop", "White Fish"],
  },
  {
    name: "Mini Sopes",
    desc: "House-made corn masa cakes (choice of beef picadillo, frijoles or both). Lettuce, pico, queso fresco",
    variants: ["Beef Picadillo", "Frijoles", "Both"],
  },
  {
    name: "Mini Chimichangas",
    desc: "Choice of Chile Colorado (Beef & Red Chili), or Chile Verde (Green Chili Pork). Salsa Roja",
    variants: ["Chile Colorado (Beef & Red Chili)", "Chile Verde (Green Chili Pork)"],
  },
  {
    name: "Camarones Bravos",
    desc: "Bacon wrapped shrimp stuffed with Oaxaca cheese, spicy crema",
  },
];

// Helpers: "modal label" includes description; storage shows only name (+ any option suffix)
const PASSED_MODAL_OPTIONS = PASSED_META.map((m) =>
  m.desc ? `${m.name} — ${m.desc}` : m.name
);
const passedNameToModal = new Map(PASSED_META.map((m) => [m.name, m.desc ? `${m.name} — ${m.desc}` : m.name]));
const modalToPassedName = new Map(PASSED_MODAL_OPTIONS.map((lbl) => [lbl, lbl.split(" — ")[0]]));

/** Starters (Cold + Warm) */
const STARTERS_META: AppMeta[] = [
  { name: "Chips & Salsa Sensillo (v)", desc: "Trio: Salsa Roja, Salsa Verde & Pico de Gallo" },
  { name: "Escabeche (v)", desc: "In-house pickled onions, carrots, cauliflower, jalapeños" },
  { name: "Chilaquiles (v)", desc: "Corn tortillas & Chile Colorado, queso fresco, crema, pickled onions & cilantro" },
  { name: "Chicarones en Salsa Verde", desc: undefined },
  {
    name: "Caramelos",
    desc: "Hand-made flour tortillas, melted Chihuahua cheese (choice of carne asada, pork carnitas, chorizo)",
    variants: ["Carne Asada", "Pork Carnitas", "Chorizo"],
  },
  { name: "Queso Fundido", desc: "Melted Oaxaca cheese, chorizo" },
  { name: "Smoked Chicken Flautas", desc: "Sour cream, guacamole" },
];

const STARTERS_MODAL_OPTIONS = STARTERS_META.map((m) =>
  m.desc ? `${m.name} — ${m.desc}` : m.name
);
const startersNameToModal = new Map(STARTERS_META.map((m) => [m.name, m.desc ? `${m.name} — ${m.desc}` : m.name]));
const modalToStarterName = new Map(STARTERS_MODAL_OPTIONS.map((lbl) => [lbl, lbl.split(" — ")[0]]));

/** Soups */
const SOUPS_META: AppMeta[] = [
  { name: "Sopa de Tortilla", desc: "Chicken consommé, tortilla strips, queso Chihuahua, avocado, lime, cilantro" },
  { name: "Caldo de Queso", desc: "Potato, queso Chihuahua, fire-roasted green chili" },
  { name: "Sopa de Fideo", desc: "Tomato & chicken consommé, fideo pasta, onion, garlic, lime, cilantro" },
  { name: "Pozole", desc: "Pork, hominy, rich red chili stew, cabbage, radish, oregano, lime" },
  { name: "Albóndigas", desc: "Beef & rice meatballs in savory beef broth with vegetables" },
  { name: "Cocido Mexicana", desc: "Beef short rib stew, corn, potatoes, zucchini & vegetables in rich beef broth" },
];

const SOUPS_MODAL_OPTIONS = SOUPS_META.map((m) =>
  m.desc ? `${m.name} — ${m.desc}` : m.name
);
const modalToSoupName = new Map(SOUPS_MODAL_OPTIONS.map((lbl) => [lbl, lbl.split(" — ")[0]]));

/** Entrées */
const STREET_TACO_LABEL = "Mexican Street Tacos Bar";
const TACO_FILLINGS = [
  { name: "Grilled Carne Asada", desc: "Seasoned charbroiled steak" },
  { name: "Al pastor", desc: "Spit grilled marinated pork cooked sliced directly off the 'Trompo'" },
  { name: "Carnitas de Puerco", desc: "Pork cooked 'confit' style" },
  { name: "Chorizo", desc: "House-ground and seasoned ground pork chorizo" },
  { name: "Cabeza", desc: "Smoked and shredded beef cheek" },
  { name: "Suadero", desc: "Slow-smoked beef brisket" },
  { name: "Pescado", desc: "Tempura battered cod, cilantro lime slaw, pico de gallo" },
  { name: "Al vapor de papa (v)", desc: "Steamed potato, onion, poblano chili & Oaxaca cheese" },
  { name: "Lengua", desc: "Slow-braised beef tongue" },
  { name: "Buche", desc: "Pork stomach slowly smoked, then flash fried crispy" },
  { name: "Tripas de leche", desc: "Beef milk intestines char grilled, then cooked 'confit' until tender" },
];

type EntreeMeta = { name: string; desc?: string; beefSubAllowed?: boolean };
const ENTREES_META: EntreeMeta[] = [
  { name: STREET_TACO_LABEL, desc: "Pick two fillings at selection time" },
  { name: "Mole Poblano" },
  {
    name: "Birria de Chivo",
    desc: "Estilo de Jalisco… served with caldo, radish, cabbage, chile tepin salsa, onions, cilantro, lime",
    beefSubAllowed: true,
  },
  { name: "Cochinito Pibil" },
  {
    name: "Barbacoa de Borrego",
    desc: "Estilo de Hidalgo… marinated lamb in banana leaves, overnight smoked; onions, cilantro & salsa barbacoa",
    beefSubAllowed: true,
  },
  { name: "Chili Colorado con Carne" },
  { name: "Tinga de pollo" },
  { name: "Enchiladas de Mole Rojo" },
  { name: "Enchiladas de Rajas (v)" },
  { name: "Hermanito’s Chile Relleno (v)" },
];

const ENTREES = ENTREES_META.map((m) => m.name);
const ENTREES_MODAL_OPTIONS = ENTREES_META.map((m) =>
  m.desc ? `${m.name} — ${m.desc}` : m.name
);
const modalToEntreeName = new Map(ENTREES_MODAL_OPTIONS.map((lbl) => [lbl, lbl.split(" — ")[0]]));

const SIDES = ["Spanish Rice", "Refried Beans", "Elote Corn", "Tostones"];
const DESSERTS = ["Churros", "Tres Leches Cake", "Flan"];

/* ================================================== */

type ModalKey =
  | "passed"
  | "startersOrSoup"
  | "starters"
  | "soups"
  | "entrees"
  | "tacos"
  | "sides"
  | "desserts"
  | null;

const RubiMexMenuBuilder: React.FC<Props> = ({
  tierSelection,
  selections,
  setSelections,
  onContinue,
  onBack,
  onClose,
}) => {
  const [localSel, setLocalSel] = useState<RubiMexSelections>(selections);
  const [show, setShow] = useState<ModalKey>(null);

  // boot/persist LS
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setLocalSel(JSON.parse(saved));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(localSel));
    } catch {}
  }, [localSel]);

  // tier rules
  const needs = tierSelection.counts;
  const maxPassed = needs.passedApps ?? 0;
  const maxEntrees = needs.entrees ?? 0;
  const maxSides = needs.sides ?? 0;
  const maxDesserts = needs.desserts ?? 0;
  const startersSoupCount = needs.startersOrSoup ?? 0; // 1 for tiers 1–2, 2 for tier 3
  const isEspectacular = startersSoupCount >= 2;       // pick 1 Starter + 1 Soup

  // selection guards
  const canContinue =
    localSel.mexEntrees.length >= maxEntrees &&
    localSel.mexSides.length >= maxSides &&
    (!isEspectacular
      ? localSel.mexStartersOrSoup.length >= Math.min(1, startersSoupCount)
      : STARTERS_META.some((m) => localSel.mexStartersOrSoup.includes(m.name)) &&
        SOUPS_META.some((m) => localSel.mexStartersOrSoup.includes(m.name))) &&
    (maxPassed === 0 || localSel.mexPassedApps.length >= maxPassed) &&
    (maxDesserts === 0 || localSel.mexDesserts.length >= maxDesserts);

  /* ---------- helpers ---------- */
  const getBaseName = (s: string) => s.split(" — ")[0]; // strip any option suffix
  const withSuffix = (base: string, suffix?: string) =>
    suffix ? `${base} — ${suffix}` : base;

  /* ---------- combined starters/soups updates ---------- */
  const setCombined = (nextModalLabels: string[]) => {
    const nextNames = nextModalLabels.map((lbl) => {
      const base = lbl.split(" — ")[0];
      return base;
    });
    if (!isEspectacular) {
      setLocalSel((p) => ({ ...p, mexStartersOrSoup: nextNames.slice(0, 1) }));
      return;
    }
    const startersChosen = nextNames.filter((v) => STARTERS_META.some((m) => m.name === v)).slice(0, 1);
    const soupsChosen = nextNames.filter((v) => SOUPS_META.some((m) => m.name === v)).slice(0, 1);
    setLocalSel((p) => ({ ...p, mexStartersOrSoup: [...startersChosen, ...soupsChosen] }));
  };

  const saveFromCategory = (pickedModalLabels: string[], category: "starters" | "soups") => {
    const pickedNames = pickedModalLabels.map((lbl) => lbl.split(" — ")[0]);
    setLocalSel((prev) => {
      const others =
        category === "starters"
          ? prev.mexStartersOrSoup.filter((v) => SOUPS_META.some((m) => m.name === v))
          : prev.mexStartersOrSoup.filter((v) => STARTERS_META.some((m) => m.name === v));
      const onlyOne = pickedNames.slice(0, 1);
      return {
        ...prev,
        mexStartersOrSoup:
          category === "starters" ? [...onlyOne, ...others] : [...others, ...onlyOne],
      };
    });
  };

  //* ---------- Street Tacos helpers ---------- */
const getStoredTacoFillings = (): string[] => {
  const raw = localSel.mexEntrees.find((e) => e.startsWith(STREET_TACO_LABEL));
  if (!raw) return [];

  // expecting format: "Street Tacos — Filling A, Filling B"
  const parts = raw.split("—")[1]?.trim();
  if (!parts) return [];

  return parts
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 2);
};

const formatTacoEntree = (fills: string[]) =>
  `${STREET_TACO_LABEL} — ${fills.slice(0, 2).join(", ")}`;

const openTacoFillings = () => setShow("tacos");

const saveTacoFillings = (fills: string[]) => {
  const pretty = formatTacoEntree(fills);
  setLocalSel((prev) => {
    const others = prev.mexEntrees.filter(
      (e) => !e.startsWith(STREET_TACO_LABEL)
    );
    return {
      ...prev,
      mexEntrees: [...others, pretty].slice(0, maxEntrees),
    };
  });
};

  /* ---------- inline option setters (rendered on the card) ---------- */
  const setInlineVariant = (
    listKey: keyof RubiMexSelections,
    baseName: string,
    variant: string | boolean
  ) => {
    setLocalSel((prev) => {
      const list = prev[listKey] as string[];
      const idx = list.findIndex((x) => getBaseName(x) === baseName);
      if (idx === -1) return prev;

      const suffix =
        typeof variant === "string"
          ? variant
          : variant
          ? "Substitute with beef"
          : ""; // unchecked → remove suffix

      const updated = [...list];
      updated[idx] = withSuffix(baseName, suffix || undefined);
      return { ...prev, [listKey]: updated } as RubiMexSelections;
    });
  };

  /* ---------- simple modal update fns ---------- */
  const updatePassed = (modalLabels: string[]) => {
    const names = modalLabels.map((lbl) => modalToPassedName.get(lbl) || lbl.split(" — ")[0]);
    setLocalSel((p) => ({ ...p, mexPassedApps: names.slice(0, maxPassed) }));
  };
  const updateEntrees = (modalLabels: string[]) => {
    const names = modalLabels.map((lbl) => modalToEntreeName.get(lbl) || lbl.split(" — ")[0]);
    setLocalSel((p) => ({ ...p, mexEntrees: names.slice(0, maxEntrees) }));
  };
  const updateSides = (sel: string[]) =>
    setLocalSel((p) => ({ ...p, mexSides: sel.slice(0, maxSides) }));
  const updateDesserts = (sel: string[]) =>
    setLocalSel((p) => ({ ...p, mexDesserts: sel.slice(0, maxDesserts) }));

  // derived helpers for rendering inline controls
  const selectedPassedNames = useMemo(
    () => localSel.mexPassedApps.map(getBaseName),
    [localSel.mexPassedApps]
  );
  const selectedStarterSoupNames = useMemo(
    () => localSel.mexStartersOrSoup.map(getBaseName),
    [localSel.mexStartersOrSoup]
  );
  const selectedEntreeNames = useMemo(
    () => localSel.mexEntrees.map(getBaseName),
    [localSel.mexEntrees]
  );

  // pretty list renderer under each banner (names/suffix only)
  const ListLines: React.FC<{ items: string[]; onClick: () => void }> = ({
    items,
    onClick,
  }) => (
    <>
      {items.map((t) => (
        <div
          key={t}
          onClick={onClick}
          style={{
            ...jsLine,
            fontSize: "2.1rem",
            marginBottom: 10,
            cursor: "pointer",
          }}
        >
          {t}
        </div>
      ))}
    </>
  );

  return (
    <div className="pixie-card" style={{ maxWidth: 780, margin: "0 auto" }}>
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2 style={{ ...jsLine, fontSize: "2.2rem", marginBottom: 6 }}>
          Build Your Mexican Fiesta!
        </h2>
        <p className="px-prose-narrow" style={{ margin: "0 auto 10px", maxWidth: 520 }}>
          Tap a banner to choose items for each category.
        </p>

        <img
          src={IMG.pig}
          alt="Piglet Chef"
          className="px-media"
          style={{ width: 140, margin: "6px auto 18px" }}
        />

        {/* Passed Apps */}
        {maxPassed > 0 && (
          <div style={{ marginBottom: 22 }}>
            <img
              src={IMG.passed}
              alt="Passed Appetizers"
              onClick={() => setShow("passed")}
              style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
            />
            <ListLines items={localSel.mexPassedApps} onClick={() => setShow("passed")} />

            {/* Inline variant pickers for the three passed apps */}
            <div className="px-prose-narrow" style={{ maxWidth: 640, margin: "0 auto" }}>
              {PASSED_META.map((m) =>
                m.variants && selectedPassedNames.includes(m.name) ? (
                  <div key={m.name} style={{ margin: "6px 0 12px" }}>
                    <div style={{ fontWeight: 600, marginBottom: 4, textAlign: "left" }}>
                      {m.name} — choose one:
                    </div>
                    <div>
                      {m.variants.map((opt) => (
                        <label key={opt} style={{ marginRight: 14, display: "inline-flex", alignItems: "center" }}>
                          <input
                            type="radio"
                            name={`passed-${m.name}`}
                            checked={
                              localSel.mexPassedApps.find((x) => getBaseName(x) === m.name)?.includes(opt) || false
                            }
                            onChange={() => setInlineVariant("mexPassedApps", m.name, opt)}
                            style={{ marginRight: 6 }}
                          />
                          {opt}
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null
              )}
            </div>
          </div>
        )}

        {/* Starters/Soups rule */}
        {!isEspectacular ? (
          <div style={{ marginBottom: 22 }}>
            <img
              src={IMG.startersOrSoup}
              alt="Starter or Soup"
              onClick={() => setShow("startersOrSoup")}
              style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
            />
            <ListLines items={localSel.mexStartersOrSoup} onClick={() => setShow("startersOrSoup")} />
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 22 }}>
              <img
                src={IMG.starters}
                alt="Starters"
                onClick={() => setShow("starters")}
                style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
              />
              <ListLines
                items={localSel.mexStartersOrSoup.filter((v) => STARTERS_META.some((m) => m.name === getBaseName(v)))}
                onClick={() => setShow("starters")}
              />

              {/* Caramelos inline variant (if selected) */}
              {selectedStarterSoupNames.includes("Caramelos") && (
                <div className="px-prose-narrow" style={{ maxWidth: 640, margin: "0 auto" }}>
                  <div style={{ fontWeight: 600, marginBottom: 4, textAlign: "left" }}>
                    Caramelos — choose one:
                  </div>
                  {STARTERS_META.find((m) => m.name === "Caramelos")!.variants!.map((opt) => (
                    <label key={opt} style={{ marginRight: 14, display: "inline-flex", alignItems: "center" }}>
                      <input
                        type="radio"
                        name="caramelos-variant"
                        checked={
                          localSel.mexStartersOrSoup
                            .find((x) => getBaseName(x) === "Caramelos")
                            ?.includes(opt) || false
                        }
                        onChange={() => setInlineVariant("mexStartersOrSoup", "Caramelos", opt)}
                        style={{ marginRight: 6 }}
                      />
                      {opt}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div style={{ marginBottom: 22 }}>
              <img
                src={IMG.soups}
                alt="Soups"
                onClick={() => setShow("soups")}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = IMG.starters;
                }}
                style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
              />
              <ListLines
                items={localSel.mexStartersOrSoup.filter((v) => SOUPS_META.some((m) => m.name === getBaseName(v)))}
                onClick={() => setShow("soups")}
              />
            </div>
          </>
        )}

        {/* Entrées */}
        <div style={{ marginBottom: 22 }}>
          <img
            src={IMG.entrees}
            alt="Entrées"
            onClick={() => setShow("entrees")}
            style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
          />
          <ListLines items={localSel.mexEntrees} onClick={() => setShow("entrees")} />

          {/* Quick access to edit taco fillings if chosen */}
          {localSel.mexEntrees.some((e) => e.startsWith(STREET_TACO_LABEL)) && (
            <div
              onClick={openTacoFillings}
              style={{
                cursor: "pointer",
                fontSize: ".95rem",
                color: "#2c62ba",
                marginTop: 6,
                textDecoration: "underline",
              }}
            >
              Edit taco fillings
            </div>
          )}

          {/* Beef substitute inline checkboxes */}
          <div className="px-prose-narrow" style={{ maxWidth: 640, margin: "6px auto 0" }}>
            {["Birria de Chivo", "Barbacoa de Borrego"].map((name) =>
              selectedEntreeNames.includes(name) ? (
                <label
                  key={name}
                  style={{
                    display: "block",
                    textAlign: "left",
                    marginTop: 8,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!localSel.mexEntrees.find((x) => getBaseName(x) === name && x.includes("Substitute with beef"))}
                    onChange={(e) => setInlineVariant("mexEntrees", name, e.target.checked)}
                    style={{ marginRight: 8 }}
                  />
                  {name}: Substitute with beef
                </label>
              ) : null
            )}
          </div>
        </div>

        {/* Sides */}
        <div style={{ marginBottom: 22 }}>
          <img
            src={IMG.sides}
            alt="Sides"
            onClick={() => setShow("sides")}
            style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
          />
          <ListLines items={localSel.mexSides} onClick={() => setShow("sides")} />
        </div>

        {/* Desserts (optional) */}
        {maxDesserts > 0 && (
          <div style={{ marginBottom: 8 }}>
            <img
              src={IMG.desserts}
              alt="Desserts"
              onClick={() => setShow("desserts")}
              style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
            />
            <ListLines items={localSel.mexDesserts} onClick={() => setShow("desserts")} />
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

      {/* ---------- Modals (SelectionModal uses string[] options) ---------- */}

      {show === "passed" && maxPassed > 0 && (
        <SelectionModal
          title={`Passed Appetizers — select ${maxPassed}`}
          options={PASSED_MODAL_OPTIONS}
          max={maxPassed}
          selected={
            // map currently selected to modal labels
            localSel.mexPassedApps
              .map((s) => passedNameToModal.get(getBaseName(s)) || getBaseName(s))
              .slice(0, maxPassed)
          }
          onChange={(sel) => {
            updatePassed(sel);
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {!isEspectacular && show === "startersOrSoup" && (
        <SelectionModal
          title="Starter or Soup — select 1"
          options={[...STARTERS_MODAL_OPTIONS, ...SOUPS_MODAL_OPTIONS]}
          max={1}
          selected={localSel.mexStartersOrSoup.map((s) => {
            const base = getBaseName(s);
            return startersNameToModal.get(base) ||
              SOUPS_MODAL_OPTIONS.find((x) => x.startsWith(base)) ||
              base;
          })}
          onChange={(sel) => {
            setCombined(sel);
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {isEspectacular && show === "starters" && (
        <SelectionModal
          title="Starter — select 1"
          options={STARTERS_MODAL_OPTIONS}
          max={1}
          selected={localSel.mexStartersOrSoup
            .filter((v) => STARTERS_META.some((m) => m.name === getBaseName(v)))
            .map((s) => startersNameToModal.get(getBaseName(s)) || getBaseName(s))}
          onChange={(sel) => {
            saveFromCategory(sel, "starters");
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {isEspectacular && show === "soups" && (
        <SelectionModal
          title="Soup — select 1"
          options={SOUPS_MODAL_OPTIONS}
          max={1}
          selected={localSel.mexStartersOrSoup
            .filter((v) => SOUPS_META.some((m) => m.name === getBaseName(v)))
            .map((s) => {
              const base = getBaseName(s);
              return SOUPS_MODAL_OPTIONS.find((x) => x.startsWith(base)) || base;
            })}
          onChange={(sel) => {
            saveFromCategory(sel, "soups");
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {show === "entrees" && (
        <SelectionModal
          title={`Entrées — select ${maxEntrees}`}
          options={ENTREES_MODAL_OPTIONS}
          max={maxEntrees}
          selected={
            // map current selections to modal labels (strip suffix, then attach desc if present)
            localSel.mexEntrees.map((e) => {
              const base = getBaseName(e);
              return ENTREES_MODAL_OPTIONS.find((x) => x.startsWith(base)) || base;
            })
          }
          onChange={(sel) => {
            // Normalize to names (no desc)
            const names = sel.map((lbl) => modalToEntreeName.get(lbl) || lbl.split(" — ")[0]);
            setLocalSel((p) => {
              // Preserve taco fillings if tacos stays selected
              const hadTacos = p.mexEntrees.some((x) => x.startsWith(STREET_TACO_LABEL));
              const prevFills = hadTacos ? getStoredTacoFillings() : [];
              const nextPretty = names.map((n) =>
                n === STREET_TACO_LABEL && prevFills.length ? formatTacoEntree(prevFills) : n
              );
              return { ...p, mexEntrees: nextPretty.slice(0, maxEntrees) };
            });
            setShow(null);

            // If tacos selected and no fillings yet, prompt fillings
            const pickedTacos = names.includes(STREET_TACO_LABEL);
            const alreadyHaveFills = getStoredTacoFillings().length > 0;
            if (pickedTacos && !alreadyHaveFills) openTacoFillings();
          }}
          onClose={() => setShow(null)}
        />
      )}

      {show === "tacos" && (
        <SelectionModal
        title="Street Tacos — choose up to 2 fillings"
        options={TACO_FILLINGS.map((t) => `${t.name} — ${t.desc}`)}
        max={2}
        selected={getStoredTacoFillings()}
        onChange={(fills) => {
          // 🧩 Save short names only
          const shortNames = fills.map((f) => f.split(" — ")[0]);
          saveTacoFillings(shortNames);
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
          selected={localSel.mexSides}
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
          selected={localSel.mexDesserts}
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

export default RubiMexMenuBuilder;