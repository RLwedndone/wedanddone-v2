// src/components/NewYumBuild/CustomVenues/Rubi/RubiMexMenuBuilder.tsx
import React, { useEffect, useMemo, useState } from "react";
import SelectionModal from "../../shared/SelectionModal";
import type { RubiTierSelection as RubiMexTierSelection } from "./RubiMexTierSelector";

export interface RubiMexSelections {
  mexPassedApps: string[];
  mexStartersOrSoup: string[]; // combined storage for starters + soups
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
  soups: `${import.meta.env.BASE_URL}assets/images/YumYum/Rubi/soup.png`,
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

type AppMeta = { name: string; desc?: string; variants?: string[] };

/* ----- PASSED APPS (Fiesta / Espectacular only) ----- */
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

const PASSED_MODAL_OPTIONS = PASSED_META.map((m) =>
  m.desc ? `${m.name} — ${m.desc}` : m.name
);

const passedNameToModal = new Map(
  PASSED_META.map((m) => [m.name, m.desc ? `${m.name} — ${m.desc}` : m.name])
);
const modalToPassedName = new Map(
  PASSED_MODAL_OPTIONS.map((lbl) => [lbl, lbl.split(" — ")[0]])
);

/* ----- STARTERS (salads + apps) ----- */
const STARTERS_META: AppMeta[] = [
  // SALADS
  {
    name: "Ensalada con Jicama, Sandia & Aguacate",
    desc: "Fresh jicama, watermelon & avocado over mixed greens, lemon tequila vinaigrette",
  },
  {
    name: "Ensalada Mixta",
    desc: "Mixed greens, cherry tomatoes, red onions, cucumbers, fire roasted corn, red peppers, crispy tortilla strips, cilantro, lime vinaigrette",
  },
  {
    name: "Ensalada Cesar",
    desc: "Romaine, Cesar dressing (originated in Tijuana), parmesan cheese, anchovy filets",
  },

  // STARTERS / SHAREABLES
  {
    name: "Chips & Salsa Sensillo (v)",
    desc: "Trio: Salsa Roja, Salsa Verde & Pico de gallo",
  },
  {
    name: "Escabeche (v)",
    desc: "In-house pickled onions, carrots, cauliflower, jalapeños",
  },
  {
    name: "Chilaquiles (v)",
    desc: "Corn tortillas & Chile Colorado, queso fresco, crema, pickled onions & cilantro",
  },
  { name: "Chicarones en Salsa Verde" },
  {
    name: "Caramelos",
    desc: "Hand-made flour tortillas, melted Chihuahua cheese (choice of carne asada, pork carnitas, chorizo)",
    variants: ["Carne Asada", "Pork Carnitas", "Chorizo"],
  },
  {
    name: "Queso Fundido",
    desc: "Melted Oaxaca cheese, chorizo",
  },
  {
    name: "Smoked Chicken Flautas",
    desc: "Sour cream, guacamole",
  },
];

const STARTERS_MODAL_OPTIONS = STARTERS_META.map((m) =>
  m.desc ? `${m.name} — ${m.desc}` : m.name
);

const startersNameToModal = new Map(
  STARTERS_META.map((m) => [m.name, m.desc ? `${m.name} — ${m.desc}` : m.name])
);

const modalToStarterName = new Map(
  STARTERS_MODAL_OPTIONS.map((lbl) => [lbl, lbl.split(" — ")[0]])
);

/* ----- SOUPS ----- */
const SOUPS_META: AppMeta[] = [
  {
    name: "Sopa de Tortilla",
    desc: "Chicken consommé, tortilla strips, queso Chihuahua, avocado, lime, cilantro",
  },
  {
    name: "Caldo de Queso",
    desc: "Potato, queso Chihuahua, fire-roasted green chili",
  },
  {
    name: "Sopa de Fideo",
    desc: "Tomato & chicken consommé, fideo pasta, onion, garlic, lime, cilantro",
  },
  {
    name: "Pozole",
    desc: "Pork, hominy, rich red chili stew, cabbage, radish, oregano, lime",
  },
  {
    name: "Albóndigas",
    desc: "Beef & rice meatballs in savory beef broth with vegetables",
  },
  {
    name: "Cocido Mexicana",
    desc: "Beef short rib stew, corn, potatoes, zucchini & vegetables in rich beef broth",
  },
];

const SOUPS_MODAL_OPTIONS = SOUPS_META.map((m) =>
  m.desc ? `${m.name} — ${m.desc}` : m.name
);

const modalToSoupName = new Map(
  SOUPS_MODAL_OPTIONS.map((lbl) => [lbl, lbl.split(" — ")[0]])
);

/* ----- ENTRÉES ----- */

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

type EntreeMeta = {
  name: string;
  desc?: string;
  beefSubAllowed?: boolean;
  isTacoBar?: boolean; // NEW: flag tacos row
};

const ENTREES_META: EntreeMeta[] = [
  {
    name: STREET_TACO_LABEL,
    desc: "Pick two fillings at selection time",
    isTacoBar: true,
  },
  {
    name: "Mole Poblano *Hermanito specialty",
    desc: "Estilo de Oaxaca, usually served on special occasions, a savory thick red chili sauce with loads of spices, mild chili and a hint of Mexican chocolate. Served with choice of whole chicken, turkey breast, pork loin or beef suadero",
  },
  {
    name: "Birria de Chivo",
    desc: "(can substitute with beef) Estilo de Jalisco, Birria spiced marinated goat, slow steamed then pulled apart and served with caldo de birria, includes sliced radish, shredded cabbage, salsa de chile tepin, diced onions cilantro and lime wedges",
    beefSubAllowed: true,
  },
  {
    name: "Cochinito Pibil",
    desc: "Estilo de la Yucatán, Achiote marinated whole pig, wrapped in banana leaves and slowly smoked overnight then pulled apart. Served with pickled onions and habanero salsa",
  },
  {
    name: "Barbacoa de Borrego",
    desc: "(can substitute with beef) Estilo de Hidalgo, marinated lamb wrapped in banana leaves slow smoked over night then served pulled apart in it’s natural juices, includes onions, cilantro & “salsa barbacoa”",
    beefSubAllowed: true,
  },
  {
    name: "Chili Colorado con Carne",
    desc: "Estilo Chihuahua, beef chunks stewed low in a rich red chili sauce made in-house with a blend of red chilis",
  },
  {
    name: "Tinga de pollo",
    desc: "Estilo de Puebla, shredded chicken breast braised in “Tinga” sauce with chipotle chili, sliced onions tomatoes.",
  },
  {
    name: "Enchiladas de Mole Rojo",
    desc: "Shredded chicken wrapped in corn tortillas topped with red chili mole sauce topped with queso cotija, crema Mexicana. Cilantro & sesame seeds garnish",
  },
  {
    name: "Enchiladas de Rajas (v)",
    desc: "Roasted poblano chili & onions, wrapped in corn tortillas, topped with tomatillo salsa, black beans, crema, queso fresco & avocado",
  },
  {
    name: "Hermanito’s Chile Relleno (v)",
    desc: "Oaxaca cheese stuffed Roasted poblano chili with fluffy egg batter, roasted tomato salsa *prepared to order",
  },
];

const ENTREES_MODAL_OPTIONS = ENTREES_META.map((m) =>
  m.desc ? `${m.name} — ${m.desc}` : m.name
);

const modalToEntreeName = new Map(
  ENTREES_MODAL_OPTIONS.map((lbl) => [lbl, lbl.split(" — ")[0]])
);

/* ----- SIDES ----- */
type SideMeta = { name: string; desc?: string };

const SIDES_META: SideMeta[] = [
  { name: "Frijoles Refritos", desc: "Re-fried beans with cheese" },
  { name: "Frijoles de la olla", desc: "Whole beans cooked with onions, tomatoes, green chili, and spices" },
  { name: "Frijoles Puerco’s", desc: "Re-fried beans with chorizo and queso asadero" },
  { name: "Frijoles Borrachos", desc: "Bacon, tomato, onion, jalapeño & cilantro simmered in Mexican beer" },
  { name: "Frijoles Negros (v)", desc: "Whole black beans cooked with onions, tomatoes and spices" },
  { name: "Sopa de Arroz", desc: "(Spanish style rice) cooked with chicken stock, tomato, garlic, onion & cilantro" },
  { name: "Cilantro lime Rice (v)", desc: "Steamed white rice with cilantro and hint of lime" },
  { name: "Elote esquite (v)", desc: "(Mexican street corn) Fire roasted corn, with crema fresca, cotija cheese, red chili powder, lime & cilantro" },
  { name: "Calabacin Salteado (v)", desc: "Yellow squash and zucchini sauteed with red onions, garlic and olive oil" },
  { name: "Calabacitas Mexicanas (v)", desc: "Yellow squash, zucchini, fire roasted corn, tomatoes, red onions, fire roasted green chili, sauteed and topped with melted cheese" },
  { name: "Rajas Poblanas (v)", desc: "Fire-roasted poblano pepper strips, sauteed onion strips, fresh lime and cilantro garnish" },
  { name: "Platanos Bravos (v)", desc: "Fried ripe plantains topped with crema fresca" },
  { name: "Camote Enmielado (v)", desc: "Mexican candied sweet potatoes, slow braised with piloncillo, cinnamon, star anise & red chili powder, served in sweet braising liquid" },
];

const SIDES_MODAL_OPTIONS = SIDES_META.map((m) =>
  m.desc ? `${m.name} — ${m.desc}` : m.name
);

const modalToSideName = new Map(
  SIDES_MODAL_OPTIONS.map((lbl) => [lbl, lbl.split(" — ")[0]])
);

/* ----- DESSERTS ----- */
type DessertMeta = { name: string; desc?: string };

const DESSERTS_META: DessertMeta[] = [
  { name: "Flan con dulce de leche", desc: "House-made individual flan, creamy caramel, caramelized strawberries" },
  { name: "Sopapillas", desc: "Mexican fried bread, topped with powdered sugar, choice of dipping sauce including chocolate, mixed berry or caramel, fried to order" },
  { name: "Pastel de Trés leches", desc: "Mexican staple, made with 3 milks, moist and creamy, topped with whipped cream" },
  { name: "Conchas rellenas", desc: "Mexican sugar topped sweet bread filled with fresh strawberries, choice of dulce de leche, vanilla custard, Nutella or Mexican chocolate" },
  { name: "Fresas con Crema", desc: "Fresh cut strawberries in sweet crema served chilled" },
  { name: "Chocolate Congelada", desc: "Hermanito’s frozen hot chocolate ice cream made with “Abuelita” Mexican chocolate, cinnamon whipped cream" },
  { name: "Paletas de Fruta", desc: "All-natural hand-made fresh fruit popsicles with real fruit chunks in seasonal fruit flavors: pineapple, kiwi, lemon, lime, strawberry, mango, watermelon" },
];

const DESSERTS_MODAL_OPTIONS = DESSERTS_META.map((m) =>
  m.desc ? `${m.name} — ${m.desc}` : m.name
);

const modalToDessertName = new Map(
  DESSERTS_MODAL_OPTIONS.map((lbl) => [lbl, lbl.split(" — ")[0]])
);

/* ================================================== */

type ModalKey =
  | "passed"
  | "startersOrSoup"
  | "starters"
  | "soups"
  | "entrees"
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

