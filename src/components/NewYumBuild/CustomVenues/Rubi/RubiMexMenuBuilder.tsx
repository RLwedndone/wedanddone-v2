// src/components/NewYumBuild/CustomVenues/Rubi/RubiMexMenuBuilder.tsx
import React, { useEffect, useMemo, useState } from "react";
import SelectionModal from "../../shared/SelectionModal";

export interface RubiMexSelections {
  mexPassedApps: string[];
  mexStartersOrSoup: string[]; // stores either a starter OR a soup (1 item total)
  mexEntrees: string[];
  mexSides: string[];
  mexDesserts: string[]; // kept for back-compat, but unused (no desserts for Rubi Mexican)
  notes?: string;
}

interface Props {
  selections: RubiMexSelections;
  setSelections: (sel: RubiMexSelections) => void;
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
}

const STORAGE_KEY = "rubiMexSelections";

/* ---------- UI assets ---------- */
const IMG = {
  pig: `${import.meta.env.BASE_URL}assets/images/YumYum/piglet1.png`,
  passed: `${import.meta.env.BASE_URL}assets/images/YumYum/Rubi/passed_apps.png`, // ✅ new art
  startersOrSoup: `${import.meta.env.BASE_URL}assets/images/YumYum/Rubi/starters.png`,
  starters: `${import.meta.env.BASE_URL}assets/images/YumYum/Rubi/starters.png`,
  soups: `${import.meta.env.BASE_URL}assets/images/YumYum/Rubi/soup.png`,
  entrees: `${import.meta.env.BASE_URL}assets/images/YumYum/Entrees.png`,
  sides: `${import.meta.env.BASE_URL}assets/images/YumYum/sides.png`,
};

const jsLine: React.CSSProperties = {
  fontFamily: "'Jenna Sue','JennaSue',cursive",
  fontSize: "2rem",
  color: "#2c62ba",
  lineHeight: 1.15,
};

/* ====================== MENU DATA (unchanged) ====================== */
type AppMeta = { name: string; desc?: string; variants?: string[] };

/* ----- PASSED APPS ----- */
const PASSED_META: AppMeta[] = [
  { name: "Gazpacho Mexicana Shooters (v)", desc: "Tomato, peppers, cucumber, jalapeño, salsa magi, zesty lime tomato sauce served chilled" },
  { name: "Ceviche Tostadas", desc: "Aguacate crema. Choice of shrimp, scallop or white fish", variants: ["Shrimp", "Scallop", "White Fish"] },
  { name: "Mini Sopes", desc: "House-made corn masa cakes (choice of beef picadillo, frijoles or both). Lettuce, pico, queso fresco", variants: ["Beef Picadillo", "Frijoles", "Both"] },
  { name: "Mini Chimichangas", desc: "Choice of Chile Colorado (Beef & Red Chili), or Chile Verde (Green Chili Pork). Salsa Roja", variants: ["Chile Colorado (Beef & Red Chili)", "Chile Verde (Green Chili Pork)"] },
  { name: "Camarones Bravos", desc: "Bacon wrapped shrimp stuffed with Oaxaca cheese, spicy crema" },
];
const PASSED_MODAL_OPTIONS = PASSED_META.map((m) => (m.desc ? `${m.name} — ${m.desc}` : m.name));
const passedNameToModal = new Map(PASSED_META.map((m) => [m.name, m.desc ? `${m.name} — ${m.desc}` : m.name]));
const modalToPassedName = new Map(PASSED_MODAL_OPTIONS.map((lbl) => [lbl, lbl.split(" — ")[0]]));

