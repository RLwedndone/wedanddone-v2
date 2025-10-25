import React, { useState, useEffect } from "react";

interface TreatTypeModalProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  onClose: () => void;
}

const treatOptions = [
  {
    key: "goodies",
    label: "Goodies Table",
    description:
      "A mix of lemon bars, brownies, cookies, tarts, shooters, and other bite-sized sweets!",
    image: `${import.meta.env.BASE_URL}assets/images/YumYum/goodies_table.png`,
  },
  {
    key: "cupcakes",
    label: "Cupcake Table",
    description:
      "An elegant cupcake table with various flavors, arranged in a tower or tiered layout.",
    image: `${import.meta.env.BASE_URL}assets/images/YumYum/cupcake_table.png`,
  },
];

const TreatTypeModal: React.FC<TreatTypeModalProps> = ({ selected, onChange, onClose }) => {
  const [selectedTreat, setSelectedTreat] = useState<string>(selected[0] || "");

  useEffect(() => {
    if (selected.length > 0) setSelectedTreat(selected[0]);
  }, [selected]);

  const handleSave = () => {
    if (selectedTreat) {
      onChange([selectedTreat]);
      onClose();
    }
  };

  return (
    <div className="pixie-overlay" style={{ zIndex: 2000 }}>
      <div
        className="pixie-card pixie-card--modal"
        style={{ maxWidth: 700, position: "relative", overflow: "hidden" }}
      >
        {/* Blue X close */}
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src={`${import.meta.env.BASE_URL}assets/icons/blue_ex.png`} alt="Close" />
        </button>

        {/* Hide inner scrollbar */}
        <style>{`
          .tt-scroll {
            max-height: 64vh;
            overflow-y: auto;
            padding: 2px 2px 6px;
            scrollbar-width: none;
          }
          .tt-scroll::-webkit-scrollbar { display: none; }
        `}</style>

        <div className="pixie-card__body" style={{ textAlign: "center" }}>
          <h3
            className="px-title"
            style={{
              fontFamily: "'Jenna Sue', cursive",
              fontSize: "2rem",
              marginBottom: "0.85rem",
            }}
          >
            Choose Your Treat Table
          </h3>

          {/* Vertical stack of tiles */}
          <div className="tt-scroll">
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {treatOptions.map((option) => {
                const isSelected = selectedTreat === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setSelectedTreat(option.key)}
                    style={{
                      width: "min(520px, 92vw)",
                      margin: "0 auto",
                      textAlign: "left",
                      background: "#fff",
                      border: "2px solid transparent",
                      borderRadius: 16,
                      padding: "0.9rem",
                      cursor: "pointer",
                      boxShadow: isSelected
                        ? "0 0 18px 6px rgba(44,98,186,0.28)" // 💙 blue glow
                        : "0 1px 3px rgba(0,0,0,0.06)",
                      transition: "box-shadow .2s ease, transform .15s ease",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = isSelected
                        ? "0 0 22px 8px rgba(44,98,186,0.36)"
                        : "0 2px 8px rgba(0,0,0,0.10)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = isSelected
                        ? "0 0 18px 6px rgba(44,98,186,0.28)"
                        : "0 1px 3px rgba(0,0,0,0.06)";
                    }}
                  >
                    <img
                      src={option.image}
                      alt={option.label}
                      style={{
                        width: "100%",
                        borderRadius: 12,
                        display: "block",
                        marginBottom: "10px",
                      }}
                    />
                    <div
                      style={{
                        fontFamily: "'Jenna Sue', cursive",
                        fontSize: "1.35rem",
                        color: "#2c62ba",
                        marginBottom: 4,
                      }}
                    >
                      {option.label}
                    </div>
                    <p className="px-prose-narrow" style={{ margin: 0 }}>
                      {option.description}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CTA */}
          <div style={{ marginTop: "1rem" }}>
            <button
              className="boutique-primary-btn"
              onClick={handleSave}
              disabled={!selectedTreat}
              style={{ minWidth: 220 }}
            >
              Add to Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TreatTypeModal;