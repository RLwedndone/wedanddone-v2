// src/components/NewYumBuild/CustomVenues/Bates/BatesMenuBuilderCatering.tsx
import React, { useEffect, useState } from "react";
import SelectionModal from "../../shared/SelectionModal";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

interface BatesMenuSelections {
  hors: string[];    // Butler-Passed Hors d’oeuvres
  salads: string[];  // Salads
  entrees: string[]; // Entrées (2, or 1 “Paired Entrée”)
  isPairedEntree?: boolean; // derived flag
}

interface BatesMenuBuilderProps {
  menuSelections: BatesMenuSelections;
  setMenuSelections: (data: BatesMenuSelections) => void;
  onContinue: () => void; // parent advances to Bates cart
  onBack: () => void;     // parent goes back to Bates intro
  onClose?: () => void;
}

/** Replace these arrays with your real Bates items. */
const batesMenuData = {
  hors: [
    // Butler-Passed Hors d’oeuvres — choose up to 4
    "Tomato Basil Bruschetta",
    "Mini BLTs",
    "Blue Cheese and Fig Compote on Crostinis",
    "Prosciutto, Melon on Focaccia Squares",
    "Mini Pulled Pork Tostada, Shredded Cabbage, Pico de Gallo, Pepper Jack Cheese",
    "Stuffed Crimini Mushroom with Lemon-Herbed Cream Cheese",
    "Thyme and Rosemary Roasted Vegetable Skewers",
    "Saucizijenbroodje Bites - House Ground Pork & Beef Wrapped in Puff Pastry",
    "Warm Vidalia Onion Tartlet",
    "Grilled and Pulled Chicken Quesadillas",
  ],
  salads: [
    // Salads — choose 1
    "House Salad: Mixed Greens, Cherry Tomato, English Cucumber, Shaved Carrots with Shallot Vinaigrette",
    "Caesar Salad: Chopped Romaine Lettuce, Parmesan Cheese, Caesar Dressing",
  ],
  entrees: [
    // Entrées — choose 2 (paired entrée rule supported)
    "Thyme-Roasted Chicken Breast, Mushroom Sauce, Parisienne Potatoes, Green Beans",
    "Slow Braised Beef Short Rib, Ancho Demi Sauce Potato Gratin, Green Beans",
    "Grilled Salmon with Spinach, Lemon Herb Risotto and Beurre Blanc Sauce",
    "Grilled Vegetables in Puff Pastry with Red Bell Pepper Coulis",
    "Surf ‘n’ Turf Flat Iron Steak, Shallot Jus and Grilled Chile-Spiced Jumbo Shrimp with Gratin Potato, Hericot Verts (Paired Entrée)",
  ],
};

// Helper: detect paired entrée
const isPaired = (name: string) =>
  name.toLowerCase().includes("(paired entrée)") ||
  name.toLowerCase().includes("(paired entree)");

const orderedSections: Array<"hors" | "salads" | "entrees"> = ["hors", "salads", "entrees"];

const bannerSrc: Record<"hors" | "salads" | "entrees", string> = {
  hors: `${import.meta.env.BASE_URL}assets/images/YumYum/butlerpassed.png`,
  salads: `${import.meta.env.BASE_URL}assets/images/YumYum/salad.png`,
  entrees: `${import.meta.env.BASE_URL}assets/images/YumYum/Entrees.png`,
};

const titleMap: Record<"hors" | "salads" | "entrees", string> = {
  hors: "Butler-Passed Hors d’oeuvres",
  salads: "Salads",
  entrees: "Entrées",
};

