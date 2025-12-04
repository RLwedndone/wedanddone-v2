// src/components/NewYumBuild/catering/YumCuisineSelectorCatering.tsx
import React, { useEffect } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";

interface YumCuisineSelectorCateringProps {
  selectedCuisine: string | null;
  setSelectedCuisine: (val: string) => void;
  onNext: () => void;
  onBack: () => void;
  onClose?: () => void;

  // 👇 new
  tier: "signature" | "chef";
}

const cuisines = [
  {
    key: "italian",
    label: "Italian Bounty",
    image: `${import.meta.env.BASE_URL}assets/images/YumYum/ItalianIcon.png`,
    description:
      "Rustic pastas, grilled proteins, fresh salads, and comforting Italian-inspired sides.",
  },
  {
    key: "american",
    label: "Classic American",
    image: `${import.meta.env.BASE_URL}assets/images/YumYum/americanIcon.png`,
    description:
      "Comfort-driven American favorites featuring hearty mains, crisp salads, and timeless sides.",
  },
  {
    key: "mexican",
    label: "Mexican Fiesta",
    image: `${import.meta.env.BASE_URL}assets/images/YumYum/mexicanIcon.png`,
    description:
      "A vibrant spread with tacos, flavorful entrées, fresh greens, and bold, spice-forward sides.",
  },
  {
    key: "taco",
    label: "Taco Bar",
    image: `${import.meta.env.BASE_URL}assets/images/YumYum/tacoBar.png`,
    description:
      "A customizable taco experience with meats, toppings, salads, and sides for the perfect build-your-own feast.",
  },
];

const YumCuisineSelectorCatering: React.FC<YumCuisineSelectorCateringProps> = ({
  selectedCuisine,
  setSelectedCuisine,
  onNext,
  onBack,
  onClose,
  tier,
}) => {
  const auth = getAuth();

  // ✅ Save cuisine when it changes
  useEffect(() => {
    if (!selectedCuisine) return;

    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // store cuisine choice under /users/{uid}/yumYumData/cuisineSelection
          const cuisineRef = doc(
            db,
            "users",
            user.uid,
            "yumYumData",
            "cuisineSelection"
          );
          await setDoc(
            cuisineRef,
            { selectedCuisine },
            { merge: true }
          );

          // also write lightweight progress marker
          const progressRef = doc(db, "users", user.uid);
          await setDoc(
            progressRef,
            { progress: { yumYum: { step: "cuisine" } } },
            { merge: true }
          );
        } catch (err) {
          console.error("❌ Error saving cuisine:", err);
        }
      } else {
        // guest path: stash locally
        try {
          localStorage.setItem("yumSelectedCuisine", selectedCuisine);
          localStorage.setItem("yumStep", "cuisine");
        } catch {
          /* ignore */
        }
      }
    });

    return () => unsub();
  }, [auth, selectedCuisine]);

  // ✅ Clear previous menu picks when switching cuisines, then set the cuisine
  const handleSelectCuisine = async (key: string) => {
    if (selectedCuisine !== key) {
      // nuke prior menuSelections so it doesn't carry forward
      try {
        localStorage.removeItem("yumMenuSelections");
      } catch {
        /* ignore */
      }

      const user = getAuth().currentUser;
      if (user) {
        try {
          const ref = doc(
            db,
            "users",
            user.uid,
            "yumYumData",
            "menuSelections"
          );
          await setDoc(
            ref,
            {
              // 🔄 match new shape: mains / sides / salads only
              mains: [],
              sides: [],
              salads: [],
            },
            { merge: true }
          );
        } catch (e) {
          console.warn("Could not clear menuSelections in Firestore:", e);
        }
      }
    }

    setSelectedCuisine(key);
    try {
      localStorage.setItem("yumSelectedCuisine", key);
    } catch {
      /* ignore */
    }
  };

  // 🔎 Filter cuisines based on tier
  const visibleCuisines = cuisines.filter((c) =>
    tier === "signature" ? true : c.key !== "taco"
  );

  return (
    <div
      className="pixie-card pixie-card--modal"
      style={{ maxWidth: 560 }}
    >
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

      <div
        className="pixie-card__body"
        style={{ textAlign: "center" }}
      >
        <h2
          className="px-title-lg"
          style={{ marginBottom: "0.75rem" }}
        >
          Choose Your Cuisine
        </h2>

        {/* If you want to kill this helper copy, just delete this <p> */}
        <p
          className="px-prose-narrow"
          style={{ marginBottom: "1.5rem" }}
        >
          Select one of our delicious menu cuisines below — next you can customize your menu!
        </p>

        {/* Vertical stack of cuisine cards */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "1.25rem",
            width: "100%",
            maxWidth: "420px",
            margin: "0 auto",
          }}
        >
          {visibleCuisines.map((c) => {
            const isActive = selectedCuisine === c.key;
            return (
              <div
                key={c.key}
                onClick={() => handleSelectCuisine(c.key)}
                style={{
                  width: "100%",
                  background: "#fff",
                  borderRadius: "14px",
                  boxShadow: isActive
                    ? "0 0 28px 10px rgba(70, 140, 255, 0.65)"
                    : "0 2px 8px rgba(0,0,0,0.08)",
                  cursor: "pointer",
                  transition:
                    "box-shadow 0.2s ease, transform 0.2s ease",
                  padding: "0.5rem 0.75rem 1rem",
                  position: "relative",
                }}
              >
                <img
                  src={c.image}
                  alt={c.label}
                  style={{
                    width: "90%",
                    maxWidth: "320px",
                    height: "auto",
                    borderRadius: "10px",
                    display: "block",
                    margin: "0.5rem auto 0.75rem",
                  }}
                />

                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "1.05rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  {c.label}
                </div>

                <div
                  style={{
                    fontSize: "0.92rem",
                    color: "#555",
                    lineHeight: 1.45,
                    maxWidth: "90%",
                    margin: "0 auto",
                  }}
                >
                  {c.description}
                </div>
              </div>
            );
          })}
        </div>

        <div
          className="px-cta-col"
          style={{ marginTop: "2rem" }}
        >
          <button
            className="boutique-primary-btn"
            onClick={onNext}
            disabled={!selectedCuisine}
            aria-disabled={!selectedCuisine}
          >
            Continue
          </button>

          <button
            className="boutique-back-btn"
            onClick={onBack}
          >
            ← Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default YumCuisineSelectorCatering;