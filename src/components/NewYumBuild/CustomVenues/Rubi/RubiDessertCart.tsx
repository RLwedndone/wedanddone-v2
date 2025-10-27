// src/components/NewYumBuild/CustomVenues/Rubi/RubiDessertCart.tsx
import React, { useEffect, useMemo, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import { DESSERT_PRICING, GOODIE_CATALOG } from "../../dessert/dessertPricing";
import {
  getGuestState,
  setGuestCount,
  setAndLockGuestCount,
  type GuestLockReason,
} from "../../../../utils/guestCountStore";

const {
  SALES_TAX_RATE,
  STRIPE_RATE,
  STRIPE_FLAT_FEE,
  DEPOSIT_PCT,
  FINAL_DUE_DAYS,
  PER_GUEST_TIERED,
  SMALL_CAKE_PRICE,
  CUPCAKE_PRICE_EACH,
  CUPCAKE_MIN_EACH,
} = DESSERT_PRICING;

const MS_DAY = 24 * 60 * 60 * 1000;
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const asStartOfDayUTC = (d: Date) =>
  new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 1));
const parseLocalYMD = (ymd?: string | null): Date | null =>
  !ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd) ? null : new Date(`${ymd}T12:00:00`);

function monthsBetweenInclusive(from: Date, to: Date) {
  const a = new Date(from.getFullYear(), from.getMonth(), 1);
  const b = new Date(to.getFullYear(), to.getMonth(), 1);
  let months = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (to.getDate() >= from.getDate()) months += 1;
  return Math.max(1, months);
}
function firstMonthlyChargeAtUTC(from = new Date()): string {
  const y = from.getUTCFullYear();
  const m = from.getUTCMonth();
  const d = from.getUTCDate();
  const dt = new Date(Date.UTC(y, m + 1, d, 0, 0, 1));
  return dt.toISOString();
}

const clamp = (n: number, lo = 1, hi = 250) => Math.max(lo, Math.min(hi, n));
const goodieLabel = (k: string) => (k.includes("::") ? k.split("::")[1] : k);

interface Props {
  guestCount: number;
  dessertStyle: "tieredCake" | "smallCakeTreats" | "treatsOnly";
  flavorFilling: string[];
  cakeStyle?: string;
  treatType?: "" | "cupcakes" | "goodies";
  cupcakes?: string[];
  goodies?: string[];
  setTotal: (grandTotal: number) => void;
  setLineItems: (items: string[]) => void;
  setPaymentSummaryText: (text: string) => void;
  onContinueToCheckout: () => void;
  onStartOver: () => void;
  onClose?: () => void;
  weddingDate: string | null;
}

