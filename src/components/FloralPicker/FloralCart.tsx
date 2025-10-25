import React, { useState, useMemo } from "react";
import { getAuth } from "firebase/auth";
import { db } from "../../firebase/firebaseConfig";
import { doc, setDoc } from "firebase/firestore";

interface FloralItem {
  name: string;
  basePrice: number;
}

interface FloralCartProps {
  setTotal: (grandTotal: number) => void;
  setLineItems: (items: string[]) => void;
  buttonLabel?: string;
  onContinue: () => void;
  onStartOver: () => void;
  setQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  selectedPalette?: string | null;
  selectedArrangement?: string | null;
  setPaymentSummary?: (text: string) => void;
  onClose: () => void; // 👈 added for the pink X
}

const floralItems: FloralItem[] = [
  { name: "Bridal Bouquet", basePrice: 175 },
  { name: "Bridesmaid's Bouquets", basePrice: 95 },
  { name: "Boutonnieres", basePrice: 20 },
  { name: "Corsages", basePrice: 30 },
  { name: "Table Arrangements", basePrice: 75 },
];

const MARGIN_RATE = 0.06;
const SALES_TAX_RATE = 0.086;
const STRIPE_RATE = 0.029;
const STRIPE_FLAT_FEE = 0.3;

const FloralCart: React.FC<FloralCartProps> = ({
  setTotal,
  setLineItems,
  buttonLabel = "Confirm & Book",
  onContinue,
  onStartOver,
  setQuantities,
  selectedPalette,
  selectedArrangement,
  setPaymentSummary,
  onClose,
}) => {
  const [localQuantities, setLocalQuantities] = useState<Record<string, number>>(
    floralItems.reduce((acc: Record<string, number>, item) => {
      acc[item.name] = 0;
      return acc;
    }, {})
  );

  const handleQuantityChange = (itemName: string, value: string) => {
    const newQuantities = { ...localQuantities, [itemName]: parseInt(value) || 0 };
    setLocalQuantities(newQuantities);
    setQuantities(newQuantities);
  };

  const subtotal = useMemo(() => {
    return floralItems.reduce((sum, item) => {
      const quantity = localQuantities[item.name];
      const itemTotal = item.basePrice * (1 + MARGIN_RATE) * quantity;
      return sum + itemTotal;
    }, 0);
  }, [localQuantities]);

  const taxesAndFees = useMemo(
    () => subtotal * SALES_TAX_RATE + subtotal * STRIPE_RATE + STRIPE_FLAT_FEE,
    [subtotal]
  );

  const grandTotal = useMemo(() => subtotal + taxesAndFees, [subtotal, taxesAndFees]);

  const handleContinue = async () => {
    const auth = getAuth();
    const user = auth.currentUser;

    const selectedItems = floralItems
      .filter((item) => localQuantities[item.name] > 0)
      .map((item) => `${item.name} (x${localQuantities[item.name]})`);

    const extraDetails: string[] = [];
    if (selectedPalette) extraDetails.push(`Palette: ${selectedPalette}`);
    if (selectedArrangement) extraDetails.push(`Table Arrangement: ${selectedArrangement}`);

    setTotal(grandTotal);
    setLineItems([...extraDetails, ...selectedItems]);

    if (setPaymentSummary) {
      setPaymentSummary(
        `You'll choose at checkout to pay in full ($${grandTotal.toFixed(
          2
        )}) or pay a 25% deposit today.`
      );
    }

    if (user) {
      try {
        await setDoc(
          doc(db, "users", user.uid),
          { floralProgress: "checkout", floralQuantities: localQuantities },
          { merge: true }
        );
        onContinue();
      } catch (error) {
        console.error("❌ Error saving floral progress:", error);
        onContinue();
      }
    } else {
      onContinue();
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
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      {/* ---------- Body ---------- */}
      <div className="pixie-card__body">
        {/* Character Video */}
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/unicorn_cart.mp4`}
          autoPlay
          muted
          loop
          playsInline
          className="px-media--sm"
          style={{ marginBottom: "1rem" }}
        />

        {/* Title */}
        <h2 className="px-title" style={{ marginBottom: "1rem" }}>
          Pixie Purchase Floral Cart
        </h2>

        {/* Palette + Arrangement Sentence */}
        {selectedPalette && selectedArrangement && (
          <p className="px-prose-narrow" style={{ marginBottom: "1.25rem" }}>
            You’ve chosen a palette of{" "}
            <span style={{ color: "#2c62ba" }}>{selectedPalette}</span> and{" "}
            <span style={{ color: "#2c62ba" }}>{selectedArrangement}</span> table arrangements!
          </p>
        )}

        {/* Floral items */}
        <div style={{ textAlign: "left", margin: "0 auto 2rem", maxWidth: "600px" }}>
          {floralItems.map((item) => (
            <div key={item.name} className="px-item">
              <div className="px-item__label">{item.name}</div>

              {/* Quantity controls */}
              <div className="px-qty">
                <button
                  type="button"
                  className="px-qty-btn px-qty-btn--minus"
                  onClick={() =>
                    handleQuantityChange(
                      item.name,
                      String(Math.max(0, (localQuantities[item.name] || 0) - 1))
                    )
                  }
                  aria-label={`Decrease ${item.name}`}
                >
                  <img src={`${import.meta.env.BASE_URL}assets/icons/qty_minus_pink_glossy.svg`} alt="" aria-hidden="true" />
                </button>

                <input
                  type="number"
                  min="0"
                  value={localQuantities[item.name]}
                  onChange={(e) => handleQuantityChange(item.name, e.target.value)}
                  className="px-input-number"
                  inputMode="numeric"
                />

                <button
                  type="button"
                  className="px-qty-btn px-qty-btn--plus"
                  onClick={() =>
                    handleQuantityChange(item.name, String((localQuantities[item.name] || 0) + 1))
                  }
                  aria-label={`Increase ${item.name}`}
                >
                  <img src={`${import.meta.env.BASE_URL}assets/icons/qty_plus_blue_glossy.svg`} alt="" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Totals */}
        <div className="px-totals">
          Total (includes taxes &amp; fees): ${grandTotal.toFixed(2)}
        </div>

        {/* Buttons */}
        <div className="px-cta-col">
          <button className="boutique-primary-btn" onClick={handleContinue}>
            {buttonLabel}
          </button>
          <button className="boutique-back-btn" onClick={onStartOver}>
            ⬅ Start Over
          </button>
        </div>
      </div>
    </div>
  );
};

export default FloralCart;