// src/components/NewYumBuild/catering/YumMenuBuilderCatering.tsx
import React, { useState, useEffect } from "react";
import SelectionModal from "../shared/SelectionModal";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";

// 🔹 Santi config + cuisine key + item type
import {
  santisMenuConfig,
  SantiCuisineKey,
  SantiMenuItem,
} from "./santisMenuConfig";

interface YumMenuBuilderCateringProps {
  selectedCuisine: SantiCuisineKey | null;
  menuSelections: {
    mains: string[];
    sides: string[];
    salads: string[];
  };
  setMenuSelections: (data: {
    mains: string[];
    sides: string[];
    salads: string[];
  }) => void;
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
  tier: "signature" | "chef";
}



const YumMenuBuilderCatering: React.FC<YumMenuBuilderCateringProps> = ({
  tier,
  selectedCuisine,
  menuSelections,
  setMenuSelections,
  onContinue,
  onBack,
  onClose,
}) => {
  console.log("🧪 YumMenuBuilderCatering mounted");
  console.log("🍽️ selectedCuisine:", selectedCuisine, "tier:", tier);

  const [showModal, setShowModal] =
    useState<"mains" | "sides" | "salads" | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // ───────────────── Restore from Firestore / localStorage ─────────────────
  useEffect(() => {
    const auth = getAuth();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const docRef = doc(
            db,
            "users",
            user.uid,
            "yumYumData",
            "menuSelections"
          );
          const snap = await getDoc(docRef);
          if (snap.exists()) {
            const saved = snap.data();
            if (saved?.mains || saved?.sides || saved?.salads) {
              setMenuSelections({
                mains: saved.mains || [],
                sides: saved.sides || [],
                salads: saved.salads || [],
              });
              return; // ✅ Skip localStorage if Firestore has data
            }
          }
        } catch (error) {
          console.error("❌ Error fetching menuSelections:", error);
        }
      }

      // 👤 Guest or no Firestore data → fallback to LS
      const local = localStorage.getItem("yumMenuSelections");
      if (local) {
        try {
          const parsed = JSON.parse(local);
          setMenuSelections({
            mains: parsed.mains || [],
            sides: parsed.sides || [],
            salads: parsed.salads || [],
          });
        } catch {
          /* ignore bad JSON */
        }
      }
    });

    return () => unsubscribe();
  }, [setMenuSelections]);

  // ───────────────── Save helper ─────────────────
  const saveSelections = (next: {
    mains: string[];
    sides: string[];
    salads: string[];
  }) => {
    setMenuSelections(next);

    // LS – always
    try {
      localStorage.setItem("yumMenuSelections", JSON.stringify(next));
      localStorage.setItem("yumStep", "cateringMenu");
    } catch {}

    // Firestore – if logged in
    onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      try {
        const docRef = doc(
          db,
          "users",
          user.uid,
          "yumYumData",
          "menuSelections"
        );
        await setDoc(docRef, next, { merge: true });

        const progressRef = doc(db, "users", user.uid);
        await setDoc(
          progressRef,
          {
            progress: {
              yumYum: {
                step: "cateringMenu",
              },
            },
          },
          { merge: true }
        );
      } catch (error) {
        console.error("❌ Error saving menu selections:", error);
      }
    });
  };

  const handleModalClose = (
    type: "mains" | "sides" | "salads",
    selections: string[]
  ) => {
    const next = {
      ...menuSelections,
      [type]: selections,
    };
    saveSelections(next);
    setShowModal(null);
  };

    // ───────────────── Guard: need valid cuisine ─────────────────
if (!selectedCuisine) {
  console.log("🚫 No cuisine selected for Santi menu");
  return null;
}

// 👉 pull the real cuisine out of santisMenuConfig
const cuisine = santisMenuConfig.cuisines[selectedCuisine];
if (!cuisine) {
  console.log("🚫 No Santi cuisine config for:", selectedCuisine);
  return null;
}

// how many picks this tier gets (from allowances)
const isTacoCuisine = selectedCuisine === "taco";

// how many picks this tier gets (from allowances)
const entreeMax =
  isTacoCuisine && tier === "signature"
    ? 3 // 🌮 special case: Taco Bar Signature gets 3 meats
    : santisMenuConfig.allowances[tier].entrees;

const sideMax = santisMenuConfig.allowances[tier].sides;
const saladMax = santisMenuConfig.allowances[tier].salads;

// actual menu items for this cuisine
const entreeItems = cuisine.entrees;
const sideItems   = cuisine.sides;
const saladItems  = cuisine.salads;