  // NEW: local UI state just for taco fillings while Entrees modal is open
  // this is an array of up to 2 fillings, e.g. ["Grilled Carne Asada","Suadero"]

  // draft state used only while the Entrées modal is open
const [entreeDraft, setEntreeDraft] = useState<string[]>([]);
const [tacoFillingsDraft, setTacoFillingsDraft] = useState<string[]>([]);

  // boot from LS
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setLocalSel(JSON.parse(saved));
    } catch {}
  }, []);

  // persist to LS
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
  const startersSoupCount = needs.startersOrSoup ?? 0; // 1 for Sensillo & Fiesta, 2 for Espectacular
  const isEspectacular = startersSoupCount >= 2;

  // gate for Continue
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
  const getBaseName = (s: string) => s.split(" — ")[0];
  const withSuffix = (base: string, suffix?: string) =>
    suffix ? `${base} — ${suffix}` : base;

  // read taco fillings from saved entree string
  const getStoredTacoFillings = (): string[] => {
    const tacoRow = localSel.mexEntrees.find((e) => e.startsWith(STREET_TACO_LABEL));
    if (!tacoRow) return [];
    const parts = tacoRow.split(" — ");
    if (parts.length < 2) return [];
    return parts[1]
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean)
      .slice(0, 2);
  };

  // whenever we OPEN the entrees modal, pre-load tacoFillingsDraft from saved state
  useEffect(() => {
    if (show === "entrees") {
      setTacoFillingsDraft(getStoredTacoFillings());
    }
  }, [show]);

  // pretty print on white card:
  // keep short "variant" suffixes like "Substitute with beef" or "Pork Carnitas"
  // but hide the long marketing description tails.
  const formatForDisplayCard = (raw: string): string => {
    const [base, rest] = raw.split(" — ");
    if (!rest) return base;
    const isChoiceShort = rest.length <= 40 && !rest.includes(",");
    if (isChoiceShort) return `${base} — ${rest}`;
    return base;
  };

  /* ---------- inline variant setters ---------- */
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
          : "";

      const updated = [...list];
      updated[idx] = withSuffix(baseName, suffix || undefined);

      return { ...prev, [listKey]: updated } as RubiMexSelections;
    });
  };

  /* ---------- STARTERS / SOUPS update helpers ---------- */
  const setCombined = (nextModalLabels: string[]) => {
    const rawNextNames = nextModalLabels.map((lbl) => lbl.split(" — ")[0]);
    const uniqueNextNames = Array.from(new Set(rawNextNames));

    // preserve suffixes like "Caramelos — Pork Carnitas"
    const rebuiltWithSuffix = uniqueNextNames.map((base) => {
      const prevFull = localSel.mexStartersOrSoup.find(
        (old) => getBaseName(old) === base
      );
      return prevFull || base;
    });

    if (!isEspectacular) {
      setLocalSel((p) => ({
        ...p,
        mexStartersOrSoup: rebuiltWithSuffix.slice(0, 1),
      }));
      return;
    }

    const startersChosen = rebuiltWithSuffix
      .filter((v) => STARTERS_META.some((m) => m.name === getBaseName(v)))
      .slice(0, 1);

    const soupsChosen = rebuiltWithSuffix
      .filter((v) => SOUPS_META.some((m) => m.name === getBaseName(v)))
      .slice(0, 1);

    setLocalSel((p) => ({
      ...p,
      mexStartersOrSoup: [...startersChosen, ...soupsChosen],
    }));
  };

  const saveFromCategory = (pickedModalLabels: string[], category: "starters" | "soups") => {
    const pickedBaseNames = pickedModalLabels.map((lbl) => lbl.split(" — ")[0]);

    setLocalSel((prev) => {
      const others =
        category === "starters"
          ? prev.mexStartersOrSoup.filter((v) =>
              SOUPS_META.some((m) => m.name === getBaseName(v))
            )
          : prev.mexStartersOrSoup.filter((v) =>
              STARTERS_META.some((m) => m.name === getBaseName(v))
            );

      const rebuiltPicked = pickedBaseNames.map((base) => {
        const prevFull = prev.mexStartersOrSoup.find(
          (old) => getBaseName(old) === base
        );
        return prevFull || base;
      });

      const onlyOne = rebuiltPicked.slice(0, 1);

      return {
        ...prev,
        mexStartersOrSoup:
          category === "starters"
            ? [...onlyOne, ...others]
            : [...others, ...onlyOne],
      };
    });
  };

  /* ---------- simple modal updaters ---------- */
  const updatePassed = (modalLabels: string[]) => {
    const names = modalLabels.map(
      (lbl) => modalToPassedName.get(lbl) || lbl.split(" — ")[0]
    );
    setLocalSel((p) => ({
      ...p,
      mexPassedApps: names.slice(0, maxPassed),
    }));
  };

  const updateSides = (pickedModalLabels: string[]) => {
    const cleaned = pickedModalLabels.map(
      (lbl) => modalToSideName.get(lbl) || lbl.split(" — ")[0]
    );
    setLocalSel((p) => ({
      ...p,
      mexSides: cleaned.slice(0, maxSides),
    }));
  };

  const updateDesserts = (pickedModalLabels: string[]) => {
    const cleaned = pickedModalLabels.map(
      (lbl) => modalToDessertName.get(lbl) || lbl.split(" — ")[0]
    );
    setLocalSel((p) => ({
      ...p,
      mexDesserts: cleaned.slice(0, maxDesserts),
    }));
  };

    /* ---------- entree modal logic (NEW taco integration) ---------- */

    const openEntreesModal = () => {
      // 1. seed entreeDraft from what's saved
      const savedBases = localSel.mexEntrees.map((e) => getBaseName(e));
      setEntreeDraft(savedBases);
  
      // 2. seed tacoFillingsDraft from saved taco entry, if any
      const tacoEntry = localSel.mexEntrees.find((e) =>
        e.startsWith(STREET_TACO_LABEL)
      );
      if (tacoEntry) {
        const parts = tacoEntry.split(" — ");
        const fills =
          parts.length < 2
            ? []
            : parts[1]
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
                .slice(0, 2);
        setTacoFillingsDraft(fills);
      } else {
        setTacoFillingsDraft([]);
      }
  
      setShow("entrees");
    };

  // helper: toggle taco filling in draft (max 2)
  const toggleTacoFillingDraft = (fill: string) => {
    setTacoFillingsDraft((prev) => {
      if (prev.includes(fill)) {
        return prev.filter((f) => f !== fill);
      }
      if (prev.length >= 2) {
        // replacing 3rd click with "last two" logic:
        return [prev[0], fill];
      }
      return [...prev, fill];
    });
  };

  // when the user closes the entree modal via onChange from SelectionModal,
  // we receive "sel": the array of (name — desc) labels user had checked.
  // We'll:
  //   1. convert to base entree names
  //   2. if taco bar is included, stitch in chosen fillings from tacoFillingsDraft
  //   3. write to localSel.mexEntrees
  const finalizeEntreesFromModal = (sel: string[]) => {
    // convert "Name — desc" -> "Name"
    const pickedBaseNames = sel.map(
      (lbl) => modalToEntreeName.get(lbl) || lbl.split(" — ")[0]
    );

    // build pretty output
    const nextPretty = pickedBaseNames.map((name) => {
      if (name === STREET_TACO_LABEL) {
        if (tacoFillingsDraft.length > 0) {
          return `${STREET_TACO_LABEL} — ${tacoFillingsDraft.join(", ")}`;
        }
        // if they picked taco bar but no fillings, just store base name
        return STREET_TACO_LABEL;
      }
      return name;
    });

    setLocalSel((prev) => ({
      ...prev,
      mexEntrees: nextPretty.slice(0, maxEntrees),
    }));
  };

  /* ---------- derived helpers for rendering inline controls on the white card ---------- */

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

  // pretty list block under banners
  const ListLines: React.FC<{ items: string[]; onClick: () => void }> = ({
    items,
    onClick,
  }) => (
    <>
      {items.map((t) => {
        const pretty = formatForDisplayCard(t);
        return (
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
            {pretty}
          </div>
        );
      })}
    </>
  );

  /* ================================================== RENDER ================================================== */

  return (
    <div className="pixie-card" style={{ maxWidth: 780, margin: "0 auto" }}>
      {/* close button */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2 style={{ ...jsLine, fontSize: "2.2rem", marginBottom: 6 }}>
          Build Your Mexican Fiesta!
        </h2>

        <p
          className="px-prose-narrow"
          style={{ margin: "0 auto 10px", maxWidth: 520 }}
        >
          Tap a banner to choose items for each category.
        </p>

        <img
          src={IMG.pig}
          alt="Piglet Chef"
          className="px-media"
          style={{ width: 140, margin: "6px auto 18px" }}
        />

        {/* Passed Apps (Fiesta / Espectacular only) */}
        {maxPassed > 0 && (
          <div style={{ marginBottom: 22 }}>
            <img
              src={IMG.passed}
              alt="Passed Appetizers"
              onClick={() => setShow("passed")}
              style={{
                width: 260,
                display: "block",
                margin: "0 auto 6px",
                cursor: "pointer",
              }}
            />
            <ListLines
              items={localSel.mexPassedApps}
              onClick={() => setShow("passed")}
            />

            {/* inline variant radios for passed apps */}
            <div
              className="px-prose-narrow"
              style={{ maxWidth: 640, margin: "0 auto" }}
            >
              {PASSED_META.map((m) =>
                m.variants && selectedPassedNames.includes(m.name) ? (
                  <div key={m.name} style={{ margin: "6px 0 12px" }}>
                    <div
                      style={{
                        fontWeight: 600,
                        marginBottom: 4,
                        textAlign: "left",
                      }}
                    >
                      {m.name} — choose one:
                    </div>
                    <div>
                      {m.variants.map((opt) => (
                        <label
                          key={opt}
                          style={{
                            marginRight: 14,
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                        >
                          <input
                            type="radio"
                            name={`passed-${m.name}`}
                            checked={
                              localSel.mexPassedApps
                                .find((x) => getBaseName(x) === m.name)
                                ?.includes(opt) || false
                            }
                            onChange={() =>
                              setInlineVariant("mexPassedApps", m.name, opt)
                            }
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

        {/* Starters / Soups section */}
        {!isEspectacular ? (
          <div style={{ marginBottom: 22 }}>
            <img
              src={IMG.startersOrSoup}
              alt="Starter or Soup"
              onClick={() => setShow("startersOrSoup")}
              style={{
                width: 260,
                display: "block",
                margin: "0 auto 6px",
                cursor: "pointer",
              }}
            />

            <ListLines
              items={localSel.mexStartersOrSoup}
              onClick={() => setShow("startersOrSoup")}
            />

            {/* Caramelos inline picker when chosen */}
            {localSel.mexStartersOrSoup.some(
              (item) => item.split(" — ")[0] === "Caramelos"
            ) && (
              <div
                className="px-prose-narrow"
                style={{
                  maxWidth: 640,
                  margin: "8px auto 0",
                  textAlign: "left",
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: 6,
                    fontSize: ".95rem",
                  }}
                >
                  Caramelos — choose one:
                </div>
                {["Carne Asada", "Pork Carnitas", "Chorizo"].map((opt) => (
                  <label
                    key={opt}
                    style={{
                      marginRight: 14,
                      display: "inline-flex",
                      alignItems: "center",
                      fontSize: ".9rem",
                    }}
                  >
                    <input
                      type="radio"
                      name="caramelos-variant-inline"
                      checked={
                        localSel.mexStartersOrSoup.find(
                          (x) => x.split(" — ")[0] === "Caramelos"
                        )?.includes(opt) || false
                      }
                      onChange={() => {
                        setLocalSel((prev) => {
                          const updated = prev.mexStartersOrSoup.map((x) => {
                            const base = x.split(" — ")[0];
                            if (base === "Caramelos") {
                              return `Caramelos — ${opt}`;
                            }
                            return x;
                          });
                          return { ...prev, mexStartersOrSoup: updated };
                        });
                      }}
                      style={{ marginRight: 6 }}
                    />
                    {opt}
                  </label>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Espectacular: Starters & Soups separate */}
            <div style={{ marginBottom: 22 }}>
              <img
                src={IMG.starters}
                alt="Starters"
                onClick={() => setShow("starters")}
                style={{
                  width: 260,
                  display: "block",
                  margin: "0 auto 6px",
                  cursor: "pointer",
                }}
              />
              <ListLines
                items={localSel.mexStartersOrSoup.filter((v) =>
                  STARTERS_META.some((m) => m.name === getBaseName(v))
                )}
                onClick={() => setShow("starters")}
              />

              {selectedStarterSoupNames.includes("Caramelos") && (
                <div
                  className="px-prose-narrow"
                  style={{ maxWidth: 640, margin: "0 auto" }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      marginBottom: 4,
                      textAlign: "left",
                    }}
                  >
                    Caramelos — choose one:
                  </div>
                  {["Carne Asada", "Pork Carnitas", "Chorizo"].map((opt) => (
                    <label
                      key={opt}
                      style={{
                        marginRight: 14,
                        display: "inline-flex",
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="radio"
                        name="caramelos-variant"
                        checked={
                          localSel.mexStartersOrSoup
                            .find((x) => x.startsWith("Caramelos"))
                            ?.includes(opt) || false
                        }
                        onChange={() =>
                          setInlineVariant(
                            "mexStartersOrSoup",
                            "Caramelos",
                            opt
                          )
                        }
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
                style={{
                  width: 260,
                  display: "block",
                  margin: "0 auto 6px",
                  cursor: "pointer",
                }}
              />
              <ListLines
                items={localSel.mexStartersOrSoup.filter((v) =>
                  SOUPS_META.some((m) => m.name === getBaseName(v))
                )}
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
  onClick={openEntreesModal}
            style={{
              width: 260,
              display: "block",
              margin: "0 auto 6px",
              cursor: "pointer",
            }}
          />
          <ListLines
            items={localSel.mexEntrees}
            onClick={() => setShow("entrees")}
          />

          {/* Beef substitute inline checkbox for Birria / Barbacoa */}
          <div
            className="px-prose-narrow"
            style={{ maxWidth: 640, margin: "6px auto 0" }}
          >
            {["Birria de Chivo", "Barbacoa de Borrego"].map(
              (name) =>
                selectedEntreeNames.includes(name) && (
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
                      checked={
                        !!localSel.mexEntrees.find(
                          (x) =>
                            getBaseName(x) === name &&
                            x.includes("Substitute with beef")
                        )
                      }
                      onChange={(e) =>
                        setInlineVariant(
                          "mexEntrees",
                          name,
                          e.target.checked
                        )
                      }
                      style={{ marginRight: 8 }}
                    />
                    {name}: Substitute with beef
                  </label>
                )
            )}
          </div>
        </div>

        {/* Sides */}
        <div style={{ marginBottom: 22 }}>
          <img
            src={IMG.sides}
            alt="Sides"
            onClick={() => setShow("sides")}
            style={{
              width: 260,
              display: "block",
              margin: "0 auto 6px",
              cursor: "pointer",
            }}
          />
          <ListLines
            items={localSel.mexSides}
            onClick={() => setShow("sides")}
          />
        </div>

        {/* Desserts (Fiesta / Espectacular) */}
        {maxDesserts > 0 && (
          <div style={{ marginBottom: 8 }}>
            <img
              src={IMG.desserts}
              alt="Desserts"
              onClick={() => setShow("desserts")}
              style={{
                width: 260,
                display: "block",
                margin: "0 auto 6px",
                cursor: "pointer",
              }}
            />
            <ListLines
              items={localSel.mexDesserts}
              onClick={() => setShow("desserts")}
            />
          </div>
        )}

        {/* Continue / Back */}
        <div className="px-cta-col" style={{ marginTop: 16 }}>
          <button
            className="boutique-primary-btn"
            onClick={() => {
              setSelections(localSel);
              onContinue();
            }}
            disabled={!canContinue}
            style={{
              width: 250,
              opacity: canContinue ? 1 : 0.6,
            }}
          >
            Continue
          </button>

          <button
            className="boutique-back-btn"
            onClick={onBack}
            style={{ width: 250 }}
          >
            Back
          </button>
        </div>
      </div>

      {/* ===================== MODALS ===================== */}

      {/* Passed apps */}
      {show === "passed" && maxPassed > 0 && (
        <SelectionModal
          title={`Passed Appetizers — select ${maxPassed}`}
          options={PASSED_MODAL_OPTIONS}
          max={maxPassed}
          selected={localSel.mexPassedApps
            .map(
              (s) => passedNameToModal.get(getBaseName(s)) || getBaseName(s)
            )
            .slice(0, maxPassed)}
          onChange={(sel) => {
            updatePassed(sel);
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {/* Starters/Soups (Sensillo/Fiesta) */}
      {!isEspectacular && show === "startersOrSoup" && (
        <SelectionModal
          title="Starter or Soup — select 1"
          options={[...STARTERS_MODAL_OPTIONS, ...SOUPS_MODAL_OPTIONS]}
          max={1}
          selected={localSel.mexStartersOrSoup.map((s) => {
            const base = getBaseName(s);
            return (
              startersNameToModal.get(base) ||
              SOUPS_MODAL_OPTIONS.find((x) => x.startsWith(base)) ||
              base
            );
          })}
          onChange={(sel) => {
            setCombined(sel);
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {/* Starters-only (Espectacular) */}
      {isEspectacular && show === "starters" && (
        <SelectionModal
          title="Starter — select 1"
          options={STARTERS_MODAL_OPTIONS}
          max={1}
          selected={localSel.mexStartersOrSoup
            .filter((v) =>
              STARTERS_META.some((m) => m.name === getBaseName(v))
            )
            .map(
              (s) => startersNameToModal.get(getBaseName(s)) || getBaseName(s)
            )}
          onChange={(sel) => {
            saveFromCategory(sel, "starters");
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {/* Soups-only (Espectacular) */}
      {isEspectacular && show === "soups" && (
        <SelectionModal
          title="Soup — select 1"
          options={SOUPS_MODAL_OPTIONS}
          max={1}
          selected={localSel.mexStartersOrSoup
            .filter((v) =>
              SOUPS_META.some((m) => m.name === getBaseName(v))
            )
            .map((s) => {
              const base = getBaseName(s);
              return (
                SOUPS_MODAL_OPTIONS.find((x) => x.startsWith(base)) || base
              );
            })}
          onChange={(sel) => {
            saveFromCategory(sel, "soups");
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {/* Entrées modal WITH taco fillings inline */}
      {show === "entrees" && (
  <SelectionModal
    title={`Entrées — select ${maxEntrees}`}
    options={ENTREES_MODAL_OPTIONS}
    max={maxEntrees}
    // what appears checked when modal opens
    selected={entreeDraft.map((base) => {
      // map "Birria de Chivo" -> "Birria de Chivo — long desc..."
      return (
        ENTREES_MODAL_OPTIONS.find((x) => x.startsWith(base)) ||
        base
      );
    })}
    // live sync so we know instantly if tacos is toggled
    liveSelections={entreeDraft.map((base) => {
      return (
        ENTREES_MODAL_OPTIONS.find((x) => x.startsWith(base)) ||
        base
      );
    })}
    onLiveChange={(nextWithDesc) => {
      // convert "Birria — long desc..." back to just base names
      const bases = nextWithDesc.map(
        (lbl) => modalToEntreeName.get(lbl) || lbl.split(" — ")[0]
      );

      setEntreeDraft(bases);

      // if tacos got unchecked, wipe fillingsDraft
      if (!bases.includes(STREET_TACO_LABEL)) {
        setTacoFillingsDraft([]);
      }
    }}
    onChange={(finalWithDesc) => {
      // user hit "Add to Menu"

      // 1. turn finalWithDesc -> base entree names
      const bases = finalWithDesc.map(
        (lbl) => modalToEntreeName.get(lbl) || lbl.split(" — ")[0]
      );

      // 2. build the array we want to SAVE in localSel.mexEntrees:
      //    - normal entrees = just the name
      //    - tacos = "Mexican Street Tacos Bar — filling1, filling2"
      const finalSaved = bases.map((name) => {
        if (name === STREET_TACO_LABEL) {
          const fills = tacoFillingsDraft.slice(0, 2);
          if (fills.length > 0) {
            return `${STREET_TACO_LABEL} — ${fills.join(", ")}`;
          }
          // no fillings picked? just save base name
          return STREET_TACO_LABEL;
        }
        return name;
      });

      setLocalSel((prev) => ({
        ...prev,
        mexEntrees: finalSaved.slice(0, maxEntrees),
      }));
    }}
    onClose={() => {
      // close modal no matter what
      setShow(null);
    }}
  >
    {/* CHILD: taco fillings picker */}
    {entreeDraft.includes(STREET_TACO_LABEL) && (
      <div>
        <div
          style={{
            fontWeight: 600,
            marginBottom: 8,
            fontSize: ".95rem",
            color: "#2c62ba",
          }}
        >
          {STREET_TACO_LABEL} fillings — choose up to 2
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            rowGap: 6,
            fontSize: ".9rem",
          }}
        >
          {TACO_FILLINGS.map((f) => {
            const checked = tacoFillingsDraft.includes(f.name);
            const disabled =
              !checked && tacoFillingsDraft.length >= 2;

            return (
              <label
                key={f.name}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 6,
                  opacity: disabled ? 0.5 : 1,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => {
                    setTacoFillingsDraft((prev) => {
                      // toggle logic with 2-max rule
                      if (checked) {
                        // remove
                        return prev.filter((x) => x !== f.name);
                      } else if (prev.length < 2) {
                        // add
                        return [...prev, f.name];
                      } else {
                        return prev;
                      }
                    });
                  }}
                  style={{ marginTop: 3 }}
                />
                <span>{`${f.name} — ${f.desc}`}</span>
              </label>
            );
          })}
        </div>
      </div>
    )}
  </SelectionModal>
)}

      {/* Sides modal */}
      {show === "sides" && (
        <SelectionModal
          title={`Sides — select ${maxSides}`}
          options={SIDES_MODAL_OPTIONS}
          max={maxSides}
          selected={localSel.mexSides.map((sideName) => {
            const match = SIDES_META.find((m) => m.name === sideName);
            return match
              ? match.desc
                ? `${match.name} — ${match.desc}`
                : match.name
              : sideName;
          })}
          onChange={(pickedModalLabels) => {
            updateSides(pickedModalLabels);
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {/* Desserts modal */}
      {show === "desserts" && maxDesserts > 0 && (
        <SelectionModal
          title={`Desserts — select ${maxDesserts}`}
          options={DESSERTS_MODAL_OPTIONS}
          max={maxDesserts}
          selected={localSel.mexDesserts.map((dessertName) => {
            const match = DESSERTS_META.find((m) => m.name === dessertName);
            return match
              ? match.desc
                ? `${match.name} — ${match.desc}`
                : match.name
              : dessertName;
          })}
          onChange={(pickedModalLabels) => {
            updateDesserts(pickedModalLabels);
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}
    </div>
  );
};

export default RubiMexMenuBuilder;