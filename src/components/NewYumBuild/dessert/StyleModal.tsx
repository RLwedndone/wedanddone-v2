import React, { useState, useEffect } from "react";

interface StyleModalProps {
  selected: string[];
  onChange: (selected: string[]) => void;
  onClose: () => void;
}

const cakeStyles = [
  { label: "Smooth", image: `${import.meta.env.BASE_URL}assets/images/YumYum/smooth.png` },
  { label: "Semi-Naked", image: `${import.meta.env.BASE_URL}assets/images/YumYum/semi_naked.png` },
  { label: "Rough or Stucco", image: `${import.meta.env.BASE_URL}assets/images/YumYum/stucco.png` },
  { label: "Grooved", image: `${import.meta.env.BASE_URL}assets/images/YumYum/grooved.png` },
];

const StyleModal: React.FC<StyleModalProps> = ({ selected, onChange, onClose }) => {
  const [selectedStyle, setSelectedStyle] = useState<string>(selected[0] || "");

  useEffect(() => {
    if (selected.length > 0) setSelectedStyle(selected[0]);
  }, [selected]);

  const handleSelect = (label: string) => setSelectedStyle(label);

  const handleSave = () => {
    if (selectedStyle) {
      onChange([selectedStyle]);
      onClose();
    }
  };

  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 18,
        padding: "1.25rem",
        width: "min(92vw, 420px)",
        maxHeight: "85vh",
        margin: "0 auto",
        boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Scoped: hide scrollbar only inside the scroll area */}
      <style>{`
        .style-modal__body { -ms-overflow-style: none; scrollbar-width: none; }
        .style-modal__body::-webkit-scrollbar { display: none; }
      `}</style>

      {/* Blue X */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        style={{ position: "absolute", top: 10, right: 10, background: "none", border: "none", cursor: "pointer" }}
      >
        <img src={`${import.meta.env.BASE_URL}assets/icons/blue_ex.png`} alt="Close" style={{ width: 22, height: 22 }} />
      </button>

      {/* Big Blue Jenna Sue title */}
      <h3
        className="px-title"
        style={{
          textAlign: "center",
          fontFamily: "'Jenna Sue', cursive",
          fontSize: "2.2rem",
          color: "#2c62ba",
          margin: "0 0 1rem",
          flex: "0 0 auto",
        }}
      >
        Select Your Cake Style
      </h3>

      {/* Scrollable vertical stack */}
      <div
  className="style-modal__body"
  style={{
    flex: "1 1 auto",
    overflowY: "auto",
    padding: "1.75rem 0.25rem 0.25rem", // ⬆️ increased top padding
    marginTop: "0.25rem",               // subtle push down from header
  }}
>
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      gap: "1.25rem",                   // a touch more spacing between tiles
    }}
  >
    {cakeStyles.map((style) => {
      const isSelected = selectedStyle === style.label;
      return (
        <button
          type="button"
          key={style.label}
          onClick={() => handleSelect(style.label)}
          style={{
            cursor: "pointer",
            textAlign: "center",
            padding: "0.75rem",
            borderRadius: 14,
            border: "2px solid transparent",
            width: "100%",
            maxWidth: "280px",
            margin: "0 auto",
            backgroundColor: "#fff",
            boxShadow: isSelected
              ? "0 0 22px 8px rgba(44,98,186,0.55)"
              : "0 1px 3px rgba(0,0,0,0.06)",
            transform: isSelected ? "scale(1.03)" : "scale(1)",
            transition: "box-shadow 0.25s ease, transform 0.2s ease",
          }}
        >
          <img
            src={style.image}
            alt={style.label}
            style={{
              width: "100%",
              maxWidth: "200px",
              aspectRatio: "1 / 1",
              objectFit: "contain",
              background: "#f8fafc",
              borderRadius: 10,
              margin: "0 auto 0.35rem",
              display: "block",
            }}
          />
          <div
            style={{
              fontFamily: "'Jenna Sue', cursive",
              fontSize: "1.7rem",
              color: "#2c62ba",
              lineHeight: 1.15,
            }}
          >
            {style.label}
          </div>
        </button>
      );
    })}
  </div>
</div>

      {/* Footer */}
      <div
        style={{
          marginTop: "1rem",
          paddingTop: "0.5rem",
          borderTop: "1px solid #f1f5f9",
          display: "flex",
          justifyContent: "center",
          flex: "0 0 auto",
          background: "#fff",
          borderBottomLeftRadius: 18,
          borderBottomRightRadius: 18,
        }}
      >
        <button
          type="button"
          className="boutique-primary-btn"
          onClick={handleSave}
          disabled={!selectedStyle}
          style={{ minWidth: 200, opacity: selectedStyle ? 1 : 0.6 }}
        >
          Add to Menu
        </button>
      </div>
    </div>
  );
};

export default StyleModal;