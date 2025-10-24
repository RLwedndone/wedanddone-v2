import React, { useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

const arrangements = [
  { label: "Airy Garden Style", image: "/assets/images/garden_style.jpg" },
  { label: "Bud Vase Clusters", image: "/assets/images/bud_vases.jpg" },
  { label: "Pave Arrangement", image: "/assets/images/pave.jpg" },
];

interface TableArrangementPickerProps {
  onContinue: (arrangementName: string) => void;
  onClose: () => void; // 👈 added for the pink X
}

const TableArrangementPicker: React.FC<TableArrangementPickerProps> = ({
  onContinue,
  onClose,
}) => {
  const [selectedArrangement, setSelectedArrangement] = useState<string | null>(null);

  const handleSaveAndContinue = async () => {
    if (!selectedArrangement) {
      alert("Please choose a table arrangement before continuing!");
      return;
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
        { tableArrangement: selectedArrangement, floralProgress: "cart" },
        { merge: true }
      );
      onContinue(selectedArrangement);
    } catch (error) {
      console.error("❌ Error saving table arrangement:", error);
    }
  };

  return (
    <div className="pixie-card">
      {/* 🔸 Pink X close */}
      <button
        className="pixie-card__close"
        onClick={onClose}
        aria-label="Close"
      >
        <img src="/assets/icons/pink_ex.png" alt="Close" />
      </button>

      {/* ---------- Body ---------- */}
      <div className="pixie-card__body">
        <h2 className="px-title-lg" style={{ marginBottom: "8px" }}>
          Pick your table style!
        </h2>
        <p className="px-prose-narrow" style={{ marginBottom: "1.25rem" }}>
          What type of design do you want your floral artist to use for your table flowers?
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

        {/* Continue CTA */}
        <button
          className="boutique-primary-btn"
          onClick={handleSaveAndContinue}
          disabled={!selectedArrangement}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default TableArrangementPicker;