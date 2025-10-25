import React, { useState, useEffect } from "react";

interface SelectionModalProps {
  title: string;
  options: string[];
  max: number;
  selected?: string[];
  onChange: (updatedList: string[]) => void;
  onClose: (selections: string[]) => void;

  /** Optional: disable specific options based on current picks */
  isDisabled?: (option: string, selections: string[]) => boolean;
  /** Optional: normalize the next selections on each toggle */
  transformOnToggle?: (nextSelections: string[]) => string[];
  // 👇 NEW: let callers custom-render an option (for Schnepf salad dressing)
  renderOption?: (args: {
    option: string;
    selected: string[];
    setSelected: (next: string[]) => void;
    disabled: boolean;
  }) => React.ReactNode | null;
}

const SelectionModal: React.FC<SelectionModalProps> = ({
  title,
  options,
  max,
  selected = [],
  onChange,
  onClose,
  isDisabled,
  transformOnToggle,
  renderOption,
}) => {
  const [localSelections, setLocalSelections] = useState<string[]>(selected);

  useEffect(() => {
    setLocalSelections(selected);
  }, [selected]);

  const toggleOption = (item: string) => {
    // block clicks on disabled items
    if (isDisabled?.(item, localSelections)) return;

    let next = localSelections.includes(item)
      ? localSelections.filter((i) => i !== item)
      : localSelections.length < max
      ? [...localSelections, item]
      : localSelections;

    // let caller enforce special rules (e.g., collapse to just the paired entrée)
    if (transformOnToggle) next = transformOnToggle(next);

    setLocalSelections(next);
  };

  return (
    <div
      className="pixie-overlay" // ✅ same overlay class as standard boutique screens
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.35)", // same translucent backdrop as main overlays
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        overflowY: "auto",
        padding: "2rem 1rem",
      }}
    >
      <div
        className="pixie-card"
        style={{
          background: "#fff",
          borderRadius: "18px",
          padding: "2rem 2rem 3rem",
          maxWidth: "600px",      // ✅ standard overlay card width
          width: "90%",
          maxHeight: "90vh",      // ✅ same height as main flow cards
          overflowY: "auto",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
          position: "relative",
        }}
      >
        {/* Blue X close button */}
        <button
          onClick={() => onClose(localSelections)}
          aria-label="Close"
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/blue_ex.png`}
            alt="Close"
            style={{ width: "22px", height: "22px" }}
          />
        </button>
  
        {/* Max badge image */}
        <img
          src={`/assets/images/YumYum/max${max}.png`}
          alt={`Select up to ${max}`}
          style={{
            width: "100%",
            maxWidth: "320px",
            margin: "0 auto 1rem",
            display: "block",
          }}
        />
  
        <h3
          style={{
            fontSize: "2rem",
            fontWeight: "bold",
            textAlign: "center",
            color: "#2c62ba",
            marginBottom: "1.5rem",
          }}
        >
          {title}
        </h3>
  
        <div style={{ marginBottom: "2rem", textAlign: "left" }}>
          {options.map((item) => {
            const disabled = isDisabled?.(item, localSelections) ?? false;
  
            if (renderOption) {
              const node = renderOption({
                option: item,
                selected: localSelections,
                disabled,
                setSelected: (next) =>
                  setLocalSelections(transformOnToggle ? transformOnToggle(next) : next),
              });
              if (node) return <div key={item}>{node}</div>;
            }
  
            return (
              <label key={item} style={{ display: "block", marginBottom: "0.5rem" }}>
                <input
                  type="checkbox"
                  checked={localSelections.includes(item)}
                  disabled={disabled}
                  onChange={() => toggleOption(item)}
                  style={{ marginRight: "0.5rem" }}
                />
                {item}
              </label>
            );
          })}
        </div>
  
        <button
          onClick={() => {
            onChange(localSelections);
            onClose(localSelections);
          }}
          className="boutique-primary-btn"
          style={{
            width: "220px",
            display: "block",
            margin: "1.25rem auto 0",
          }}
        >
          Add to Menu
        </button>
      </div>
    </div>
  );
};

export default SelectionModal;