import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

const FLORAL_LS_PREFS_KEY = "floralSelections";

const arrangements = [
  {
    label: "Airy Garden Style",
    image: `${import.meta.env.BASE_URL}assets/images/garden_style.jpg`,
  },
  {
    label: "Bud Vase Clusters",
    image: `${import.meta.env.BASE_URL}assets/images/bud_vases.jpg`,
  },
  {
    label: "Pave Arrangement",
    image: `${import.meta.env.BASE_URL}assets/images/pave.jpg`,
  },
];

interface TableArrangementPickerProps {
  onContinue: (arrangementName: string) => void;
  onBack: () => void; // ✅ NEW: go back to palette
  onClose: () => void; // pink X
}

const TableArrangementPicker: React.FC<TableArrangementPickerProps> = ({
  onContinue,
  onBack,
  onClose,
}) => {
  const [selectedArrangement, setSelectedArrangement] = useState<string | null>(
    null
  );

  // ✅ Restore saved selection (guest + logged-in)
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FLORAL_LS_PREFS_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (typeof parsed?.selectedArrangement === "string") {
        setSelectedArrangement(parsed.selectedArrangement);
      }
    } catch {
      // ignore
    }
  }, []);

  // ✅ Persist selection whenever it changes
  useEffect(() => {
    if (!selectedArrangement) return;
    try {
      const raw = localStorage.getItem(FLORAL_LS_PREFS_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        FLORAL_LS_PREFS_KEY,
        JSON.stringify({ ...prev, selectedArrangement })
      );
    } catch {
      // ignore
    }
  }, [selectedArrangement]);

  const handleSaveAndContinue = async () => {
    if (!selectedArrangement) {
      alert("Please choose a table arrangement before continuing!");
      return;
    }

    // ✅ Always save local progress step for consistency
    try {
      const raw = localStorage.getItem(FLORAL_LS_PREFS_KEY);
      const prev = raw ? JSON.parse(raw) : {};
      localStorage.setItem(
        FLORAL_LS_PREFS_KEY,
        JSON.stringify({ ...prev, selectedArrangement })
      );
      localStorage.setItem("floralSavedStep", "cart"); // helps guest resume
    } catch {
      // ignore
    }

    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      console.warn("👻 Guest mode: skipping Firestore save");
      onContinue(selectedArrangement);
      return;
    }

    try {
      await setDoc(
        doc(db, "users", user.uid),
        {
          tableArrangement: selectedArrangement,
          floralProgress: "cart",
        },
        { merge: true }
      );
      onContinue(selectedArrangement);
    } catch (error) {
      console.error("❌ Error saving table arrangement:", error);
      // still let them proceed (local already saved)
      onContinue(selectedArrangement);
    }
  };

  return (
    <div className="pixie-card wd-page-turn">
      {/* 🔸 Pink X close */}
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

      {/* ---------- Body ---------- */}
      <div className="pixie-card__body">
        <h2 className="px-title-lg" style={{ marginBottom: "8px" }}>
          Pick your table style!
        </h2>
        <p className="px-prose-narrow" style={{ marginBottom: "1.25rem" }}>
          What type of design do you want your floral artist to use for your
          table flowers?
        </p>

        {/* Arrangement options grid */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "2rem",
            flexWrap: "wrap",
            marginBottom: "2rem",
          }}
        >
          {arrangements.map((arrangement) => (
            <button
              key={arrangement.label}
              onClick={() => setSelectedArrangement(arrangement.label)}
              style={{
                backgroundColor: "#fff",
                color: "#2c62ba",
                border: "none",
                borderRadius: "12px",
                padding: "1rem",
                width: "220px",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.3s ease",
                boxShadow:
                  selectedArrangement === arrangement.label
                    ? "0 0 20px 5px rgba(44, 98, 186, 0.6)"
                    : "none",
              }}
            >
              <img
                src={arrangement.image}
                alt={arrangement.label}
                style={{
                  width: "100%",
                  height: "auto",
                  maxHeight: "200px",
                  objectFit: "contain",
                  borderRadius: "10px",
                  marginBottom: "1rem",
                }}
              />
              <div style={{ marginTop: "0.5rem" }}>{arrangement.label}</div>
            </button>
          ))}
        </div>

        <div className="px-cta-col">
  <button
    className="boutique-primary-btn"
    onClick={handleSaveAndContinue}
    disabled={!selectedArrangement}
  >
    Continue
  </button>

  <button
  type="button"
  className="boutique-back-btn"
  onClick={() => {
    try {
      localStorage.setItem("floralSavedStep", "palette");
    } catch {}
    onBack();
  }}
>
  ← Back
</button>
</div>
</div>
    </div>
  );
};

export default TableArrangementPicker;