/* ----- STARTERS (salads + apps) ----- */
const STARTERS_META: AppMeta[] = [
  // SALADS
  { name: "Ensalada con Jicama, Sandia & Aguacate", desc: "Fresh jicama, watermelon & avocado over mixed greens, lemon tequila vinaigrette" },
  { name: "Ensalada Mixta", desc: "Mixed greens, cherry tomatoes, red onions, cucumbers, fire roasted corn, red peppers, crispy tortilla strips, cilantro, lime vinaigrette" },
  { name: "Ensalada Cesar", desc: "Romaine, Cesar dressing (originated in Tijuana), parmesan cheese, anchovy filets" },
  // STARTERS / SHAREABLES
  { name: "Chips & Salsa Sensillo (v)", desc: "Trio: Salsa Roja, Salsa Verde & Pico de gallo" },
  { name: "Escabeche (v)", desc: "In-house pickled onions, carrots, cauliflower, jalapeños" },
  { name: "Chilaquiles (v)", desc: "Corn tortillas & Chile Colorado, queso fresco, crema, pickled onions & cilantro" },
  { name: "Chicarones en Salsa Verde" },
  { name: "Caramelos", desc: "Hand-made flour tortillas, melted Chihuahua cheese (choice of carne asada, pork carnitas, chorizo)", variants: ["Carne Asada", "Pork Carnitas", "Chorizo"] },
  { name: "Queso Fundido", desc: "Melted Oaxaca cheese, chorizo" },
  { name: "Smoked Chicken Flautas", desc: "Sour cream, guacamole" },
];
const STARTERS_MODAL_OPTIONS = STARTERS_META.map((m) => (m.desc ? `${m.name} — ${m.desc}` : m.name));
const startersNameToModal = new Map(STARTERS_META.map((m) => [m.name, m.desc ? `${m.name} — ${m.desc}` : m.name]));
const modalToStarterName = new Map(STARTERS_MODAL_OPTIONS.map((lbl) => [lbl, lbl.split(" — ")[0]]));

/* ----- SOUPS ----- */
const SOUPS_META: AppMeta[] = [
  { name: "Sopa de Tortilla", desc: "Chicken consommé, tortilla strips, queso Chihuahua, avocado, lime, cilantro" },
  { name: "Caldo de Queso", desc: "Potato, queso Chihuahua, fire-roasted green chili" },
  { name: "Sopa de Fideo", desc: "Tomato & chicken consommé, fideo pasta, onion, garlic, lime, cilantro" },
  { name: "Pozole", desc: "Pork, hominy, rich red chili stew, cabbage, radish, oregano, lime" },
  { name: "Albóndigas", desc: "Beef & rice meatballs in savory beef broth with vegetables" },
  { name: "Cocido Mexicana", desc: "Beef short rib stew, corn, potatoes, zucchini & vegetables in rich beef broth" },
];
const SOUPS_MODAL_OPTIONS = SOUPS_META.map((m) => (m.desc ? `${m.name} — ${m.desc}` : m.name));
const modalToSoupName = new Map(SOUPS_MODAL_OPTIONS.map((lbl) => [lbl, lbl.split(" — ")[0]]));

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
type EntreeMeta = { name: string; desc?: string; beefSubAllowed?: boolean; isTacoBar?: boolean };
const ENTREES_META: EntreeMeta[] = [
  { name: STREET_TACO_LABEL, desc: "Pick two fillings at selection time", isTacoBar: true },
  {
    name: "Mole Poblano *Hermanito specialty",
    desc: "Estilo de Oaxaca, usually served on special occasions, a savory thick red chili sauce ... Served with choice of whole chicken, turkey breast, pork loin or beef suadero",
  },
  {
    name: "Birria de Chivo",
    desc: "(can substitute with beef) Estilo de Jalisco ... includes sliced radish, shredded cabbage, salsa de chile tepin, diced onions cilantro and lime wedges",
    beefSubAllowed: true,
  },
  {
    name: "Cochinito Pibil",
    desc: "Estilo de la Yucatán ... Achiote marinated whole pig, wrapped in banana leaves and slowly smoked overnight",
  },
  {
    name: "Barbacoa de Borrego",
    desc: "(can substitute with beef) Estilo de Hidalgo ... marinated lamb wrapped in banana leaves slow smoked overnight",
    beefSubAllowed: true,
  },
  { name: "Chili Colorado con Carne", desc: "Estilo Chihuahua, beef chunks stewed low in a rich red chili sauce" },
  { name: "Tinga de pollo", desc: "Estilo de Puebla, shredded chicken breast braised in “Tinga” sauce" },
  { name: "Enchiladas de Mole Rojo", desc: "Shredded chicken in corn tortillas with red chili mole, queso cotija, crema" },
  { name: "Enchiladas de Rajas (v)", desc: "Roasted poblano & onions, tomatillo salsa, black beans, crema, queso fresco & avocado" },
  { name: "Hermanito’s Chile Relleno (v)", desc: "Oaxaca cheese stuffed roasted poblano with fluffy egg batter, roasted tomato salsa" },
];
const ENTREES_MODAL_OPTIONS = ENTREES_META.map((m) => (m.desc ? `${m.name} — ${m.desc}` : m.name));
const modalToEntreeName = new Map(ENTREES_MODAL_OPTIONS.map((lbl) => [lbl, lbl.split(" — ")[0]]));

