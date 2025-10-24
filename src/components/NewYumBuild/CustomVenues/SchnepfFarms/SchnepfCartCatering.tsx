import React, { useEffect, useMemo, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import {
  getGuestState,
  setGuestCount,
  setAndLockGuestCount,
} from "../../../../utils/guestCountStore";
import type { GuestLockReason } from "../../../../utils/guestCountStore";
import type { CuisineId } from "./SchnepfCuisineSelector";
import type { SchnepfMenuSelections } from "./SchnepfMenuBuilderCatering";


/* =========================
   Rates (Schnepf)
========================= */
const SALES_TAX_RATE = 0.086;  // 8.6% Arizona sales tax
const SERVICE_FEE_RATE = 0.22; // 22% service charge
const STRIPE_FEE_RATE = 0.029; // 2.9% Stripe fee
const STRIPE_FEE_FIXED = 0.30; // $0.30 per transaction

/* =========================
   Pricing Source-of-Truth
========================= */
type ChefFeeRule = { min: number; max?: number; chefs: number; fee: number };

const PRICING: Record<
  CuisineId,
  {
    label: string;
    singles?: Record<string, number>;
    byLabel?: Record<string, number>;
    chefFee?: number;
    chefFeeRules?: ChefFeeRule[];
  }
> = {
  bbq: {
    label: "BBQ Dinner",
    singles: {
      "bbq-pork": 26.5,
      "bbq-chicken": 30.5,
      "bbq-combo": 34.75,
    },
  },
  taco_bar: {
    label: "Taco Bar",
    singles: { "taco-both": 26.5 },
    chefFee: 200,
  },
  rustic_italian: {
    label: "Rustic Italian",
    singles: {
      "ri-chicken-herb": 30.5,
      "ri-chicken-parm": 32.5,
      "ri-pork-marinara": 33.75,
      "ri-combo-chicken-parm": 40.0,
      "ri-combo-pork-chicken": 40.0,
      "ri-combo-pork-parm": 40.0,
    },
    byLabel: {
      "Grilled Italian Herb Chicken Breast (GF)": 30.5,
      "Chicken Parmigiana": 32.5,
      "Roasted Pork Tenderloin in Marinara (GF)": 33.75,
      "Grilled Italian Herb Chicken Breast & Chicken Parmigiana": 40.0,
      "Roasted Pork Tenderloin in Marinara & Grilled Italian Herb Chicken Breast": 40.0,
      "Roasted Pork Tenderloin in Marinara & Chicken Parmigiana": 40.0,
    },
  },
  classic_chicken: {
    label: "Classic Chicken Dinner",
    singles: {
      "cc-lemon": 30.5,
      "cc-mushroom": 30.5,
    },
  },
  live_pasta: {
    label: "Live Action Pasta Bar",
    singles: { "pasta-penne-station": 31.5 },
    chefFeeRules: [
      { min: 0, max: 149, chefs: 2, fee: 200 },
      { min: 150, chefs: 4, fee: 400 },
    ],
  },
  wood_fired_pizza: {
    label: "Wood Fired Pizza Bar",
    singles: {
      "pizza-margherita": 29.5,
      "pizza-pepperoni": 29.5,
      "pizza-veggie": 29.5,
    },
    chefFeeRules: [
      { min: 0, max: 74, chefs: 1, fee: 200 },
      { min: 75, chefs: 2, fee: 400 },
    ],
  },
  prime_rib: {
    label: "Prime Rib",
    singles: { "pr-carving": 61.95 },
    chefFee: 200,
  },
};

/* =========================
   Appetizer pricing/logic
========================= */
type AppKey =
  | "Charcuterie Board"
  | "Seasonal Fresh Fruit Platter"
  | "Seasonal Fresh Veggie Platter"
  | "Caprese Skewers"
  | "Peach Chipotle Meatballs"
  | "Hot Spinach Dip"
  | "Bruschetta";

const APP_PRICING: Record<string, {
  unit: "perGuest" | "platter" | "piece";
  price: number;
  serves?: number;     // for platters (guests each)
  minQty?: number;     // for pieces (minimum count)
  noun?: string;       // pretty noun for UI
}> = {
  "Charcuterie Board":                { unit: "perGuest", price: 11.95, noun: "guests" },
  "Seasonal Fresh Fruit Platter":     { unit: "platter",  price: 230,   serves: 50, noun: "platters" },
  "Seasonal Fresh Veggie Platter":    { unit: "platter",  price: 230,   serves: 50, noun: "platters" },
  "Caprese Skewers":                  { unit: "piece",    price: 3.25,  minQty: 50, noun: "skewers" },
  "Peach Chipotle Meatballs":         { unit: "platter",  price: 275,   serves: 50, noun: "platters" },
  "Hot Spinach Dip":                  { unit: "platter",  price: 195,   serves: 50, noun: "platters" },
  "Bruschetta":                       { unit: "piece",    price: 3.25,  minQty: 50, noun: "pieces" },
};

/* =========================
   Helpers used by Cart + Checkout
========================= */
export function calcPerGuestPrice(
  cuisineId: CuisineId,
  selections: SchnepfMenuSelections
): number {
  const P = PRICING[cuisineId];
  if (!P) return 0;

  const pickedLabel = selections.entrees?.[0] || "";

  if (P.byLabel && pickedLabel in P.byLabel) {
    return P.byLabel[pickedLabel]!;
  }

  if (pickedLabel && P.singles) {
    const entry = Object.entries(P.singles).find(([id]) =>
      pickedLabel.toLowerCase().includes((id.split("-")[1] || "").toLowerCase())
    );
    if (entry) return entry[1];
  }

  return 0;
}

export function calcChefFee(cuisineId: CuisineId, guestCount: number): number {
  const P = PRICING[cuisineId];
  if (!P) return 0;

  if (P.chefFeeRules?.length) {
    const rule = P.chefFeeRules.find(
      (r) => guestCount >= r.min && (r.max == null || guestCount <= r.max)
    );
    return rule ? rule.fee : 0;
  }
  return P.chefFee || 0;
}

// Shorter labels for app rows
const SHORT_APP_NAMES: Record<string, string> = {
  "Charcuterie Board": "Charcuterie",
  "Seasonal Fresh Fruit Platter": "Fruit Platter",
  "Seasonal Fresh Veggie Platter": "Veggie Platter",
  "Caprese Skewers": "Caprese Skewers",
  "Peach Chipotle Meatballs": "Meatballs",
  "Hot Spinach Dip": "Spinach Dip",
  "Bruschetta": "Bruschetta",
};
const shortAppName = (name: string) => SHORT_APP_NAMES[name] || name;

/* =========================
   Props
========================= */
interface Props {
  cuisineId: CuisineId;
  selections: SchnepfMenuSelections;
  onContinueToCheckout: () => void;
  onBackToMenu: () => void;
  onClose: () => void;

  appetizers?: string[];

  setTotal: (grandTotal: number) => void;
  setLineItems: (items: string[]) => void;
  setPaymentSummaryText: (text: string) => void;

  upgradesPerGuest?: Array<{ id: string; label: string; price: number }>;
  upgradesFlat?: Array<{ id: string; label: string; price: number }>;
}

// Qty UI helpers (shared by Apps + Per-Guest upgrades)
const qtyBtn = (bg: string, disabled?: boolean): React.CSSProperties => ({
  width: 32,
  height: 32,
  borderRadius: 8,
  border: "none",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "1.15rem",
  lineHeight: 1,
  fontWeight: 800,
  color: "#fff",
  background: disabled ? "#cbd5e1" : bg,
  cursor: disabled ? "not-allowed" : "pointer",
  boxShadow: "0 1px 0 rgba(0,0,0,.05)",
});

const qtyWrap: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "#fff",
  border: "1px solid #dfe3f0",
  borderRadius: 10,
  padding: 4,
  height: 40,
};