const RubiDessertCart: React.FC<Props> = ({
  dessertStyle,
  flavorFilling,
  cakeStyle,
  treatType = "",
  cupcakes = [],
  goodies = [],
  setTotal,
  setLineItems,
  setPaymentSummaryText,
  onContinueToCheckout,
  onStartOver,
  weddingDate,
  onClose,
}) => {
  // ===== Guest Count =====
  const [gc, setGC] = useState<number>(0);
  const [locked, setLocked] = useState<boolean>(false);

  useEffect(() => {
    const sync = async () => {
      const st = await getGuestState();
      const currentValue = Number((st as any).value ?? 0);
      const isLocked = Boolean((st as any).locked);
      setGC(currentValue || 0);
      setLocked(isLocked);
      if (!currentValue) {
        const ls = Number(localStorage.getItem("yumGuestCount") || "0");
        if (ls > 0) setGC(ls);
      }
    };
    sync();
  }, []);

  const handleGCInput = (val: string) => {
    if (locked) return;
    const next = clamp(parseInt(val || "0", 10) || 0);
    setGC(next);
    setGuestCount(next);
    localStorage.setItem("yumGuestCount", String(next));
  };

  // ===== Quantities =====
  const [cupcakeEachByFlavor, setCupcakeEachByFlavor] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem("yumNvCupcakeEachByFlavor") || "{}");
    } catch {
      return {};
    }
  });

  const [goodieDozens, setGoodieDozens] = useState<Record<string, number>>(() => {
    try {
      return JSON.parse(localStorage.getItem("yumNvGoodieDozens") || "{}");
    } catch {
      return {};
    }
  });

  // Auto-fill cupcakes
  useEffect(() => {
    if (treatType !== "cupcakes") return;
    const n = Math.max(1, cupcakes.length || 1);
    const suggested = Math.max(CUPCAKE_MIN_EACH, Math.ceil((gc || 0) / n));
    const next: Record<string, number> = {};
    for (const title of cupcakes) {
      const prev = cupcakeEachByFlavor[title] || 0;
      next[title] = Math.max(prev, suggested, CUPCAKE_MIN_EACH);
    }
    setCupcakeEachByFlavor(next);
  }, [treatType, cupcakes, gc]);

  // Auto-fill goodies
  useEffect(() => {
    if (treatType !== "goodies" || goodies.length === 0) return;
    const targetDz = Math.max(1, Math.ceil(gc / 12));
    const next: Record<string, number> = {};
    for (const key of goodies) {
      const label = goodieLabel(key);
      const meta = GOODIE_CATALOG[label];
      const minDz = meta?.minDozens ?? 1;
      next[label] = minDz;
    }
    setGoodieDozens(next);
  }, [gc, treatType, goodies]);

  // ===== Pricing =====
  const baseSubtotal = useMemo(() => {
    let subtotal = 0;
    if (dessertStyle === "tieredCake") subtotal += gc * PER_GUEST_TIERED;
    if (dessertStyle === "smallCakeTreats") {
      subtotal += SMALL_CAKE_PRICE;
      if (treatType === "cupcakes")
        for (const title of cupcakes)
          subtotal += (cupcakeEachByFlavor[title] || 0) * CUPCAKE_PRICE_EACH;
      else if (treatType === "goodies")
        for (const key of goodies) {
          const label = goodieLabel(key);
          subtotal += (goodieDozens[label] || 0) * (GOODIE_CATALOG[label]?.retailPerDozen || 0);
        }
    }
    if (dessertStyle === "treatsOnly") {
      if (treatType === "cupcakes")
        for (const title of cupcakes)
          subtotal += (cupcakeEachByFlavor[title] || 0) * CUPCAKE_PRICE_EACH;
      else if (treatType === "goodies")
        for (const key of goodies) {
          const label = goodieLabel(key);
          subtotal += (goodieDozens[label] || 0) * (GOODIE_CATALOG[label]?.retailPerDozen || 0);
        }
    }
    return round2(subtotal);
  }, [dessertStyle, gc, treatType, cupcakes, cupcakeEachByFlavor, goodies, goodieDozens]);

  const taxesAndFees = useMemo(() => {
    const taxes = baseSubtotal * SALES_TAX_RATE;
    const stripe = baseSubtotal * STRIPE_RATE + STRIPE_FLAT_FEE;
    return round2(taxes + stripe);
  }, [baseSubtotal]);

  const grandTotal = useMemo(() => round2(baseSubtotal + taxesAndFees), [baseSubtotal, taxesAndFees]);
  const deposit25 = round2(grandTotal * DEPOSIT_PCT);

  useEffect(() => {
    setTotal(grandTotal);
    const items: string[] = [];
    items.push(`Dessert total: $${grandTotal.toFixed(2)}`);
    setLineItems(items);
    setPaymentSummaryText(`Total $${grandTotal.toFixed(2)} (incl. tax & fees).`);
  }, [grandTotal, setTotal, setLineItems, setPaymentSummaryText]);

  const handleContinue = async () => {
    try {
      if (!locked) await setAndLockGuestCount(gc || 0, "dessert");
    } catch (e) {
      console.error("⚠️ Could not lock guest count:", e);
    }
    localStorage.setItem("yumTotal", String(grandTotal));
    localStorage.setItem("yumDepositAmount", String(deposit25));
    onContinueToCheckout();
  };

  const formattedDessertStyle =
    (
      {
        tieredCake: "Tiered Cake",
        smallCakeTreats: "Small Cake + Treats",
        treatsOnly: "Treats Only",
      } as const
    )[dessertStyle] ?? dessertStyle;

  return (
    <div className="pixie-card pixie-card--modal" style={{ maxWidth: 700 }}>
      {onClose && (
        <button className="pixie-card__close" onClick={onClose} aria-label="Close">
          <img src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`} alt="Close" />
        </button>
      )}

      <div className="pixie-card__body" style={{ textAlign: "center" }}>
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/yum_cart.mp4`}
          autoPlay
          loop
          muted
          playsInline
          className="px-media"
          style={{ width: 180, margin: "0 auto 16px", borderRadius: 12 }}
        />

        <h2 className="px-title-lg" style={{ marginBottom: 8 }}>
          Rubi House Dessert Order
        </h2>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, marginBottom: 6 }}>Guest Count</div>
          {locked ? (
            <div style={{ background: "#f5f7fb", padding: "8px 12px", borderRadius: 10 }}>
              {gc} (locked)
            </div>
          ) : (
            <input
              type="number"
              min={1}
              max={250}
              value={gc}
              onChange={(e) => handleGCInput(e.target.value)}
              className="px-input"
              style={{ width: 120, textAlign: "center" }}
            />
          )}
        </div>

        <p className="px-prose-narrow" style={{ marginBottom: 12 }}>
          Style: <strong>{formattedDessertStyle}</strong>
        </p>

        <div className="px-prose-narrow" style={{ marginTop: 4 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            Subtotal: ${baseSubtotal.toFixed(2)}
          </div>
          <div style={{ color: "#444" }}>Taxes & Fees: ${taxesAndFees.toFixed(2)}</div>
          <div style={{ fontWeight: 800, marginTop: 8 }}>
            Total: ${grandTotal.toFixed(2)}
          </div>
        </div>

        <div className="px-cta-col" style={{ marginTop: 12 }}>
          <button className="boutique-primary-btn" onClick={handleContinue}>
            Confirm & Book
          </button>
          <button className="boutique-back-btn" onClick={onStartOver}>
            ← Back to Menu
          </button>
        </div>
      </div>
    </div>
  );
};

export default RubiDessertCart;