const BatesMenuBuilderCatering: React.FC<BatesMenuBuilderProps> = ({
  menuSelections,
  setMenuSelections,
  onContinue,
  onBack,
  onClose,
}) => {
  const [showModal, setShowModal] = useState<"hors" | "salads" | "entrees" | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);

  // Restore existing selections (Firestore first, else localStorage)
  useEffect(() => {
    const auth = getAuth();

    const unsub = onAuthStateChanged(auth, async (user) => {
      // If already populated, don't overwrite
      const already =
        (menuSelections?.hors?.length ?? 0) > 0 ||
        (menuSelections?.salads?.length ?? 0) > 0 ||
        (menuSelections?.entrees?.length ?? 0) > 0;

      if (user && !already) {
        try {
          const ref = doc(db, "users", user.uid, "yumYumData", "batesMenuSelections");
          const snap = await getDoc(ref);
          if (snap.exists()) {
            const saved = snap.data() as BatesMenuSelections;
            setMenuSelections({
              hors: saved.hors || [],
              salads: saved.salads || [],
              entrees: saved.entrees || [],
              isPairedEntree: !!saved.isPairedEntree,
            });
            return;
          }
        } catch (e) {
          console.error("❌ Error fetching Bates menu selections:", e);
        }
      }

      // Guest or nothing on Firestore → localStorage
      const local = localStorage.getItem("batesMenuSelections");
      if (local && !already) {
        try {
          const parsed = JSON.parse(local) as BatesMenuSelections;
          setMenuSelections({
            hors: parsed.hors || [],
            salads: parsed.salads || [],
            entrees: parsed.entrees || [],
            isPairedEntree: !!parsed.isPairedEntree,
          });
        } catch {
          // ignore bad JSON
        }
      }
    });

    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = async (next: BatesMenuSelections) => {
    try {
      // Local mirror (and consistent step name)
      localStorage.setItem("batesMenuSelections", JSON.stringify(next));
      localStorage.setItem("yumStep", "cateringMenu");

      const user = getAuth().currentUser;
      if (!user) return;

      // Save the selections under a Bates-specific subdoc
      await setDoc(
        doc(db, "users", user.uid, "yumYumData", "batesMenuSelections"),
        next,
        { merge: true }
      );

      // Update progress hint
      await setDoc(
        doc(db, "users", user.uid),
        { progress: { yumYum: { step: "cateringMenu" } } },
        { merge: true }
      );
      // eslint-disable-next-line no-console
      console.log("[BATES][MenuBuilder] selections saved to Firestore:", next);
    } catch (e) {
      console.error("❌ Error saving Bates menu selections:", e);
    }
  };

  const handleModalClose = (
    type: "hors" | "salads" | "entrees",
    selections: string[]
  ) => {
    let next: BatesMenuSelections = { ...menuSelections };

    if (type === "hors") {
      // Max 4 — enforce just in case
      next.hors = selections.slice(0, 4);
    } else if (type === "salads") {
      // Exactly 1 — keep the first if somehow more came back
      next.salads = selections.slice(0, 1);
    } else if (type === "entrees") {
      // Two regular entrées OR one Paired Entrée
      const hasPaired = selections.some(isPaired);
      if (hasPaired) {
        const pairedOnly = selections.find(isPaired);
        next.entrees = pairedOnly ? [pairedOnly] : [];
        next.isPairedEntree = true;
      } else {
        next.entrees = selections.slice(0, 2);
        next.isPairedEntree = false;
      }
    }

    setMenuSelections(next);
    persist(next);
    setShowModal(null);
  };

  const pickedByType = (type: "hors" | "salads" | "entrees") =>
    type === "hors" ? menuSelections.hors : type === "salads" ? menuSelections.salads : menuSelections.entrees;

  // ===================== RENDER =====================
  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 560, position: "relative" }}>
      {/* 🩷 Pink X Close */}
      {onClose && (
        <button className="pixie-card__close" aria-label="Close" onClick={onClose}>
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
        </button>
      )}

<div
  className="pixie-card__body"
  style={{
    textAlign: "center",
    padding: "2rem 2.5rem", // ⬅️ added more white space inside the card
  }}
>
        <h2
          style={{
            fontFamily: "'Jenna Sue', cursive",
            fontSize: "2.2rem",
            color: "#2c62ba",
            textAlign: "center",
            marginBottom: 6,
          }}
        >
          Make your Bates menu selections!
        </h2>

        <img
          src={`${import.meta.env.BASE_URL}assets/images/YumYum/piglet1.png`}
          alt="Piglet Chef"
          style={{ width: 160, margin: "0 auto 24px", display: "block" }}
        />

        {orderedSections.map((type) => {
          const picked = pickedByType(type);
          return (
            <div key={type} style={{ textAlign: "center", marginBottom: "2rem" }}>
              <img
                src={bannerSrc[type]}
                alt={titleMap[type]}
                onClick={() => setShowModal(type)}
                onMouseEnter={() => setHovered(type)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  width: 260,
                  cursor: "pointer",
                  transition: "transform .25s ease",
                  transform: hovered === type ? "scale(1.05)" : "scale(1)",
                  borderRadius: 12,
                }}
              />

              {/* Picked items in Jenna Sue, tappable to reopen modal */}
              {picked.map((item) => (
                <div
                  key={`${type}-${item}`}
                  onClick={() => setShowModal(type)}
                  style={{
                    fontFamily: "'Jenna Sue', cursive",
                    fontSize: "2rem",
                    color: "#2c62ba",
                    cursor: "pointer",
                    marginTop: ".35rem",
                  }}
                >
                  {item}
                </div>
              ))}
            </div>
          );
        })}

        {/* Bottom CTAs (stacked per template) */}
        <div
          style={{
            marginTop: "1.25rem",
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
              onContinue(); // parent overlay will setStep("batesCart")
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

      {/* ─────────────── Modals (unchanged behavior) ─────────────── */}
      {showModal === "hors" && (
        <SelectionModal
          title="Select up to 4 Butler-Passed Hors d’oeuvres"
          options={batesMenuData.hors}
          max={4}
          selected={menuSelections.hors}
          onChange={(selections) => handleModalClose("hors", selections)}
          onClose={() => setShowModal(null)}
        />
      )}

      {showModal === "salads" && (
        <SelectionModal
          title="Select 1 Salad"
          options={batesMenuData.salads}
          max={1}
          selected={menuSelections.salads}
          onChange={(selections) => handleModalClose("salads", selections)}
          onClose={() => setShowModal(null)}
        />
      )}

      {showModal === "entrees" && (
        <SelectionModal
          title="Select 2 Entrées or 1 Paired Entrée"
          options={batesMenuData.entrees}
          max={2} // still 2; normalize via transformOnToggle
          selected={menuSelections.entrees}
          onChange={(selections) => handleModalClose("entrees", selections)}
          onClose={() => setShowModal(null)}
          isDisabled={(option, selections) => {
            const hasPaired = selections.some(isPaired);
            if (hasPaired) return !isPaired(option);
            if (selections.length >= 2 && !selections.includes(option)) return true;
            return false;
          }}
          transformOnToggle={(next) => {
            const paired = next.find(isPaired);
            if (paired) return [paired];
            return next.slice(0, 2);
          }}
        />
      )}
    </div>
  );
};

export default BatesMenuBuilderCatering;