const qtyInputStyle: React.CSSProperties = {
  width: 68,
  height: 28,
  border: "none",
  textAlign: "center",
  fontSize: "1rem",
  outline: "none",
  background: "transparent",
};

/* =========================
   Component
========================= */
const SchnepfCartCatering: React.FC<Props> = ({
  cuisineId,
  selections,
  onContinueToCheckout,
  onBackToMenu,
  onClose,
  appetizers = [],
  setTotal,
  setLineItems,
  setPaymentSummaryText,
  upgradesPerGuest = [],
  upgradesFlat = [],
}) => {
  const [gc, setGC] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState<string[]>([]);
  const [cartApps, setCartApps] = useState<string[]>(appetizers ?? []);

  // remove one appetizer from the cart (and persist)
const removeApp = (key: string) => {
  setCartApps((prev) => {
    const next = prev.filter((k) => k !== key);

    // keep qty map in sync
    setAppQtys((q) => {
      const { [key]: _omit, ...rest } = q;
      return rest;
    });

    // persist to the same LS key the Apps screen uses
    try {
      localStorage.setItem("schnepfAppsSelected", JSON.stringify(next));
    } catch {}

    // optional: mirror into Firestore for the light checkpoint
    onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      try {
        await setDoc(
          doc(db, "users", user.uid, "yumYumData", "schnepfApps"),
          { selected: next },
          { merge: true }
        );
      } catch {}
    });

    return next;
  });
};

  // Editable quantities for each appetizer row