/* ----- SIDES ----- */
type SideMeta = { name: string; desc?: string };
const SIDES_META: SideMeta[] = [
  { name: "Frijoles Refritos", desc: "Re-fried beans with cheese" },
  { name: "Frijoles de la olla", desc: "Whole beans cooked with onions, tomatoes, green chili, and spices" },
  { name: "Frijoles Puerco’s", desc: "Re-fried beans with chorizo and queso asadero" },
  { name: "Frijoles Borrachos", desc: "Bacon, tomato, onion, jalapeño & cilantro simmered in Mexican beer" },
  { name: "Frijoles Negros (v)", desc: "Whole black beans cooked with onions, tomatoes and spices" },
  { name: "Sopa de Arroz", desc: "(Spanish style rice) chicken stock, tomato, garlic, onion & cilantro" },
  { name: "Cilantro lime Rice (v)", desc: "Steamed white rice with cilantro and hint of lime" },
  { name: "Elote esquite (v)", desc: "Fire roasted corn, crema fresca, cotija, chili powder, lime & cilantro" },
  { name: "Calabacin Salteado (v)", desc: "Yellow squash and zucchini sautéed with red onions, garlic and olive oil" },
  { name: "Calabacitas Mexicanas (v)", desc: "Squash, zucchini, corn, tomatoes, onions, green chili, topped with cheese" },
  { name: "Rajas Poblanas (v)", desc: "Roasted poblano strips, sautéed onions, lime & cilantro" },
  { name: "Platanos Bravos (v)", desc: "Fried ripe plantains topped with crema fresca" },
  { name: "Camote Enmielado (v)", desc: "Candied sweet potatoes with piloncillo, cinnamon, star anise & red chili" },
];
const SIDES_MODAL_OPTIONS = SIDES_META.map((m) => (m.desc ? `${m.name} — ${m.desc}` : m.name));
const modalToSideName = new Map(SIDES_MODAL_OPTIONS.map((lbl) => [lbl, lbl.split(" — ")[0]]));

/* ====================== FIXED RULES FOR RUBI (no tiers) ====================== */
const RULES = {
  passed: 2,
  startersOrSoup: 1,
  entrees: 1,
  sides: 3,
  desserts: 0, // 🚫 no desserts in this flow
};

type ModalKey = "passed" | "startersOrSoup" | "entrees" | "sides" | null;

