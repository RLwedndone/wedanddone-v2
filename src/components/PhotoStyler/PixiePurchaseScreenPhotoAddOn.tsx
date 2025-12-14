// src/components/photo/PixiePurchaseScreenPhotoAddOn.tsx
import React, { useState, useMemo } from "react";
import { getAuth } from "firebase/auth";
import { db } from "../../firebase/firebaseConfig";
import { doc, setDoc } from "firebase/firestore";

interface PixiePurchaseScreenPhotoAddOnProps {
  setTotal: (total: number) => void;
  setLineItems: (items: string[]) => void;
  buttonLabel?: string;
  onContinue: () => void;
  onBack?: () => void;
  onStartOver: () => void;
  setQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  onClose: () => void; // ✅ pink X
}

const upgradeItems = [
  { name: "Engagement Session", basePrice: 500 },
  { name: "Lay Flat Wedding Album", basePrice: 1200 },
  { name: "Parent Albums", basePrice: 600 },
  { name: "Additional Photo Hours", basePrice: 300 },
];

const MARGIN_RATE = 0.06;
const SALES_TAX_RATE = 0.086;
const STRIPE_RATE = 0.029;
const STRIPE_FLAT_FEE = 0.3;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const PixiePurchaseScreenPhotoAddOn: React.FC<PixiePurchaseScreenPhotoAddOnProps> = ({
  setTotal,
  setLineItems,
  buttonLabel = "Confirm Add-Ons",
  onContinue,
  onStartOver,
  setQuantities,
  onClose,
}) => {
  const [localQuantities, setLocalQuantities] = useState<Record<string, number>>(
    upgradeItems.reduce((acc: Record<string, number>, item) => {
      acc[item.name] = 0;
      return acc;
    }, {})
  );

  const handleQuantityChange = (itemName: string, value: string) => {
    const n = Math.max(0, parseInt(value || "0", 10));
    const next = { ...localQuantities, [itemName]: Number.isFinite(n) ? n : 0 };
    setLocalQuantities(next);
    setQuantities(next);
  };

  // Subtotal includes margin like the main photo cart
  const subtotal = useMemo(
    () =>
      upgradeItems.reduce((sum, item) => {
        const qty = localQuantities[item.name] || 0;
        return sum + item.basePrice * (1 + MARGIN_RATE) * qty;
      }, 0),
    [localQuantities]
  );

  const taxesAndFees = useMemo(
    () => subtotal * SALES_TAX_RATE + subtotal * STRIPE_RATE + STRIPE_FLAT_FEE,
    [subtotal]
  );
  const grandTotal = round2(subtotal + taxesAndFees);

  const handleContinue = async () => {
    const auth = getAuth();
    const user = auth.currentUser;

    const selectedItems = upgradeItems
      .filter((item) => (localQuantities[item.name] || 0) > 0)
      .map(
        (item) =>
          `${localQuantities[item.name]} x ${item.name} ($${Number(item.basePrice).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} each)`
      );

    setTotal(grandTotal);
    setLineItems(selectedItems);

    if (user) {
      try {
        await setDoc(
          doc(db, "users", user.uid),
          { photoProgress: "checkout", photoQuantities: localQuantities },
          { merge: true }
        );
        console.log("✅ Saved photo add-on progress at: checkout");
      } catch (e) {
        console.error("❌ Error saving photo add-on progress:", e);
      }
    }
    onContinue();
  };

  return (
    <div className="pixie-card wd-page-turn">
      {/* 🩷 Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>

      <div className="pixie-card__body">
        {/* Character video */}
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/dragon_cart.mp4`}
          autoPlay
          muted
          loop
          playsInline
          className="px-media--sm"
          style={{ marginBottom: "1rem" }}
        />

        {/* Title */}
        <h2 className="px-title" style={{ marginBottom: "1rem" }}>
          Photo Add-On Cart
        </h2>

        {/* Rows (matching Floral / Photo main cart) */}
        <div style={{ textAlign: "left", margin: "0 auto 1.5rem", maxWidth: 600 }}>
          {upgradeItems.map((item) => (
            <div key={item.name} className="px-item">
              <div className="px-item__label">{item.name}</div>

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
          Total (includes taxes &amp; fees): ${Number(grandTotal).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
        </div>

        {/* CTAs */}
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

export default PixiePurchaseScreenPhotoAddOn;