const [appQtys, setAppQtys] = useState<Record<string, number>>({});

// ✅ Declare per-guest upgrade quantities here so it's defined before use
const [ppQty, setPpQty] = useState<Record<string, number>>({});

const clampPpQty = (id: string, n: number) => {
  const min = 0;
  const max = Math.max(0, Number(gc) || 0);
  if (!Number.isFinite(n)) return min;
  return Math.min(Math.max(n, min), max);
};

// Keep ppQty synced with upgrades + guest count
useEffect(() => {
  setPpQty((cur) => {
    const next = { ...cur };
    for (const u of upgradesPerGuest) {
      const current = next[u.id];
      if (current == null) next[u.id] = clampPpQty(u.id, Number(gc) || 0);
      else next[u.id] = clampPpQty(u.id, current);
    }
    for (const k of Object.keys(next)) {
      if (!upgradesPerGuest.some((u) => u.id === k)) delete (next as any)[k];
    }
    return next;
  });
}, [gc, upgradesPerGuest]);

  const cuisineLabel = PRICING[cuisineId]?.label || "Cuisine";

  /* ---------- Appetizers hydrate (prop -> LS -> Firestore) ---------- */
  const normalizeApps = (raw: unknown): string[] => {
    if (Array.isArray(raw)) {
      if (raw.length && typeof raw[0] === "object") {
        return (raw as any[])
          .map((o) => (o?.label ?? o?.name ?? "").toString())
          .filter(Boolean);
      }
      return (raw as any[]).map(String).filter(Boolean);
    }
    if (typeof raw === "string") {
      try {
        return normalizeApps(JSON.parse(raw));
      } catch {
        return raw.split(/,\s*|\n+/).map((s) => s.trim()).filter(Boolean);
      }
    }
    return [];
  };

  useEffect(() => {
    let alive = true;

    const fromLocalStorage = (): string[] => {
      const keys = [
        "schnepfAppsSelected",     // written by SchnepfApps
        "schnepfApps:selected",
        "schnepfApps",
        "yumApps",
        "yumYumApps",
        "appsSelected",
      ];
      for (const k of keys) {
        const raw = localStorage.getItem(k);
        if (raw) {
          const list = normalizeApps(raw);
          if (list.length) return list;
        }
      }
      return [];
    };

    const fromFirestore = async (): Promise<string[]> => {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) return [];
      try {
        const refs = [
          doc(db, "users", user.uid, "yumYumData", "schnepfApps"),
          doc(db, "users", user.uid, "apps", "schnepf"),
        ];
        for (const r of refs) {
          const snap = await getDoc(r);
          if (snap.exists()) {
            const d = snap.data() as any;
            const candidates = d?.selected ?? d?.items ?? d?.list ?? d;
            const list = normalizeApps(candidates);
            if (list.length) return list;
          }
        }
      } catch {}
      return [];
    };

    (async () => {
      if (appetizers?.length) {
        if (alive) setCartApps(appetizers);
        return;
      }
      const ls = fromLocalStorage();
      if (ls.length) {
        if (alive) setCartApps(ls);
        return;
      }
      const fs = await fromFirestore();
      if (alive && fs.length) setCartApps(fs);
    })();

    return () => { alive = false; };
  }, [appetizers]);

  /* ---------- Guest count hydrate/lock ---------- */
  useEffect(() => {
    let alive = true;
    const hydrate = async () => {
      const st = await getGuestState();
      if (!alive) return;
      const v = Number(st.value || 0);
      setGC(v);
      setLocked(!!st.locked);
      setLockedBy((st as any).lockedBy || (st as any).guestCountLockedBy || []);
    };
    hydrate();

    const sync = () => hydrate();
    window.addEventListener("guestCountUpdated", sync);
    window.addEventListener("guestCountLocked", sync);
    window.addEventListener("guestCountUnlocked", sync);
    return () => {
      alive = false;
      window.removeEventListener("guestCountUpdated", sync);
      window.removeEventListener("guestCountLocked", sync);
      window.removeEventListener("guestCountUnlocked", sync);
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists()) return;
        const d = snap.data() || {};
        const b = (d.bookings ?? {}) as Record<string, any>;
        const shouldLock = b.venue || b.planner || b.catering || b.desserts;
        if (shouldLock) {
          const reason: GuestLockReason =
            (b.venue && "venue") ||
            (b.planner && "planner") ||
            (b.catering && "catering") ||
            "desserts";
          const st = await getGuestState();
          if (!st.locked) {
            await setAndLockGuestCount(Number(st.value || 0), reason);
          }
        }
        const st2 = await getGuestState();
        setGC(Number(st2.value || 0));
        setLocked(!!st2.locked);
        setLockedBy((st2 as any).lockedBy || []);
      } catch {}
    });
    return () => unsub();
  }, []);

  /* ---------- Seed default appetizer quantities (respect user edits) ---------- */
  useEffect(() => {
  setAppQtys((cur) => {
    let changed = false;
    const next: Record<string, number> = { ...cur };

    for (const key of cartApps) {
      const cfg = APP_PRICING[key];
      if (!cfg) continue;

      // compute suggested default
      const suggested =
        cfg.unit === "platter" ? Math.max(1, Math.ceil(gc / (cfg.serves ?? 50)))
        : cfg.unit === "piece" ? Math.max(cfg.minQty ?? 0, gc)
        : /* perGuest */         Math.max(0, gc);

      // only set if missing/zero (treat 0 as "unseeded")
      const hasValue = next[key] != null && next[key] !== 0;
      if (!hasValue && next[key] !== suggested) {
        next[key] = suggested;
        changed = true;
      }
    }

    // prune removed apps
    for (const k of Object.keys(next)) {
      if (!cartApps.includes(k)) {
        delete next[k];
        changed = true;
      }
    }

    return changed ? next : cur;
  });
}, [cartApps, gc]);

  const clampAppQty = (key: string, raw: number) => {
    const cfg = APP_PRICING[key];
    if (!cfg) return 0;
  
    const n = Math.max(0, Math.floor(Number(raw) || 0));
  
    if (cfg.unit === "platter") return Math.max(1, n);
    if (cfg.unit === "piece")   return Math.max(cfg.minQty ?? 0, n);
  
    // perGuest: no upper cap (not locked to guest count)
    return n;
  };

  /* ---------- Math ---------- */
  const perGuest = useMemo(
    () => calcPerGuestPrice(cuisineId, selections),
    [cuisineId, selections]
  );
  const chefFee = useMemo(() => calcChefFee(cuisineId, gc), [cuisineId, gc]);

  // Build appetizer UI rows + compute appetizers total
  const appRows = useMemo(() => {
    const rows: Array<{
      key: string;
      qty: number;
      price: number;
      rhs: string;     // "$690.00"
      helper: string;  // "(50 guests each)" / "(min 50)" / "(suggested 120)"
      unitLabel: string;
    }> = [];
  
    for (const key of cartApps) {
      const cfg = APP_PRICING[key];
      if (!cfg) continue;
  
      // default suggestion:
      const suggested =
        cfg.unit === "platter" ? Math.max(1, Math.ceil(gc / (cfg.serves ?? 50)))
        : cfg.unit === "piece" ? Math.max(cfg.minQty ?? 0, gc)
        : /* perGuest */         gc;
  
      // editable qty (fall back to suggestion)
      const qty = appQtys[key] != null ? appQtys[key] : suggested;
  
      const price = cfg.price;
      const rhs = `$${(qty * price).toFixed(2)}`;
  
      const helper =
  cfg.unit === "platter"
    ? `(${cfg.serves ?? 50} guests each)`
    : cfg.unit === "piece"
    ? `(min ${cfg.minQty ?? 0})`
    : `(suggested ${gc})`; // 👈 per-guest hint
  
      const unitLabel =
        cfg.unit === "platter" ? (cfg.noun || "platters")
        : cfg.unit === "piece" ? (cfg.noun || "pieces")
        :                         (cfg.noun || "guests");
  
      rows.push({ key, qty, price, rhs, helper, unitLabel });
    }
    return rows;
  }, [cartApps, appQtys, gc]);

  const appetizersTotal = useMemo(
    () => appRows.reduce((sum, r) => sum + r.qty * r.price, 0),
    [appRows]
  );

  const upgradesPerGuestTotal = useMemo(
    () => upgradesPerGuest.reduce((sum, u) => {
      const qty = ppQty[u.id] ?? gc; // default to gc if user hasn’t touched it
      return sum + u.price * qty;
    }, 0),
    [upgradesPerGuest, ppQty, gc]
  );
  const upgradesFlatTotal = useMemo(
    () => upgradesFlat.reduce((sum, u) => sum + u.price, 0),
    [upgradesFlat]
  );

  const foodSubtotal =
    perGuest * gc + appetizersTotal + upgradesPerGuestTotal + upgradesFlatTotal;
  const preTaxTotal = foodSubtotal + chefFee;

  const serviceFee = preTaxTotal * SERVICE_FEE_RATE;
  const taxes = (preTaxTotal + serviceFee) * SALES_TAX_RATE;
  const stripeFee =
    (preTaxTotal + serviceFee + taxes) * STRIPE_FEE_RATE + STRIPE_FEE_FIXED;

  const taxesAndFees = taxes + stripeFee;
  const grandTotal = preTaxTotal + serviceFee + taxesAndFees;

  // === cart export snapshot (only changes when real inputs change) ===
