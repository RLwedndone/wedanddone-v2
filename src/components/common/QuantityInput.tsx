import React, { useCallback } from "react";

type Props = {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (next: number) => void;
  ariaLabel?: string;
};

const clamp = (n: number, min = 0, max = Number.POSITIVE_INFINITY) =>
  Math.min(max, Math.max(min, n));

const QuantityInput: React.FC<Props> = ({
  value,
  min = 0,
  max = 9999,
  step = 1,
  onChange,
  ariaLabel = "Quantity",
}) => {
  const inc = useCallback(() => onChange(clamp((value || 0) + step, min, max)), [value, step, min, max, onChange]);
  const dec = useCallback(() => onChange(clamp((value || 0) - step, min, max)), [value, step, min, max, onChange]);

  return (
    <div className="px-qty">
      <button
        type="button"
        className="px-qty-btn px-qty-btn--minus"
        aria-label="Decrease quantity"
        onClick={dec}
        disabled={value <= min}
      >
        −
      </button>

      <input
        className="px-input-number"
        type="number"
        inputMode="numeric"     // ✅ mobile numeric keypad
        pattern="[0-9]*"        // ✅ iOS numeric keypad hint
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        aria-label={ariaLabel}
        onChange={(e) => {
          const n = parseInt(e.target.value, 10);
          onChange(clamp(Number.isFinite(n) ? n : 0, min, max));
        }}
        onBlur={(e) => {
          // normalize on blur (remove empty/invalid)
          const n = parseInt(e.target.value, 10);
          e.currentTarget.value = String(clamp(Number.isFinite(n) ? n : 0, min, max));
        }}
      />

      <button
        type="button"
        className="px-qty-btn px-qty-btn--plus"
        aria-label="Increase quantity"
        onClick={inc}
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
};

export default QuantityInput;