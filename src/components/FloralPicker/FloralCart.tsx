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
  onClose: () => void;
}

const MARGIN_RATE = 0.06;
const SALES_TAX_RATE = 0.086;
const STRIPE_RATE = 0.029;
const STRIPE_FLAT_FEE = 0.3;

const fmt = (n: number) =>
  n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const unitPrice = (base: number) => base * (1 + MARGIN_RATE);

const floralItems: FloralItem[] = [
  { name: "Bridal Bouquet", basePrice: 175 },
  { name: "Bridesmaid Bouquet", basePrice: 95 },
  { name: "Corsage", basePrice: 35 },
  { name: "Table Arrangement", basePrice: 75 },
  { name: "Boutonnière", basePrice: 18 },
  { name: "Pocket Square", basePrice: 35 },
  { name: "Flower Crown", basePrice: 70 },
  { name: "Haircomb", basePrice: 45 },
  { name: "Aisle Petals", basePrice: 300 },
  { name: "Cake Flowers", basePrice: 50 },
];

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
      const qty = Number(localQuantities[item.name] ?? 0); // ✅ hard default to 0
      const itemTotal = unitPrice(item.basePrice) * qty;
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
      .map((item) => {
        const qty = localQuantities[item.name];
        return `${item.name} - $${fmt(unitPrice(item.basePrice))} (x${qty})`;
      });

    const extraDetails: string[] = [];
    if (selectedPalette) extraDetails.push(`Palette: ${selectedPalette}`);
    if (selectedArrangement) extraDetails.push(`Table Arrangement: ${selectedArrangement}`);

    setTotal(grandTotal);
    setLineItems([...extraDetails, ...selectedItems]);

    if (setPaymentSummary) {
      setPaymentSummary(
        `You'll choose at checkout to pay in full ($${fmt(
          grandTotal
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
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      {/* ---------- Body ---------- */}
      <div className="pixie-card__body">
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/unicorn_cart.mp4`}
          autoPlay
          muted
          loop
          playsInline
          className="px-media--sm"
          style={{ marginBottom: "1rem" }}
        />

        <h2 className="px-title" style={{ marginBottom: "1rem" }}>
          Pixie Purchase Floral Cart
        </h2>

        {selectedPalette && selectedArrangement && (
          <p className="px-prose-narrow" style={{ marginBottom: "1.25rem" }}>
            You’ve chosen a palette of{" "}
            <span style={{ color: "#2c62ba" }}>{selectedPalette}</span> and{" "}
            <span style={{ color: "#2c62ba" }}>{selectedArrangement}</span> table arrangements!
          </p>
        )}

        <div style={{ textAlign: "left", margin: "0 auto 2rem", maxWidth: "600px" }}>
          {floralItems.map((item) => {
            const price = unitPrice(item.basePrice);
            return (
              <div key={item.name} className="px-item">
                <div className="px-item__label">
                  {item.name}{" "}
                  <span style={{ color: "#555", fontWeight: 600 }}>– ${fmt(price)}</span>
                </div>

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
                    <img
                      src={`${import.meta.env.BASE_URL}assets/icons/qty_minus_pink_glossy.svg`}
                      alt=""
                      aria-hidden="true"
                    />
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
                    <img
                      src={`${import.meta.env.BASE_URL}assets/icons/qty_plus_blue_glossy.svg`}
                      alt=""
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="px-totals">
  Total (includes taxes &amp; fees): ${fmt(grandTotal)}
</div>

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