const computed = React.useMemo(() => {
  const money = (n: number) => `$${(n ?? 0).toFixed(2)}`;

  const appetizerLines = appRows.map(
    (r) =>
      `${r.key}: ${r.qty} ${r.unitLabel} @ ${money(r.price)} — ${money(
        r.qty * r.price
      )}`
  );

  const exportLines = [
    ...appetizerLines,
    `${cuisineLabel}: ${gc} guests @ ${money(perGuest)}/guest`,
    ...upgradesPerGuest.map((u) => {
      const qty = ppQty[u.id] ?? gc;
      return `${u.label}: ${qty} @ ${money(u.price)}/guest — ${money(qty * u.price)}`;
    }),
    ...upgradesFlat.map((u) => `${u.label}: ${money(u.price)}`),
    ...(chefFee > 0 ? [`Chef fee: ${money(chefFee)}`] : []),
    `Service fee (22%): ${money(serviceFee)}`,
    `Taxes & fees: ${money(taxesAndFees)}`,
  ];

  const summary = `You're paying ${money(grandTotal)} today.`;

  return {
    exportLines,
    summary,
    grandTotal,
  };
  // deps = actual inputs
}, [
  appRows,
  cuisineLabel,
  gc,
  perGuest,
  upgradesPerGuest,
  upgradesFlat,
  chefFee,
  serviceFee,
  taxesAndFees,
  grandTotal,
]);