// modal just wants strings – use the dish name so cart can match upgrades
const mapToOptions = (items: SantiMenuItem[]) =>
  items.map((item) => item.name);

  return (
    <div
      className="pixie-card pixie-card--modal"
      style={{ maxWidth: 560, position: "relative" }}
    >
      {/* Close (Floral-style) */}
      <button
        className="pixie-card__close"
        aria-label="Close"
        onClick={onClose}
      >
        <img
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
        />
      </button>

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <h2
          style={{
            fontFamily: "'Jenna Sue', cursive",
            fontSize: "2.2rem",
            color: "#2c62ba",
            textAlign: "center",
          }}
        >
          Make your menu selections!
        </h2>

        <img
          src={`${import.meta.env.BASE_URL}assets/images/YumYum/piglet1.png`}
          alt="Piglet Chef"
          style={{ width: "160px", margin: "0 auto 30px", display: "block" }}
        />

        {/* ─────────── Three sections: mains, sides, salads ─────────── */}
        {(["mains", "sides", "salads"] as const).map((type) => {
  const label =
    type === "mains"
      ? (isTacoCuisine ? "Meats" : "Entrées")
      : type === "sides"
      ? "Sides"
      : "Salads";

          // 🎨 Use specific banner images per section
          const bannerSrc =
          type === "mains"
            ? (
                isTacoCuisine
                  ? `${import.meta.env.BASE_URL}assets/images/YumYum/Rubi/meats.png`
                  : `${import.meta.env.BASE_URL}assets/images/YumYum/Entrees.png`
              )
            : type === "sides"
            ? `${import.meta.env.BASE_URL}assets/images/YumYum/sides.png`
            : `${import.meta.env.BASE_URL}assets/images/YumYum/salads_yellow.png`;

          return (
            <div
              key={type}
              style={{ textAlign: "center", marginBottom: "2rem" }}
            >
              <img
  src={bannerSrc}
  alt={label}
  onClick={() => setShowModal(type)}
  onMouseEnter={() => setHovered(type)}
  onMouseLeave={() => setHovered(null)}
  style={{
    width: "260px",
    cursor: "pointer",
    transition: "transform 0.3s ease",
    transform: hovered === type ? "scale(1.05)" : "scale(1)",
  }}
/>

              {menuSelections[type].map((item) => (
                <div
                  key={item}
                  onClick={() => setShowModal(type)}
                  style={{
                    fontFamily: "'Jenna Sue', cursive",
                    fontSize: "2rem",
                    color: "#2c62ba",
                    cursor: "pointer",
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          );
        })}

        {/* ─────────── Bottom Buttons (stacked layout) ─────────── */}
        <div
          style={{
            marginTop: "2rem",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <button
            className="boutique-primary-btn"
            onClick={() => {
              localStorage.setItem("yumStep", "cateringCart");
              onContinue();
            }}
            style={{ width: "250px" }}
          >
            Continue
          </button>

          <button
            className="boutique-back-btn"
            onClick={onBack}
            style={{ width: "250px" }}
          >
            Back
          </button>
        </div>
      </div>

            {/* ─────────── Modals ─────────── */}

      {/* MAINS (ENTRÉES) – show name, description, and upgrade fee */}
      {showModal === "mains" && (
        <SelectionModal
        title={
          isTacoCuisine
            ? `Select up to ${entreeMax} meat(s)`
            : `Select up to ${entreeMax} entree(s)`
        }
          options={mapToOptions(entreeItems)}
          max={entreeMax}
          selected={menuSelections.mains}
          onChange={(selections) => handleModalClose("mains", selections)}
          onClose={() => setShowModal(null)}
          renderOption={({ option, selected, setSelected, disabled }) => {
            const item = entreeItems.find((i) => i.name === option);
            if (!item) return null;

            const isChecked = selected.includes(option);

            const handleToggle = () => {
              if (disabled) return;
              const next = isChecked
                ? selected.filter((s) => s !== option)
                : selected.length < entreeMax
                ? [...selected, option]
                : selected;
              setSelected(next);
            };

            return (
              <label
                key={option}
                style={{
                  display: "block",
                  padding: "0.75rem 0",
                  borderBottom: "1px solid #eee",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.5rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={disabled}
                    onChange={handleToggle}
                    style={{ marginTop: "0.2rem" }}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {item.name}
                      {item.upgradeFeePerGuest && (
                        <span
                          style={{
                            marginLeft: "0.5rem",
                            color: "#2c62ba",
                            fontSize: "0.9rem",
                          }}
                        >
                          +${item.upgradeFeePerGuest} per guest
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <div
                        style={{
                          fontSize: "0.9rem",
                          color: "#555",
                          marginTop: "0.25rem",
                        }}
                      >
                        {item.description}
                      </div>
                    )}
                  </div>
                </div>
              </label>
            );
          }}
        />
      )}

      {/* SIDES – name only, no descriptions */}
      {showModal === "sides" && (
        <SelectionModal
          title={`Select up to ${sideMax} side(s)`}
          options={mapToOptions(sideItems)}
          max={sideMax}
          selected={menuSelections.sides}
          onChange={(selections) => handleModalClose("sides", selections)}
          onClose={() => setShowModal(null)}
        />
      )}

      {/* SALADS – name + description, no upgrade fee */}
      {showModal === "salads" && (
        <SelectionModal
          title={`Select up to ${saladMax} salad(s)`}
          options={mapToOptions(saladItems)}
          max={saladMax}
          selected={menuSelections.salads}
          onChange={(selections) => handleModalClose("salads", selections)}
          onClose={() => setShowModal(null)}
          renderOption={({ option, selected, setSelected, disabled }) => {
            const item = saladItems.find((i) => i.name === option);
            if (!item) return null;

            const isChecked = selected.includes(option);

            const handleToggle = () => {
              if (disabled) return;
              const next = isChecked
                ? selected.filter((s) => s !== option)
                : selected.length < saladMax
                ? [...selected, option]
                : selected;
              setSelected(next);
            };

            return (
              <label
                key={option}
                style={{
                  display: "block",
                  padding: "0.75rem 0",
                  borderBottom: "1px solid #eee",
                  cursor: disabled ? "not-allowed" : "pointer",
                  opacity: disabled ? 0.5 : 1,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "0.5rem",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled={disabled}
                    onChange={handleToggle}
                    style={{ marginTop: "0.2rem" }}
                  />
                  <div>
                    <div style={{ fontWeight: 600 }}>{item.name}</div>
                    {item.description && (
                      <div
                        style={{
                          fontSize: "0.9rem",
                          color: "#555",
                          marginTop: "0.25rem",
                        }}
                      >
                        {item.description}
                      </div>
                    )}
                  </div>
                </div>
              </label>
            );
          }}
        />
      )}
    </div>
  );
};

export default YumMenuBuilderCatering;