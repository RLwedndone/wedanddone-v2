// src/components/jam/PixiePurchaseScreenJam.tsx
import React, { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import { db } from "../../firebase/firebaseConfig";
import { doc, setDoc } from "firebase/firestore";

interface PixiePurchaseScreenJamProps {
  onBack: () => void;
  onClose: () => void; // 👈 added for the pink X
  setTotal: (total: number) => void;
  setLineItems: (items: string[]) => void;
  setQuantities?: (quantities: Record<string, number>) => void;
  hideDJPackage?: boolean;
  onContinue: (grandTotal: number, items: string[]) => void;
}

const MARGIN_RATE = 0.06;
const SALES_TAX_RATE = 0.086;
const STRIPE_RATE = 0.029;
const STRIPE_FLAT_FEE = 0.3;

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const prettyDate = (d: Date) =>
  d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

const PixiePurchaseScreenJam: React.FC<PixiePurchaseScreenJamProps> = ({
  onBack,
  onClose,
  setTotal,
  setLineItems,
  setQuantities,
  hideDJPackage = false,
  onContinue,
}) => {
  // Snap overlay/card to top on mount (parity with other carts)
  useEffect(() => {
    const snapTop = () => {
      try { window.scrollTo({ top: 0, left: 0, behavior: "auto" }); } catch {}
      const card = document.querySelector<HTMLElement>(".pixie-card");
      if (card) {
        try { card.scrollTo({ top: 0, left: 0, behavior: "auto" }); } catch {}
        try { card.scrollTop = 0; card.scrollLeft = 0; } catch {}
      }
    };
    snapTop();
    const id1 = requestAnimationFrame(snapTop);
    const id2 = requestAnimationFrame(snapTop);
    const to = setTimeout(snapTop, 0);
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
      clearTimeout(to as unknown as number);
    };
  }, []);

  const grooveItems = [
    !hideDJPackage && { key: "djBase", name: "DJ Wed&Done Package", price: 2200, max: 1 },
    { key: "grooveGuide", name: "Groove Guide PDF", price: 15, max: 1 },
    { key: "djHours", name: "Additional DJ Hours", price: 450, max: 4 },
    { key: "uplights", name: "Up Lights (Ambiance Lighting)", price: 500, max: 1 },
    { key: "phoneBooth", name: "Phone Booth with Voicemail", price: 450, max: 1 },
    { key: "cloudDance", name: "Dancing on the Cloud Package", price: 950, max: 1 },
    { key: "photobooth", name: "Photobooth", price: 500, max: 1 },
  ].filter(Boolean) as { key: string; name: string; price: number; max: number }[];

  const defaultQuantities: Record<string, number> = grooveItems.reduce((acc, item) => {
    acc[item.key] = 0;
    return acc;
  }, {} as Record<string, number>);

  const [quantities, setLocalQuantities] = useState<Record<string, number>>(defaultQuantities);

  const [showDJDetails, setShowDJDetails] = useState(false);

  const updateQty = (key: string, newQty: number) => {
    const item = grooveItems.find((i) => i.key === key);
    const maxQty = item?.max ?? Infinity;
    const capped = Math.min(Math.max(0, newQty), maxQty);
    const updated = { ...quantities, [key]: capped };
    setLocalQuantities(updated);
    setQuantities?.(updated);
  };

  const hasDJPackage = quantities["djBase"] > 0;

  // ── Totals (margin → taxes/fees) ──
  const subtotal = useMemo(() => {
    return grooveItems.reduce((sum, item) => {
      const qty = quantities[item.key] || 0;
      return sum + qty * item.price * (1 + MARGIN_RATE);
    }, 0);
  }, [grooveItems, quantities]);

  const taxesAndFees = useMemo(
    () => subtotal * SALES_TAX_RATE + subtotal * STRIPE_RATE + STRIPE_FLAT_FEE,
    [subtotal]
  );

  const grandTotal = useMemo(() => round2(subtotal + taxesAndFees), [subtotal, taxesAndFees]);

  // ── Deposit policy (flat $750, capped by total) ──
  const DEPOSIT_AMOUNT = 750;
  const depositDue = Math.min(DEPOSIT_AMOUNT, grandTotal);
  const remainingAfterDeposit = round2(Math.max(0, grandTotal - depositDue));

  // Wedding date (for final due helper)
  const storedWeddingDate = (() => {
    try {
      return localStorage.getItem("weddingDate") || "";
    } catch {
      return "";
    }
  })();

  const finalDueAt: Date | null = (() => {
    if (!storedWeddingDate) return null;
    const d = new Date(`${storedWeddingDate}T12:00:00`);
    if (isNaN(d.getTime())) return null;
    d.setDate(d.getDate() - 35);
    return d;
  })();

  const finalDuePretty = finalDueAt ? prettyDate(finalDueAt) : "35 days before your wedding date";

  const selectedItems = grooveItems
    .filter((item) => quantities[item.key] > 0)
    .map((item) => `${item.name} (x${quantities[item.key]})`);

  const handleContinue = async () => {
    const auth = getAuth();
    const user = auth.currentUser;

    // Persist plan hints for contract/checkout/PDF
    try {
      localStorage.setItem("jamTotal", String(grandTotal));
      localStorage.setItem("jamDepositAmount", String(depositDue));
      localStorage.setItem("jamRemainingBalance", String(remainingAfterDeposit));
      localStorage.setItem("jamFinalDueAt", finalDueAt ? finalDueAt.toISOString() : "");
      localStorage.setItem("jamFinalDuePretty", finalDuePretty);
      localStorage.setItem("jamLineItems", JSON.stringify(selectedItems));
      localStorage.setItem("jamDepositType", "flat");
    } catch {}

    if (user) {
      try {
        await setDoc(
          doc(db, "users", user.uid),
          { jamGrooveQuantities: quantities, jamGrooveProgress: "checkout" },
          { merge: true }
        );
        console.log("✅ Saved Jam & Groove progress at: checkout");
      } catch (error) {
        console.error("❌ Error saving Jam & Groove progress:", error);
      }
    }

    setTotal(grandTotal);
    setLineItems(selectedItems);
    onContinue(grandTotal, selectedItems);
  };

  const DJ_FEATURES = [
    "1 DJ/Event Host for up to 6 hours",
    "Sound system for up to 300 guests",
    "1 Chauvet DJ Gigbar Move (dancefloor lights)",
    "2 QSC K12.2 speakers",
    "Compact ceremony system with lavalier mics",
    "Wireless handheld mic system",
    "Pioneer DDJ SX2 Controller",
    "Allen & Heath ZED-10FX Mixer",
    "Rockville DJ Facade (White or Black)",
    "Full cable + setup package",
  ];

  return (
    <div className="pixie-card pixie-card--modal">{/* 👈 added pixie-card--modal */}
      {/* 🩷 Pink X */}
      <button className="pixie-card__close" onClick={onClose} aria-label="Close">
        <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
      </button>
  
      {/* Body */}
      <div className="pixie-card__body">
        {/* Character video */}
        <video
  src={`${import.meta.env.BASE_URL}assets/videos/frog_cart.mp4`}
  autoPlay
  muted
  loop
  playsInline
  className="px-media--sm"
  style={{
    marginBottom: "1rem",
    display: "block",
    marginLeft: "auto",
    marginRight: "auto",
  }}
/>
  
        {/* Title */}
        <h2 className="px-title" style={{ marginBottom: "1rem" }}>
          Pixie Purchase J&G Cart
        </h2>
  
        {/* Items (DJ base + Groove Guide always visible; others only if DJ is selected) */}
        <div
          style={{
            textAlign: "left",
            margin: "0 auto 2rem",
            maxWidth: 420,       // 👈 was 600
            width: "100%",       // 👈 ensure it shrinks with card
          }}
        >
          {grooveItems.map((item) => {
            const isVisible =
              item.key === "djBase" ||
              item.key === "grooveGuide" ||
              (hasDJPackage && !["djBase", "grooveGuide"].includes(item.key));
            if (!isVisible) return null;
  
            return (
              <div
                key={item.key}
                className="px-item"
                style={{
                  // optional: make sure label + controls wrap nicely on tiny screens
                  display: "flex",
                  flexDirection: "column",
                  gap: 8,
                }}
              >
                <div className="px-item__label">
                  {item.name}{" "}
                  <span style={{ opacity: 0.7 }}>(${item.price.toFixed(2)})</span>
                </div>
  
                {/* Qty controls */}
                <div className="px-qty">
                  <button
                    type="button"
                    className="px-qty-btn px-qty-btn--minus"
                    onClick={() =>
                      updateQty(item.key, (quantities[item.key] || 0) - 1)
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
                    min={0}
                    max={item.key === "djBase" ? 1 : item.max}
                    value={quantities[item.key] || 0}
                    onChange={(e) =>
                      updateQty(item.key, parseInt(e.target.value || "0", 10))
                    }
                    className="px-input-number"
                    inputMode="numeric"
                  />
  
                  <button
                    type="button"
                    className="px-qty-btn px-qty-btn--plus"
                    onClick={() =>
                      updateQty(item.key, (quantities[item.key] || 0) + 1)
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
  
                {item.key === "djBase" && (
  <div
    style={{
      marginTop: 10,
      textAlign: "left",
      maxWidth: 600,
      marginLeft: "auto",
      marginRight: "auto",
    }}
  >
    <button
      type="button"
      onClick={() => setShowDJDetails((v) => !v)}
      style={{
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontWeight: 600,
        color: "#2c62ba",
        background: "none",
        border: "none",
        padding: 0,
      }}
    >
      <span
        style={{
          display: "inline-flex",
          width: 18,
          height: 18,
          borderRadius: "50%",
          alignItems: "center",
          justifyContent: "center",
          background: "#f4c1da",
          color: "#2c62ba",
          fontSize: 12,
          fontWeight: 700,
        }}
      >
        i
      </span>
      <span>{showDJDetails ? "▲ Details" : "▼ Details"}</span>
    </button>

    {showDJDetails && (
      <div
        style={{
          marginTop: 10,
          paddingLeft: 10,
          borderLeft: "3px solid #f0f2f7",
        }}
      >
        {DJ_FEATURES.map((line) => (
          <div
            key={line}
            style={{
              fontSize: "0.92rem",
              color: "#555",
              lineHeight: 1.55,
              marginBottom: 6,
            }}
          >
            {line}
          </div>
        ))}
      </div>
    )}
  </div>
)}
  
                {item.key === "grooveGuide" && (
                  <div className="px-prose-narrow" style={{ marginTop: 8 }}>
                    A shareable PDF of your ceremony/reception picks, dances, and
                    announcements.
                  </div>
                )}
              </div>
            );
          })}
        </div>
  
        {/* Totals */}
        <div className="px-totals">
          Total (includes taxes &amp; fees): ${grandTotal.toFixed(2)}
        </div>
  
        {/* CTAs */}
        <div className="px-cta-col">
          <button className="boutique-primary-btn" onClick={handleContinue}>
            Continue to Checkout
          </button>
          <button className="boutique-back-btn" onClick={onBack}>
            ⬅ Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default PixiePurchaseScreenJam;