React.useEffect(() => {
  console.log("[SCH][Cart] computed snapshot ->", computed);
}, [computed]);

  // ---------- Persist + lift up (only when snapshot changes) ----------
const lastSentRef = React.useRef<string>("");

useEffect(() => {
  const snap = JSON.stringify(computed);
  if (snap === lastSentRef.current) return; // no-op if unchanged
  lastSentRef.current = snap;

  // 1) Lift to overlay (parent)
  setTotal?.(computed.grandTotal);
  setLineItems?.(computed.exportLines);
  setPaymentSummaryText?.(computed.summary);

  // 2) LocalStorage breadcrumbs (DO NOT set yumStep here)
  try {
    localStorage.setItem("schnepfCart:cuisineId", cuisineId);
    localStorage.setItem(
      "schnepfCart:grandTotal",
      String(computed.grandTotal.toFixed(2))
    );
  } catch {}

  // 3) Firestore snapshot (best-effort)
  (async () => {
    const user = getAuth().currentUser;
    if (!user) return;
    try {
      await setDoc(
        doc(db, "users", user.uid, "yumYumData", "schnepfCart"),
        {
          cuisineId,
          guestCount: gc,
          entrees: selections.entrees,
          salads: selections.salads,
          sides: selections.sides,
          appetizers: cartApps,
          lineTotal: Number(computed.grandTotal.toFixed(2)),
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "users", user.uid),
        { progress: { yumYum: { step: "schnepfCart" } } },
        { merge: true }
      );
    } catch {
      /* noop */
    }
  })();
}, [
  computed,            // 👈 single source of truth
  cuisineId,
  gc,
  selections,
  cartApps,
  setTotal,
  setLineItems,
  setPaymentSummaryText,
]);

 

