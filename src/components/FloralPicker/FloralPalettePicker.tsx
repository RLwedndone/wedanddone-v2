import React, { useState } from "react";

interface FloralPalettePickerProps {
  onContinue: (paletteName: string) => void;
  onClose: () => void; // 👈 add this so the pink X works
}

// ✅ fixed image paths: proper template literal with backticks on both ends
const palettes = [
  {
    label: "Dusty Pastels",
    image: `${import.meta.env.BASE_URL}assets/images/dusty_pastels.jpg`,
  },
  {
    label: "Jewel Tones",
    image: `${import.meta.env.BASE_URL}assets/images/jewel_tones.jpg`,
  },
  {
    label: "Vibrant Wildflowers",
    image: `${import.meta.env.BASE_URL}assets/images/vibrant_wildflower.jpg`,
  },
  {
    label: "Whites & Greens",
    image: `${import.meta.env.BASE_URL}assets/images/whites_and_greens.jpg`,
  },
];

const FloralPalettePicker: React.FC<FloralPalettePickerProps> = ({
  onContinue,
  onClose,
}) => {
  const [selectedPalette, setSelectedPalette] = useState<string | null>(null);

  const handlePaletteSelect = (palette: string) => {
    setSelectedPalette(palette);
  };

  const handleContinueClick = () => {
    if (selectedPalette) onContinue(selectedPalette);
  };

  return (
    <div className="pixie-card wd-page-turn">
      {/* ✖ Pink close button (standardized) */}
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

      <div className="pixie-card__body">
        {/* 🖼️ Title */}
        <h1 className="px-title-lg">Choose Your Floral Palette</h1>

        {/* 📝 Description */}
        <p className="px-prose-narrow">
          Pick the color palette that fits your style!
        </p>

        {/* 🎨 Palette Options Grid */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "1.5rem",
            marginBottom: "2rem",
          }}
        >
          {palettes.map((palette) => (
            <button
              key={palette.label}
              onClick={() => handlePaletteSelect(palette.label)}
              style={{
                backgroundColor: "#fff",
                color: "#2c62ba",
                border: "none",
                borderRadius: "12px",
                padding: "1rem",
                width: "200px",
                textAlign: "center",
                cursor: "pointer",
                transition: "all 0.3s ease",
                boxShadow:
                  selectedPalette === palette.label
                    ? palette.label === "Dusty Pastels"
                      ? "0 0 20px 5px rgba(255, 182, 193, 0.7)" // light pink
                      : palette.label === "Jewel Tones"
                      ? "0 0 20px 5px rgba(255, 20, 147, 0.7)" // vibrant pink
                      : palette.label === "Whites & Greens"
                      ? "0 0 20px 5px rgba(50, 205, 50, 0.7)" // green
                      : palette.label === "Vibrant Wildflowers"
                      ? "0 0 20px 5px rgba(255, 215, 0, 0.7)" // gold
                      : "none"
                    : "none",
              }}
            >
              <img
                src={palette.image}
                alt={palette.label}
                style={{
                  width: "100%",
                  height: "auto",
                  borderRadius: "10px",
                  marginBottom: "0.5rem",
                }}
              />
              <div>{palette.label}</div>
            </button>
          ))}
        </div>

        {/* 👉 Continue Button */}
        <button
          className="boutique-primary-btn"
          onClick={handleContinueClick}
          disabled={!selectedPalette}
        >
          Continue
        </button>
      </div>
    </div>
  );
};

export default FloralPalettePicker;