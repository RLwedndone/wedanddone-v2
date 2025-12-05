// src/components/photo/PixiePurchaseScreenPhoto.tsx
import React, { useState, useMemo } from "react";
import { getAuth } from "firebase/auth";
import { db } from "../../firebase/firebaseConfig";
import { doc, setDoc } from "firebase/firestore";

interface PixiePurchaseScreenPhotoProps {
  setTotal: (total: number) => void;
  setLineItems: (items: string[]) => void;
  buttonLabel?: string;
  onContinue: () => void;
  onStartOver: () => void;
  setQuantities: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  weddingDate?: string | null;
  hideBasePackage?: boolean;
  onClose: () => void; // pink X
}

type UpgradeItem = { name: string; basePrice: number };

const upgradeItems: UpgradeItem[] = [
  { name: "Engagement Session", basePrice: 500 },
  { name: "Lay Flat Wedding Album", basePrice: 1200 },
  { name: "Parent Albums", basePrice: 600 },
  { name: "Additional Photo Hours", basePrice: 300 },
];

const MARGIN_RATE = 0.06;
const SALES_TAX_RATE = 0.086;
const STRIPE_RATE = 0.029;
const STRIPE_FLAT_FEE = 0.3;
const BASE_PACKAGE_PRICE = 2800;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const prettyDate = (d: Date) =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

const PixiePurchaseScreenPhoto: React.FC<PixiePurchaseScreenPhotoProps> = ({
  setTotal,
  setLineItems,
  buttonLabel = "Confirm & Book",
  onContinue,
  onStartOver,
  setQuantities,
  weddingDate,
  hideBasePackage = false,
  onClose,
}) => {
  // init quantities to 0
  const [localQuantities, setLocalQuantities] = useState<Record<string, number>>(
    upgradeItems.reduce((acc, item) => {
      acc[item.name] = 0;
      return acc;
    }, {} as Record<string, number>)
  );

  const handleQuantityChange = (itemName: string, value: string) => {
    const n = Math.max(0, parseInt(value || "0", 10));
    const newQuantities = { ...localQuantities, [itemName]: Number.isFinite(n) ? n : 0 };
    setLocalQuantities(newQuantities);
    setQuantities(newQuantities);
  };

  // ---------- Pricing (no isCurrency needed) ----------
  const subtotalAddons = useMemo(
    () =>
      upgradeItems.reduce((sum, item) => {
        const qty = localQuantities[item.name] || 0;
        return sum + item.basePrice * (1 + MARGIN_RATE) * qty;
      }, 0),
    [localQuantities]
  );

  const subtotal = hideBasePackage ? subtotalAddons : BASE_PACKAGE_PRICE + subtotalAddons;
  const taxesAndFees = subtotal * SALES_TAX_RATE + subtotal * STRIPE_RATE + STRIPE_FLAT_FEE;
  const grandTotal = round2(subtotal + taxesAndFees);

  // 50% deposit math + final due (35 days prior)
  const deposit50 = round2(grandTotal * 0.5);
  const remainingAfterDeposit = round2(Math.max(0, grandTotal - deposit50));

  const finalDueAt = (() => {
    if (!weddingDate) return null;
    const d = new Date(`${weddingDate}T12:00:00`);
    if (isNaN(d.getTime())) return null;
    d.setDate(d.getDate() - 35);
    return d;
  })();
  const finalDuePretty = finalDueAt ? prettyDate(finalDueAt) : "35 days before your wedding date";

  const handleContinue = async () => {
    const auth = getAuth();
    const user = auth.currentUser;

    const selectedItems = upgradeItems
      .filter((item) => (localQuantities[item.name] || 0) > 0)
      .map(
        (item) =>
          `${localQuantities[item.name]} x ${item.name} ($${Number(item.basePrice).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})} each)`
      );

    const lineItems = hideBasePackage
      ? [...selectedItems]
      : [`Wedding Photography Package - $${Number(BASE_PACKAGE_PRICE).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`, ...selectedItems];

    setTotal(grandTotal);
    setLineItems(lineItems);

    // stash plan hints
    try {
      localStorage.setItem("photoTotal", String(grandTotal));
      localStorage.setItem("photoDepositPercent", "0.5");
      localStorage.setItem("photoDepositAmount", String(deposit50));
      localStorage.setItem("photoRemainingBalance", String(remainingAfterDeposit));
      localStorage.setItem("photoFinalDueAt", finalDueAt ? finalDueAt.toISOString() : "");
      localStorage.setItem("photoFinalDuePretty", finalDuePretty);
      localStorage.setItem("photoLineItems", JSON.stringify(lineItems));
    } catch {}

    if (user) {
      try {
        await setDoc(
          doc(db, "users", user.uid),
          { photoProgress: "checkout", photoQuantities: localQuantities },
          { merge: true }
        );
      } catch (e) {
        console.error("❌ Error saving photo progress:", e);
      }
    }
    onContinue();
  };

  return (
    <div className="pixie-card">
      {/* Pink X */}
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
          Pixie Purchase Photo Cart
        </h2>

        {/* Base package blurb */}
        {!hideBasePackage && (
          <div className="px-prose-narrow" style={{ marginBottom: "1.25rem" }}>
            <p style={{ fontWeight: 700, marginBottom: 8 }}>Photographer Wed&Done Package</p>
            <ul style={{ textAlign: "left", margin: "0 auto", maxWidth: 520 }}>
              <li>6 hours of wedding day coverage</li>
              <li>At least 250 final images</li>
              <li>Professional retouching/post-processing of all final images</li>
              <li>Downloadable, high-resolution files (limited copyright release)</li>
              <li>Online digital gallery</li>
            </ul>
            <p style={{ marginTop: 10, fontWeight: 700 }}>
              ${Number(BASE_PACKAGE_PRICE).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}
            </p>
          </div>
        )}

        {/* Rows */}
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
        <div className="px-totals" style={{ marginBottom: 10 }}>
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

export default PixiePurchaseScreenPhoto;