// Seed / sync default quantities when upgrades list or guest count changes
useEffect(() => {
  setPpQty((cur) => {
    const next = { ...cur };
    for (const u of upgradesPerGuest) {
      const current = next[u.id];
      if (current == null) {
        // first time we see this id → default to gc
        next[u.id] = clampPpQty(u.id, Number(gc) || 0);
      } else {
        // if gc dropped below existing qty, clamp down
        next[u.id] = clampPpQty(u.id, current);
      }
    }
    // Clean out any ids that no longer exist
    for (const k of Object.keys(next)) {
      if (!upgradesPerGuest.some((u) => u.id === k)) delete (next as any)[k];
    }
    return next;
  });
}, [gc, upgradesPerGuest]);

  /* ---------- Handlers ---------- */
  const handleGuestChange = async (raw: string) => {
    if (locked) return;
    const next = Math.max(0, Math.min(500, Math.floor(Number(raw) || 0)));
    setGC(next);
    await setGuestCount(next);
  };

  const handleContinue = async () => {
    try {
      const st: any = await getGuestState();
      const value = Number(st?.value ?? gc ?? 0);
      const reasonsArr =
        ((st?.lockedReasons || st?.guestCountLockedBy || st?.lockedBy) as GuestLockReason[]) || [];
      if (!new Set(reasonsArr).has("yum:catering")) {
        try { await setAndLockGuestCount(value, "yum:catering"); } catch {}
      }
    } catch {
      /* non-blocking */
    }
    onContinueToCheckout(); // go to Contract; it will set plan + amounts
  };

  /* ---------- UI ---------- */
const entreeLine = `${selections.entrees[0] || "Entrée"} — $${perGuest.toFixed(2)}/guest`;