const RubiMexMenuBuilder: React.FC<Props> = ({
  selections,
  setSelections,
  onContinue,
  onBack,
  onClose,
}) => {
  const [localSel, setLocalSel] = useState<RubiMexSelections>(selections);
  const [show, setShow] = useState<ModalKey>(null);

  // draft state for entrée modal
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

  const maxPassed = RULES.passed;
  const maxEntrees = RULES.entrees;
  const maxSides = RULES.sides;
  const startersSoupCount = RULES.startersOrSoup; // always 1 here

  const getBaseName = (s: string) => s.split(" — ")[0];

  const formatForDisplayCard = (raw: string): string => {
    const [base, rest] = raw.split(" — ");
    if (!rest) return base;
    const isChoiceShort = rest.length <= 40 && !rest.includes(",");
    return isChoiceShort ? `${base} — ${rest}` : base;
  };

  // inline variant setter (Caramelos, beef subs)
  const withSuffix = (base: string, suffix?: string) => (suffix ? `${base} — ${suffix}` : base);
  const setInlineVariant = (
    listKey: keyof RubiMexSelections,
    baseName: string,
    variant: string | boolean
  ) => {
    setLocalSel((prev) => {
      const list = prev[listKey] as string[];
      const idx = list.findIndex((x) => getBaseName(x) === baseName);
      if (idx === -1) return prev;

      const suffix = typeof variant === "string" ? variant : variant ? "Substitute with beef" : "";
      const updated = [...list];
      updated[idx] = withSuffix(baseName, suffix || undefined);
      return { ...prev, [listKey]: updated } as RubiMexSelections;
    });
  };

  /* ---------- Passed Apps ---------- */
  const updatePassed = (modalLabels: string[]) => {
    const names = modalLabels.map((lbl) => modalToPassedName.get(lbl) || lbl.split(" — ")[0]);
    setLocalSel((p) => ({ ...p, mexPassedApps: names.slice(0, maxPassed) }));
  };

  /* ---------- Starter OR Soup (pick 1 total) ---------- */
  const updateStarterOrSoup = (pickedModalLabels: string[]) => {
    const base = pickedModalLabels[0] || "";
    const nameOnly =
      startersNameToModal.get(base) ||
      SOUPS_MODAL_OPTIONS.find((x) => x.startsWith(base)) ||
      base;
    const clean = (nameOnly || "").split(" — ")[0];
    setLocalSel((p) => ({ ...p, mexStartersOrSoup: clean ? [clean] : [] }));
  };

  /* ---------- Entrees (with taco fillings) ---------- */
  const getStoredTacoFillings = (): string[] => {
    const tacoRow = localSel.mexEntrees.find((e) => e.startsWith(STREET_TACO_LABEL));
    if (!tacoRow) return [];
    const parts = tacoRow.split(" — ");
    if (parts.length < 2) return [];
    return parts[1].split(",").map((p) => p.trim()).filter(Boolean).slice(0, 2);
  };

  const openEntreesModal = () => {
    setEntreeDraft(localSel.mexEntrees.map((e) => getBaseName(e)));
    setTacoFillingsDraft(getStoredTacoFillings());
    setShow("entrees");
  };

  const finalizeEntreesFromModal = (sel: string[]) => {
    const pickedBaseNames = sel.map((lbl) => modalToEntreeName.get(lbl) || lbl.split(" — ")[0]);
    const nextPretty = pickedBaseNames.map((name) => {
      if (name === STREET_TACO_LABEL) {
        return tacoFillingsDraft.length
          ? `${STREET_TACO_LABEL} — ${tacoFillingsDraft.join(", ")}`
          : STREET_TACO_LABEL;
      }
      return name;
    });
    setLocalSel((prev) => ({ ...prev, mexEntrees: nextPretty.slice(0, maxEntrees) }));
  };

  const toggleTacoFillingDraft = (fill: string) => {
    setTacoFillingsDraft((prev) => {
      if (prev.includes(fill)) return prev.filter((f) => f !== fill);
      if (prev.length >= 2) return [prev[0], fill];
      return [...prev, fill];
    });
  };

  /* ---------- Sides ---------- */
  const updateSides = (pickedModalLabels: string[]) => {
    const cleaned = pickedModalLabels.map(
      (lbl) => modalToSideName.get(lbl) || lbl.split(" — ")[0]
    );
    setLocalSel((p) => ({ ...p, mexSides: cleaned.slice(0, maxSides) }));
  };

  /* ---------- derived for inline UI ---------- */
  const selectedPassedNames = useMemo(
    () => localSel.mexPassedApps.map(getBaseName),
    [localSel.mexPassedApps]
  );
  const selectedEntreeNames = useMemo(
    () => localSel.mexEntrees.map(getBaseName),
    [localSel.mexEntrees]
  );

  /* ---------- Continue gate ---------- */
  const canContinue =
    localSel.mexPassedApps.length >= maxPassed &&
    localSel.mexStartersOrSoup.length >= 1 &&
    localSel.mexEntrees.length >= maxEntrees &&
    localSel.mexSides.length >= maxSides;

  /* ========================== RENDER ========================== */
  return (
    <div className="pixie-card wd-page-turn" style={{ maxWidth: 780, margin: "0 auto" }}>
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2 style={{ ...jsLine, fontSize: "2.2rem", marginBottom: 6 }}>Build Your Mexican Fiesta!</h2>
        <p className="px-prose-narrow" style={{ margin: "0 auto 10px", maxWidth: 520 }}>
          Tap a banner to choose items for each category.
        </p>

        <img src={IMG.pig} alt="Piglet Chef" className="px-media" style={{ width: 140, margin: "6px auto 18px" }} />

        {/* Passed Apps (select 2) */}
        <div style={{ marginBottom: 22 }}>
          <img
            src={IMG.passed}
            alt="Passed Appetizers"
            onClick={() => setShow("passed")}
            style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
          />
          {localSel.mexPassedApps.map((t) => (
            <div key={t} onClick={() => setShow("passed")} style={{ ...jsLine, fontSize: "2.1rem", marginBottom: 10, cursor: "pointer" }}>
              {formatForDisplayCard(t)}
            </div>
          ))}

          {/* inline variant radios when an item with variants is chosen */}
          <div className="px-prose-narrow" style={{ maxWidth: 640, margin: "0 auto" }}>
            {PASSED_META.map((m) =>
              m.variants && selectedPassedNames.includes(m.name) ? (
                <div key={m.name} style={{ margin: "6px 0 12px", textAlign: "left" }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{m.name} — choose one:</div>
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
              ) : null
            )}
          </div>
        </div>

        {/* Starter OR Soup (select 1 total) */}
        <div style={{ marginBottom: 22 }}>
          <img
            src={IMG.startersOrSoup}
            alt="Starter or Soup"
            onClick={() => setShow("startersOrSoup")}
            style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
          />
          {localSel.mexStartersOrSoup.map((t) => (
            <div key={t} onClick={() => setShow("startersOrSoup")} style={{ ...jsLine, fontSize: "2.1rem", marginBottom: 10, cursor: "pointer" }}>
              {formatForDisplayCard(t)}
            </div>
          ))}

          {/* Caramelos inline variant when chosen */}
          {localSel.mexStartersOrSoup.some((v) => getBaseName(v) === "Caramelos") && (
            <div className="px-prose-narrow" style={{ maxWidth: 640, margin: "8px auto 0", textAlign: "left" }}>
              <div style={{ fontWeight: 600, marginBottom: 6, fontSize: ".95rem" }}>Caramelos — choose one:</div>
              {["Carne Asada", "Pork Carnitas", "Chorizo"].map((opt) => (
                <label key={opt} style={{ marginRight: 14, display: "inline-flex", alignItems: "center", fontSize: ".9rem" }}>
                  <input
                    type="radio"
                    name="caramelos-variant-inline"
                    checked={localSel.mexStartersOrSoup.find((x) => getBaseName(x) === "Caramelos")?.includes(opt) || false}
                    onChange={() =>
                      setLocalSel((prev) => {
                        const updated = prev.mexStartersOrSoup.map((x) =>
                          getBaseName(x) === "Caramelos" ? `Caramelos — ${opt}` : x
                        );
                        return { ...prev, mexStartersOrSoup: updated };
                      })
                    }
                    style={{ marginRight: 6 }}
                  />
                  {opt}
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Entrées (select 1) */}
        <div style={{ marginBottom: 22 }}>
          <img
            src={IMG.entrees}
            alt="Entrées"
            onClick={openEntreesModal}
            style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
          />
          {localSel.mexEntrees.map((t) => (
            <div key={t} onClick={openEntreesModal} style={{ ...jsLine, fontSize: "2.1rem", marginBottom: 10, cursor: "pointer" }}>
              {formatForDisplayCard(t)}
            </div>
          ))}

          {/* Beef substitute checkboxes for Birria / Barbacoa */}
          <div className="px-prose-narrow" style={{ maxWidth: 640, margin: "6px auto 0" }}>
            {["Birria de Chivo", "Barbacoa de Borrego"].map(
              (name) =>
                selectedEntreeNames.includes(name) && (
                  <label key={name} style={{ display: "block", textAlign: "left", marginTop: 8 }}>
                    <input
                      type="checkbox"
                      checked={
                        !!localSel.mexEntrees.find(
                          (x) => getBaseName(x) === name && x.includes("Substitute with beef")
                        )
                      }
                      onChange={(e) => setInlineVariant("mexEntrees", name, e.target.checked)}
                      style={{ marginRight: 8 }}
                    />
                    {name}: Substitute with beef
                  </label>
                )
            )}
          </div>
        </div>

        {/* Sides (select 3) */}
        <div style={{ marginBottom: 22 }}>
          <img
            src={IMG.sides}
            alt="Sides"
            onClick={() => setShow("sides")}
            style={{ width: 260, display: "block", margin: "0 auto 6px", cursor: "pointer" }}
          />
          {localSel.mexSides.map((t) => (
            <div key={t} onClick={() => setShow("sides")} style={{ ...jsLine, fontSize: "2.1rem", marginBottom: 10, cursor: "pointer" }}>
              {formatForDisplayCard(t)}
            </div>
          ))}
        </div>

        {/* CTA */}
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

      {/* ---------------- MODALS ---------------- */}

      {/* Passed Apps (2) */}
      {show === "passed" && (
        <SelectionModal
          title={`Passed Appetizers — select ${maxPassed}`}
          options={PASSED_MODAL_OPTIONS}
          max={maxPassed}
          selected={localSel.mexPassedApps
            .map((s) => passedNameToModal.get(getBaseName(s)) || getBaseName(s))
            .slice(0, maxPassed)}
          onChange={(sel) => {
            updatePassed(sel);
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {/* Starter OR Soup (1 total) */}
      {show === "startersOrSoup" && (
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
            updateStarterOrSoup(sel);
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}

      {/* Entrées (1) with taco fillings child UI */}
      {show === "entrees" && (
        <SelectionModal
          title={`Entrées — select ${maxEntrees}`}
          options={ENTREES_MODAL_OPTIONS}
          max={maxEntrees}
          selected={entreeDraft.map((base) => ENTREES_MODAL_OPTIONS.find((x) => x.startsWith(base)) || base)}
          liveSelections={entreeDraft.map((base) => ENTREES_MODAL_OPTIONS.find((x) => x.startsWith(base)) || base)}
          onLiveChange={(nextWithDesc) => {
            const bases = nextWithDesc.map((lbl) => modalToEntreeName.get(lbl) || lbl.split(" — ")[0]);
            setEntreeDraft(bases);
            if (!bases.includes(STREET_TACO_LABEL)) setTacoFillingsDraft([]);
          }}
          onChange={(finalWithDesc) => {
            const bases = finalWithDesc.map((lbl) => modalToEntreeName.get(lbl) || lbl.split(" — ")[0]);
            const finalSaved = bases.map((name) =>
              name === STREET_TACO_LABEL && tacoFillingsDraft.length
                ? `${STREET_TACO_LABEL} — ${tacoFillingsDraft.join(", ")}`
                : name
            );
            setLocalSel((prev) => ({ ...prev, mexEntrees: finalSaved.slice(0, maxEntrees) }));
            setShow(null);
          }}
          onClose={() => setShow(null)}
        >
          {entreeDraft.includes(STREET_TACO_LABEL) && (
            <div>
              <div style={{ fontWeight: 600, marginBottom: 8, fontSize: ".95rem", color: "#2c62ba" }}>
                {STREET_TACO_LABEL} fillings — choose up to 2
              </div>
              <div style={{ display: "flex", flexDirection: "column", rowGap: 6, fontSize: ".9rem" }}>
                {TACO_FILLINGS.map((f) => {
                  const checked = tacoFillingsDraft.includes(f.name);
                  const disabled = !checked && tacoFillingsDraft.length >= 2;
                  return (
                    <label key={f.name} style={{ display: "flex", alignItems: "flex-start", gap: 6, opacity: disabled ? 0.5 : 1 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={disabled}
                        onChange={() => toggleTacoFillingDraft(f.name)}
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

      {/* Sides (3) */}
      {show === "sides" && (
        <SelectionModal
          title={`Sides — select ${maxSides}`}
          options={SIDES_MODAL_OPTIONS}
          max={maxSides}
          selected={localSel.mexSides.map((sideName) => {
            const match = SIDES_META.find((m) => m.name === sideName);
            return match ? (match.desc ? `${match.name} — ${match.desc}` : match.name) : sideName;
          })}
          onChange={(pickedModalLabels) => {
            updateSides(pickedModalLabels);
            setShow(null);
          }}
          onClose={() => setShow(null)}
        />
      )}
    </div>
  );
};

export default RubiMexMenuBuilder;