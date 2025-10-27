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

  /** Optional: caller-defined custom row renderer */
  renderOption?: (args: {
    option: string;
    selected: string[];
    setSelected: (next: string[]) => void;
    disabled: boolean;
  }) => React.ReactNode | null;

  /** Optional: extra UI below the main checkbox list (we'll use this for Taco fillings) */
  children?: React.ReactNode;

  /**
   * ⭐ NEW: liveSelections / onLiveChange
   * If provided, the modal becomes "controlled-ish":
   *  - We mirror your liveSelections into our localSelections
   *  - Every toggle also calls onLiveChange(next)
   * This lets parent know which entrees are currently checked
   * so it can react immediately (show taco fillings, etc.)
   *
   * If you don't pass these, behavior is unchanged.
   */
  liveSelections?: string[];
  onLiveChange?: (next: string[]) => void;
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
  children,
  liveSelections,
  onLiveChange,
}) => {
  // internal working list of checked boxes
  const [localSelections, setLocalSelections] = useState<string[]>(
    liveSelections ?? selected
  );

  // if parent updates `selected` or `liveSelections`, sync
  useEffect(() => {
    if (liveSelections) {
      setLocalSelections(liveSelections);
    } else {
      setLocalSelections(selected);
    }
  }, [selected, liveSelections]);

  const setBoth = (next: string[]) => {
    // apply transform rule if any (pairing logic, etc)
    const finalNext = transformOnToggle ? transformOnToggle(next) : next;

    setLocalSelections(finalNext);

    // tell parent live
    if (onLiveChange) {
      onLiveChange(finalNext);
    }
  };

  const toggleOption = (item: string) => {
    // block clicks on disabled items
    if (isDisabled?.(item, localSelections)) return;

    let next = localSelections.includes(item)
      ? localSelections.filter((i) => i !== item)
      : localSelections.length < max
      ? [...localSelections, item]
      : localSelections;

    setBoth(next);
  };

  return (
    <div
      className="pixie-overlay"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.35)",
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
          maxWidth: "600px",
          width: "90%",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.2)",
          position: "relative",
        }}
      >
        {/* Blue X close */}
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

        {/* badge img */}
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

        {/* OPTIONS LIST */}
        <div style={{ marginBottom: "1.5rem", textAlign: "left" }}>
          {options.map((item) => {
            const disabled = isDisabled?.(item, localSelections) ?? false;

            if (renderOption) {
              const node = renderOption({
                option: item,
                selected: localSelections,
                disabled,
                setSelected: (next) => setBoth(next),
              });
              if (node) {
                return (
                  <div key={item} style={{ marginBottom: "0.5rem" }}>
                    {node}
                  </div>
                );
              }
            }

            return (
              <label
                key={item}
                style={{
                  display: "block",
                  marginBottom: "0.5rem",
                  opacity: disabled ? 0.5 : 1,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
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

        {/* CHILD CONTENT (like Taco Fillings) */}
        {children && (
          <div
            style={{
              borderTop: "1px solid #ccc",
              paddingTop: "1rem",
              marginBottom: "2rem",
            }}
          >
            {/*
              We want children to be able to read/write liveSelections,
              so we inject extra context via render props-style cloning:
              BUT to keep this component dead simple and backward compatible,
              we won't auto-inject props. Instead, parent passes a <ChildComponent />
              that already has the state & callbacks it needs.
            */}
            {children}
          </div>
        )}

        {/* CTA */}
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