return (
  <div
    className="pixie-card"
    style={{ maxWidth: 700, margin: "0 auto", padding: "24px 24px 28px", textAlign: "center" }}
  >
    <video
      src="/assets/videos/yum_cart.mp4"
      autoPlay
      loop
      muted
      playsInline
      style={{ width: 180, margin: "0 auto 1.25rem", borderRadius: 12, display: "block" }}
    />

    <h2
      style={{
        fontFamily: "'Jenna Sue', cursive",
        fontSize: "2.2rem",
        color: "#2c62ba",
        marginBottom: ".5rem",
      }}
    >
      Your Catering Order — {cuisineLabel}
    </h2>

    {/* Appetizers */}
    {cartApps.length > 0 && (
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Appetizers</div>
        {cartApps.map((a, i) => (
          <div key={i}>{a}</div>
        ))}
      </div>
    )}

    {/* Entrée */}
    <div style={{ margin: "1rem 0 1.25rem" }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Entrée</div>
      <div>{entreeLine}</div>
    </div>

    {/* Salad */}
    <div style={{ marginBottom: "1.25rem" }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>Salad</div>
      {selections.salads.length ? (
        selections.salads.map((s, i) => <div key={i}>{s}</div>)
      ) : (
        <div>—</div>
      )}
    </div>

    {/* Sides */}
    {"sides" in selections && (
      <div style={{ marginBottom: "1.25rem" }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Sides</div>
        {selections.sides.length ? (
          selections.sides.map((s, i) => <div key={i}>{s}</div>)
        ) : (
          <div>—</div>
        )}
      </div>
    )}

    {/* Guest Count */}
    <div style={{ margin: "1.5rem 0 .5rem" }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>How many guests?</div>
      <input
        type="number"
        min={0}
        max={500}
        value={gc}
        disabled={locked}
        onChange={(e) => handleGuestChange(e.target.value)}
        style={{
          padding: "0.5rem",
          fontSize: "1rem",
          width: 120,
          borderRadius: 8,
          textAlign: "center",
          background: locked ? "#f4f6fb" : "#fff",
          color: locked ? "#666" : "#000",
          border: "1px solid #ccc",
        }}
      />
      {locked && (
        <div style={{ marginTop: ".5rem", fontSize: ".9rem", color: "#666" }}>
          Locked after: <strong>{lockedBy.join(", ") || "a booking"}</strong>.
        </div>
      )}
    </div>

    {/* Money — single stacked column */}
    <div style={{ marginTop: "1rem", textAlign: "left" }}>
      <div style={{ maxWidth: 440, margin: "0 auto" }}>
        {(() => {
          const fmt = (n: number) => `$${Number(n || 0).toFixed(2)}`;

          return (
            <>
              {/* ---------- APPS (stacked, editable) ---------- */}
              {appRows.map((r) => {
                const meta = APP_PRICING[r.key];
                const min = meta.unit === "platter" ? 1 : meta.unit === "piece" ? meta.minQty ?? 0 : 0;

                return (
                  <div
                    key={`stack-app-${r.key}`}
                    style={{ borderTop: "1px solid #eaeaea", paddingTop: 12, paddingBottom: 12 }}
                  >
                    {/* Title + total + remove */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "baseline",
                        gap: 8,
                      }}
                    >
                      <div
                        style={{
                          fontWeight: 800,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={r.key}
                      >
                        {r.key}
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{ fontWeight: 800 }}>{r.rhs}</div>
                        <button
                          aria-label={`Remove ${r.key}`}
                          onClick={() => removeApp(r.key)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#ef4444",
                            cursor: "pointer",
                            fontSize: "1.15rem",
                            lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      </div>
                    </div>

                    {/* Controls + unit price + helper (Floral-style controls) */}
<div
  style={{
    marginTop: 8,
    display: "flex",
    alignItems: "center",
    gap: 10,
    flexWrap: "wrap",
    color: "#334155",
    fontSize: ".95rem",
  }}
>
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    {/* Quantity controls */}
    <div className="px-qty">
      <button
        type="button"
        className="px-qty-btn px-qty-btn--minus"
        onClick={() =>
          setAppQtys((cur) => ({
            ...cur,
            [r.key]: clampAppQty(r.key, (cur[r.key] ?? r.qty ?? 0) - 1),
          }))
        }
        aria-label={`Decrease ${r.key}`}
      >
        <img src="/assets/icons/qty_minus_pink_glossy.svg" alt="" aria-hidden="true" />
      </button>

      <input
        type="number"
        min={min}
        value={appQtys[r.key] ?? r.qty}
        onChange={(e) =>
          setAppQtys((cur) => ({
            ...cur,
            [r.key]: clampAppQty(r.key, Number(e.target.value)),
          }))
        }
        className="px-input-number"
        inputMode="numeric"
      />

      <button
        type="button"
        className="px-qty-btn px-qty-btn--plus"
        onClick={() =>
          setAppQtys((cur) => ({
            ...cur,
            [r.key]: clampAppQty(r.key, (cur[r.key] ?? r.qty ?? 0) + 1),
          }))
        }
        aria-label={`Increase ${r.key}`}
      >
        <img src="/assets/icons/qty_plus_blue_glossy.svg" alt="" aria-hidden="true" />
      </button>
    </div>

    <span style={{ whiteSpace: "nowrap" }}>{r.unitLabel}</span>
  </div>

  <span>@ {fmt(r.price)}</span>
  {r.helper && <span style={{ opacity: 0.7 }}>{r.helper}</span>}
</div>

                    {/* Subtotal line */}
                    <div style={{ marginTop: 6, color: "#64748b", fontSize: ".92rem" }}>
                      Subtotal: <strong>{r.rhs}</strong>
                    </div>
                  </div>
                );
              })}

              {/* ---------- Cuisine / Entrée ---------- */}
              <div style={{ borderTop: "1px solid #eaeaea", paddingTop: 12, paddingBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontWeight: 800 }}>{cuisineLabel}</div>
                  <div style={{ fontWeight: 800 }}>{fmt(perGuest * gc)}</div>
                </div>
                <div style={{ marginTop: 6, color: "#64748b", fontSize: ".92rem" }}>
                  {gc} @ {fmt(perGuest)} / guest = <strong>{fmt(perGuest * gc)}</strong>
                </div>
              </div>

              {/* ---------- Per-guest upgrades (editable, branded +/−) ---------- */}
{upgradesPerGuest.map((u) => {
  const qty = ppQty[u.id] ?? Math.max(0, Number(gc) || 0);
  const line = u.price * qty;

  return (
    <div
      key={`upg-pp-${u.id}`}
      style={{
        borderTop: "1px solid #eaeaea",
        paddingTop: 12,
        paddingBottom: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        {/* Label + branded qty controls */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontWeight: 800 }}>{u.label}</div>

          {/* Quantity controls (Floral-style) */}
<div className="px-qty">
  <button
    type="button"
    className="px-qty-btn px-qty-btn--minus"
    onClick={() =>
      setPpQty((cur) => ({
        ...cur,
        [u.id]: clampPpQty(u.id, (cur[u.id] ?? qty) - 1),
      }))
    }
    aria-label={`Decrease ${u.label} quantity`}
  >
    <img src="/assets/icons/qty_minus_pink_glossy.svg" alt="" aria-hidden="true" />
  </button>

  <input
    type="number"
    min={0}
    max={Math.max(0, Number(gc) || 0)}
    value={qty}
    onChange={(e) =>
      setPpQty((cur) => ({
        ...cur,
        [u.id]: clampPpQty(u.id, Number(e.target.value)),
      }))
    }
    className="px-input-number"
    inputMode="numeric"
  />

  <button
    type="button"
    className="px-qty-btn px-qty-btn--plus"
    onClick={() =>
      setPpQty((cur) => ({
        ...cur,
        [u.id]: clampPpQty(u.id, (cur[u.id] ?? qty) + 1),
      }))
    }
    aria-label={`Increase ${u.label} quantity`}
  >
    <img src="/assets/icons/qty_plus_blue_glossy.svg" alt="" aria-hidden="true" />
  </button>
</div>
        </div>

        {/* Line total */}
        <div style={{ fontWeight: 800 }}>${line.toFixed(2)}</div>
      </div>

      {/* Breakdown line */}
      <div style={{ marginTop: 6, color: "#64748b", fontSize: ".92rem" }}>
        {qty} @ ${u.price.toFixed(2)} / guest ={" "}
        <strong>${line.toFixed(2)}</strong>
        {Number(gc) > 0 && qty !== Number(gc) && (
          <span style={{ marginLeft: 8, opacity: 0.75 }}>
            (suggested: {gc})
          </span>
        )}
      </div>
    </div>
  );
})}

              {/* ---------- Flat upgrades ---------- */}
              {upgradesFlat.map((u) => (
                <div key={`upg-flat-${u.id}`} style={{ borderTop: "1px solid #eaeaea", paddingTop: 12, paddingBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ fontWeight: 800 }}>{u.label}</div>
                    <div style={{ fontWeight: 800 }}>{fmt(u.price)}</div>
                  </div>
                  <div style={{ marginTop: 6, color: "#64748b", fontSize: ".92rem" }}>
                    Subtotal: <strong>{fmt(u.price)}</strong>
                  </div>
                </div>
              ))}

              {/* ---------- Chef fee ---------- */}
              {chefFee > 0 && (
                <div style={{ borderTop: "1px solid #eaeaea", paddingTop: 12, paddingBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                    <div style={{ fontWeight: 800 }}>Chef fee</div>
                    <div style={{ fontWeight: 800 }}>{fmt(chefFee)}</div>
                  </div>
                  <div style={{ marginTop: 6, color: "#64748b", fontSize: ".92rem" }}>
                    Subtotal: <strong>{fmt(chefFee)}</strong>
                  </div>
                </div>
              )}

              {/* ---------- Service fee (22%) ---------- */}
              <div style={{ borderTop: "1px solid #eaeaea", paddingTop: 12, paddingBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontWeight: 800 }}>Service fee (22%)</div>
                  <div style={{ fontWeight: 800 }}>{fmt(serviceFee)}</div>
                </div>
              </div>

              {/* ---------- Taxes & fees ---------- */}
              <div style={{ borderTop: "1px solid #eaeaea", paddingTop: 12, paddingBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <div style={{ fontWeight: 800 }}>Taxes &amp; fees</div>
                  <div style={{ fontWeight: 800 }}>{fmt(taxesAndFees)}</div>
                </div>
              </div>

              {/* ---------- Grand total ---------- */}
              <div
                style={{
                  borderTop: "1px solid #eaeaea",
                  paddingTop: 14,
                  marginTop: 4,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <strong style={{ fontSize: "1.05rem" }}>Total</strong>
                <strong style={{ fontSize: "1.05rem" }}>{fmt(grandTotal)}</strong>
              </div>
            </>
          );
        })()}
      </div>
    </div>

    {/* Footer CTAs */}
    <div
      style={{
        marginTop: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.75rem",
        alignItems: "center",
      }}
    >
      <button type="button" className="boutique-primary-btn" onClick={handleContinue} style={{ width: 260 }}>
        Confirm &amp; Book
      </button>
      <button className="boutique-back-btn" style={{ width: 260 }} onClick={onBackToMenu}>
        ⬅ Back to Menu
      </button>
    </div>

    {/* Mobile padding safety */}
    <style>{`
      @media (max-width: 480px) {
        .pixie-card { padding-inline: 16px !important; }
      }
    `}</style>
  </div>
);
};

export default SchnepfCartCatering;