// src/components/NewYumBuild/catering/YumCartCatering.tsx
import React, { useEffect, useState, useMemo } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import {
  getGuestState,
  setGuestCount,
  setAndLockGuestCount,
  type GuestLockReason,
} from "../../../utils/guestCountStore";

// 🔹 Santi config + types
import {
  santisMenuConfig,
  SantiCuisineKey,
  SantiMenuItem,
} from "./santisMenuConfig";

const SALES_TAX_RATE = 0.086;
const STRIPE_RATE = 0.029;
const STRIPE_FLAT_FEE = 0.3;

const formatCurrency = (amount: number) =>
  amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

type TierId = "signature" | "chef";

type MenuSelections = {
  appetizers: string[];
  mains: string[];
  sides: string[];
  salads: string[];
};

interface YumCartProps {
  guestCount: number; // still here for back-compat, but we drive from store
  onGuestCountChange: (count: number) => void;
  setAddCharcuterie: (value: boolean) => void;
  selectedCuisine: SantiCuisineKey | null;
  menuSelections: MenuSelections;
  setMenuSelections: (menu: MenuSelections) => void;
  setTotal: (grandTotal: number) => void;
  setLineItems: (items: string[]) => void;
  setPaymentSummaryText: (text: string) => void;
  onContinueToCheckout: () => void;
  onStartOver: () => void;
  onClose: () => void;
  weddingDate: string | null;
  tier: TierId;
}

const clamp = (n: number) => Math.max(0, Math.min(250, Math.floor(n) || 0));

const YumCartCatering: React.FC<YumCartProps> = ({
  onGuestCountChange,
  selectedCuisine,
  menuSelections,
  setMenuSelections,
  setTotal,
  setLineItems,
  setPaymentSummaryText,
  onContinueToCheckout,
  onStartOver,
  onClose,
  tier,
}) => {

  const YUM_RESUME_CART_KEY = "yumResumeCartStep"; // "cateringCart" | "dessertCart"

  const cuisineLabels: Record<SantiCuisineKey, string> = {
    italian: "Italian Bounty",
    american: "Classic American",
    mexican: "Mexican Fiesta",
    taco: "Taco Bar",
  };

  const cuisineLabel = selectedCuisine
    ? cuisineLabels[selectedCuisine]
    : "Cuisine Not Selected";

  // Local copy of selections just for display
  const [localMenuSelections, setLocalMenuSelections] =
    useState<MenuSelections>(menuSelections);

    const { appetizers = [], mains = [], sides = [], salads = [] } = localMenuSelections;
  const [tacoCondiments, setTacoCondiments] = useState(false);

  // ─────────────── Optional display platters (cocktail hour) ───────────────
const [showPlatters, setShowPlatters] = useState(false);

type PlatterType = "fruit" | "veggie" | "cheeseMeat";
type PlatterSize = "small" | "medium" | "large";

const [platterType, setPlatterType] = useState<PlatterType | null>(null);
const [platterSize, setPlatterSize] = useState<PlatterSize | null>(null);
const [platterFlorals, setPlatterFlorals] = useState(false);

const platterBasePrices: Record<PlatterType, Record<PlatterSize, number>> = {
  fruit: { small: 160, medium: 250, large: 300 },
  veggie: { small: 160, medium: 250, large: 300 },
  cheeseMeat: { small: 275, medium: 575, large: 775 },
};

const platterServings: Record<PlatterSize, string> = {
  small: "25–30 guests",
  medium: "60–70 guests",
  large: "90–100 guests",
};

const platterFloralsPrices: Record<PlatterSize, number> = {
  small: 100,
  medium: 150,
  large: 200,
};

const platterLabel =
  platterType === "fruit"
    ? "Fruit Platter"
    : platterType === "veggie"
    ? "Veggie Platter"
    : platterType === "cheeseMeat"
    ? "Cheese & Meat Platter"
    : "";

const platterTotal =
  platterType && platterSize
    ? platterBasePrices[platterType][platterSize] +
      (platterFlorals ? platterFloralsPrices[platterSize] : 0)
    : 0;

const platterSummary =
  platterType && platterSize
    ? `${platterLabel} (${platterSize})${platterFlorals ? " + Florals" : ""}`
    : "None";

  // Single-source guest count state
  const [gc, setGC] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState<string[]>([]);

  useEffect(() => {
    try {
      localStorage.setItem(YUM_RESUME_CART_KEY, "cateringCart");
      localStorage.setItem("yumStep", "cateringCart");
      localStorage.setItem("yumActiveBookingType", "catering");
      localStorage.setItem("yumBookingType", "catering");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("yumResumeCartStep", "cateringCart");
    } catch {}
  }, []);

  // ───────────────── Guest count hydrate + subscribe ─────────────────
  useEffect(() => {
    let alive = true;
    let hydratedFromAccount = false;

    const hydrate = async () => {
      const st = await getGuestState();
      if (!alive) return;

      const v = Number((st as any).value ?? 0);
      setGC(v);
      setLocked(Boolean((st as any).locked));
      setLockedBy(
        ((st as any).lockedBy ??
          (st as any).lockedReasons ??
          []) as string[]
      );
      onGuestCountChange?.(v);

      // If store is empty, seed from LS, then Firestore
      if (!hydratedFromAccount && v === 0) {
        hydratedFromAccount = true;

        const lsSeed = Number(
          localStorage.getItem("guestCount") ||
            localStorage.getItem("yumGuestCount") ||
            "0"
        );
        if (lsSeed > 0) {
          setGC(lsSeed);
          await setGuestCount(lsSeed);
          onGuestCountChange?.(lsSeed);
          return;
        }

        const user = getAuth().currentUser;
        if (user) {
          try {
            const snap = await getDoc(doc(db, "users", user.uid));
            const data = snap.exists() ? (snap.data() as any) : null;
            const fsSeed = Number(data?.guestCount || 0);
            if (fsSeed > 0) {
              setGC(fsSeed);
              await setGuestCount(fsSeed);
              onGuestCountChange?.(fsSeed);
            }
          } catch (e) {
            console.warn(
              "⚠️ Could not hydrate guest count from Firestore:",
              e
            );
          }
        }
      }
    };

    hydrate();

    const onUpdate = () => hydrate();
    window.addEventListener("guestCountUpdated", onUpdate);
    window.addEventListener("guestCountLocked", onUpdate);
    window.addEventListener("guestCountUnlocked", onUpdate);

    return () => {
      alive = false;
      window.removeEventListener("guestCountUpdated", onUpdate);
      window.removeEventListener("guestCountLocked", onUpdate);
      window.removeEventListener("guestCountUnlocked", onUpdate);
    };
  }, [onGuestCountChange]);

  // ───────────────── Lock logic (venue / planner / catering / desserts) ─────────────────
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists()) return;
        const d = snap.data() || {};
        const b = (d.bookings ?? {}) as Record<string, any>;

        const hasVenueBooked = b.venue === true;
        const hasPlannerBooked = b.planner === true;
        const hasCateringBooked = b.catering === true;
        const hasDessertsBooked = b.dessert === true || b.desserts === true;
        
        const shouldLock =
          hasVenueBooked || hasPlannerBooked || hasCateringBooked || hasDessertsBooked;
        
        if (shouldLock) {
          let reason: GuestLockReason | null = null;
        
          if (hasVenueBooked) reason = "venue";
          else if (hasPlannerBooked) reason = "planner";
          else if (hasCateringBooked) reason = "catering";
          else if (hasDessertsBooked) reason = "dessert"; // ✅ singular matches union
        
          if (reason) {
            const st = await getGuestState();
            if (!st.locked) {
              await setAndLockGuestCount(Number(st.value || 0), reason);
            }
          }
        }

        const st2 = await getGuestState();
        setGC(Number(st2.value || 0));
        setLocked(!!st2.locked);
        setLockedBy(st2.lockedBy || []);
        onGuestCountChange?.(Number(st2.value || 0));
      } catch (e) {
        console.warn("⚠️ booking lock check failed:", e);
      }
    });
    return () => unsub();
  }, [onGuestCountChange]);

  // ───────────────── Restore menu selections + charcuterie ─────────────────
  useEffect(() => {
    const localSelections = localStorage.getItem("yumMenuSelections");
    if (localSelections) {
      try {
        const parsed = JSON.parse(localSelections) as Partial<MenuSelections>;
        if (parsed.appetizers || parsed.mains || parsed.sides || parsed.salads) {
          const merged: MenuSelections = {
            appetizers: parsed.appetizers || [],
            mains: parsed.mains || [],
            sides: parsed.sides || [],
            salads: parsed.salads || [],
          };
          setLocalMenuSelections(merged);
          setMenuSelections(merged);
        }
      } catch {
        /* noop */
      }
    }

    onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      try {
        const menuDoc = await getDoc(
          doc(db, "users", user.uid, "yumYumData", "menuSelections")
        );
        const data = menuDoc.data() as Partial<MenuSelections> | undefined;
        if (data) {
          const merged: MenuSelections = {
            appetizers: data.appetizers || [],
            mains: data.mains || [],
            sides: data.sides || [],
            salads: data.salads || [],
          };
          setLocalMenuSelections(merged);
          setMenuSelections(merged);
        }
      } catch {
        /* noop */
      }
    });
  }, [setMenuSelections]);

  // ───────────────── Restore taco condiments toggle ─────────────────
useEffect(() => {
  const localTacoCond = localStorage.getItem("yumTacoFullCondiments");
  if (localTacoCond) setTacoCondiments(localTacoCond === "true");

  onAuthStateChanged(getAuth(), async (user) => {
    if (!user) return;
    try {
      const cartDoc = await getDoc(
        doc(db, "users", user.uid, "yumYumData", "cartData")
      );
      const data = cartDoc.data() as any;
      if (data?.tacoFullCondiments !== undefined) {
        setTacoCondiments(Boolean(data.tacoFullCondiments));
      }
    } catch {
      /* noop */
    }
  });
}, []);

// ───────────────── Restore platter selection ─────────────────
useEffect(() => {
  // LocalStorage
  try {
    const raw = localStorage.getItem("yumPlatters");
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<{
        platterType: PlatterType | null;
        platterSize: PlatterSize | null;
        platterFlorals: boolean;
      }>;
      if (parsed.platterType) setPlatterType(parsed.platterType);
      if (parsed.platterSize) setPlatterSize(parsed.platterSize);
      if (typeof parsed.platterFlorals === "boolean")
        setPlatterFlorals(parsed.platterFlorals);
    }
  } catch {
    /* noop */
  }

  // Firestore
  onAuthStateChanged(getAuth(), async (user) => {
    if (!user) return;
    try {
      const cartDoc = await getDoc(
        doc(db, "users", user.uid, "yumYumData", "cartData")
      );
      const data = cartDoc.data() as any;
      if (data?.platters) {
        setPlatterType(data.platters.platterType ?? null);
        setPlatterSize(data.platters.platterSize ?? null);
        setPlatterFlorals(Boolean(data.platters.platterFlorals));
      }
    } catch {
      /* noop */
    }
  });
}, []);


// ─────────────── Pricing helpers (base + upgrades) ───────────────
const basePricePerGuest = useMemo(() => {
  if (!selectedCuisine) return 0;
  const price = santisMenuConfig.basePricePerGuest[tier];
  return typeof price === "number" ? price : 0;
}, [selectedCuisine, tier]);

const perGuestUpgradeTotal = useMemo(() => {
  if (!selectedCuisine) return 0;

  const cuisineCfg = santisMenuConfig.cuisines[selectedCuisine];
  if (!cuisineCfg) return 0;

  const maxSelectedFee = (items: SantiMenuItem[], chosen: string[]) =>
    items.reduce((max, item) => {
      const fee = Number(item.upgradeFeePerGuest || 0);
      if (fee <= 0) return max;
      if (!chosen.includes(item.name)) return max;
      return Math.max(max, fee);
    }, 0);

  const sumSelectedFee = (items: SantiMenuItem[], chosen: string[]) =>
    items.reduce((sum, item) => {
      const fee = Number(item.upgradeFeePerGuest || 0);
      if (fee <= 0) return sum;
      if (!chosen.includes(item.name)) return sum;
      return sum + fee;
    }, 0);

  // ✅ Premium entrée pricing = prevailing (highest selected entree upgrade)
  const entreePremiumPerGuest = maxSelectedFee(cuisineCfg.entrees, mains);

  // ✅ If later you add paid upgrades in sides/salads, keep them additive
  const otherUpgradesPerGuest =
    sumSelectedFee(cuisineCfg.sides, sides) +
    sumSelectedFee(cuisineCfg.salads, salads);

  return entreePremiumPerGuest + otherUpgradesPerGuest;
}, [selectedCuisine, mains, sides, salads]);

const TACO_CONDIMENTS_PRICE =
  santisMenuConfig.extras.tacoFullCondiments.upgradeFeePerGuest;

const tacoCondimentsSubtotal =
  selectedCuisine === "taco" && tacoCondiments ? gc * TACO_CONDIMENTS_PRICE : 0;

const baseSubtotal = gc * basePricePerGuest;
const upgradesSubtotal = gc * perGuestUpgradeTotal;

const platterSubtotal = platterTotal; // flat add-on (not per guest)
const subtotal = baseSubtotal + upgradesSubtotal + tacoCondimentsSubtotal + platterSubtotal;

const taxesAndFees =
  subtotal * SALES_TAX_RATE + subtotal * STRIPE_RATE + STRIPE_FLAT_FEE;

const grandTotal = subtotal + taxesAndFees;


// ───────────────── Persist cart + summary ─────────────────
useEffect(() => {
  localStorage.setItem("yumGuestCount", String(gc));
  localStorage.setItem("yumTacoFullCondiments", tacoCondiments.toString());
  localStorage.setItem("yumStep", "cateringCart");

  try {
    localStorage.setItem(
      "yumPlatters",
      JSON.stringify({ platterType, platterSize, platterFlorals })
    );
  } catch {}

  onAuthStateChanged(getAuth(), async (user) => {
    if (!user) return;
    try {
      await setDoc(
        doc(db, "users", user.uid, "yumYumData", "cartData"),
        {
          guestCount: gc,
          tacoFullCondiments: tacoCondiments,
          platters: { platterType, platterSize, platterFlorals },
        },
        { merge: true }
      );
      await setDoc(
        doc(db, "users", user.uid),
        { progress: { yumYum: { step: "cateringCart" } } },
        { merge: true }
      );
    } catch (err) {
      console.error("❌ Failed to save cart data to Firestore:", err);
    }
  });

  const items: string[] = [];

  items.push(
    `${tier === "chef" ? "Chef’s Feast" : "Signature Feast"} – ` +
      `${gc} guests @ $${formatCurrency(basePricePerGuest)}/guest`
  );

  if (platterType && platterSize) {
    const floralsFee = platterFlorals ? platterFloralsPrices[platterSize] : 0;
    items.push(
      `Display Platter – ${platterLabel} (${platterSize}, serves ${platterServings[platterSize]})` +
        ` – $${formatCurrency(platterBasePrices[platterType][platterSize])}` +
        (floralsFee ? ` + Florals $${formatCurrency(floralsFee)}` : "")
    );
  }

  if (perGuestUpgradeTotal > 0) {
    items.push(
      `Menu upgrades – ${gc} guests @ $${formatCurrency(
        perGuestUpgradeTotal
      )}/guest`
    );
  }

  if (selectedCuisine === "taco" && tacoCondiments) {
    items.push(
      `Full Condiments Bar – ${gc} guests @ $${TACO_CONDIMENTS_PRICE.toFixed(
        2
      )}/guest`
    );
  }

  setTotal(grandTotal);
  setLineItems(items);

  let summary = `You're paying $${formatCurrency(
    grandTotal
  )} today, including taxes & fees.`;
  if (perGuestUpgradeTotal > 0) {
    summary += ` That includes upgraded menu selections.`;
  }

  if (platterType && platterSize) {
    summary += ` A cocktail-hour platter is included.`;
  }

  setPaymentSummaryText(summary);
}, [
  gc,
  tacoCondiments,
  basePricePerGuest,
  perGuestUpgradeTotal,
  grandTotal,
  setTotal,
  setLineItems,
  setPaymentSummaryText,
  tier,
  selectedCuisine,
  platterType,
platterSize,
platterFlorals,
platterTotal,
]);

  // ───────────────── Handlers ─────────────────
  const handleGuestChange = async (raw: string) => {
    if (locked) return;
    const next = clamp(parseInt(raw, 10));
    setGC(next);
    onGuestCountChange?.(next);
    await setGuestCount(next);
  };

  const handleContinueToCheckoutFromCart = async () => {
    const st = await getGuestState();
    const value = Number(
      st.value ?? localStorage.getItem("yumGuestCount") ?? 0
    );
  
    // ✅ keep the count saved, but DO NOT lock yet
    await setGuestCount(value);
  
    // Optional: mark intent so we can lock later *after* payment success
    try {
      localStorage.setItem("yumPendingGuestLock", "catering");
    } catch {}
  
    onContinueToCheckout();
  };

  // ───────────────── Render ─────────────────
  return (
    <div
      className="pixie-card wd-page-turn"
      style={{
        maxWidth: "700px",
        textAlign: "center",
        position: "relative",
        padding: "2rem 2rem 3rem",
      }}
    >
      {/* 🌸 Pink X close button */}
      <button
        onClick={onClose}
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
          src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
          alt="Close"
          style={{ width: 22, height: 22 }}
        />
      </button>

      <video
        src={`${import.meta.env.BASE_URL}assets/videos/yum_cart.mp4`}
        autoPlay
        loop
        muted
        playsInline
        style={{
          width: "180px",
          margin: "0 auto 1.5rem",
          borderRadius: "12px",
        }}
      />

      <h2
        style={{
          fontFamily: "'Jenna Sue', cursive",
          fontSize: "2.2rem",
          color: "#2c62ba",
        }}
      >
        Your Catering Order
      </h2>

      <div style={{ marginBottom: "2rem", textAlign: "center" }}>
        <h3
          style={{
            fontFamily: "'Jenna Sue', cursive",
            fontSize: "1.6rem",
            color: "#2c62ba",
          }}
        >
          Cuisine:
        </h3>
        <p>{cuisineLabel}</p>
        <p style={{ marginTop: ".25rem", fontSize: ".95rem", color: "#555" }}>
          {tier === "chef" ? "Chef’s Feast" : "Signature Feast"}
        </p>
      </div>

      {/* 🍇 Optional display platters (cocktail hour) */}
<div style={{ marginBottom: "2rem", textAlign: "center" }}>
  <button
    type="button"
    onClick={() => setShowPlatters((v) => !v)}
    style={{
      width: "100%",
      maxWidth: 520,
      margin: "0 auto",
      background: "#f7f9ff",
      border: "1px solid #dbe6ff",
      borderRadius: 14,
      padding: "0.9rem 1rem",
      cursor: "pointer",
      textAlign: "left",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "1rem",
    }}
  >
    <div>
      <div style={{ fontWeight: 800, color: "#2c62ba" }}>
        Add a Display Platter?
      </div>
      <div style={{ fontSize: ".9rem", color: "#555", marginTop: ".2rem" }}>
        Optional — sized by servings, not guest count.
      </div>
      <div style={{ fontSize: ".9rem", color: "#2c62ba", marginTop: ".35rem" }}>
        Selected: <strong>{platterSummary}</strong>
        {platterTotal > 0 && (
          <>
            {" "}
            • <strong>${formatCurrency(platterTotal)}</strong>
          </>
        )}
      </div>
    </div>

    <div style={{ fontSize: "1.2rem", color: "#2c62ba", fontWeight: 900 }}>
      {showPlatters ? "▴" : "▾"}
    </div>
  </button>

  {showPlatters && (
    <div
      style={{
        margin: "0.75rem auto 0",
        width: "100%",
        maxWidth: 520,
        background: "#fff",
        border: "1px solid #eee",
        borderRadius: 14,
        padding: "1rem",
        textAlign: "left",
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: ".5rem" }}>
        Choose a platter:
      </div>

      <div style={{ display: "grid", gap: ".5rem" }}>
        {(
          [
            { id: "fruit", label: "Fruit Platter" },
            { id: "veggie", label: "Veggie Platter" },
            { id: "cheeseMeat", label: "Cheese & Meat Platter" },
          ] as const
        ).map((t) => (
          <label
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: ".5rem",
              padding: ".6rem .7rem",
              borderRadius: 12,
              border: "1px solid #eee",
              cursor: "pointer",
              background: platterType === t.id ? "#f2f6ff" : "#fff",
            }}
          >
            <input
              type="radio"
              checked={platterType === t.id}
              onChange={() => {
                setPlatterType(t.id);
                if (!platterSize) setPlatterSize("small");
              }}
            />
            <span style={{ fontWeight: 700 }}>{t.label}</span>
          </label>
        ))}
      </div>

      <div style={{ fontWeight: 700, margin: "1rem 0 .5rem" }}>
        Choose a size:
      </div>

      <div style={{ display: "grid", gap: ".5rem" }}>
        {(["small", "medium", "large"] as const).map((size) => {
          const price =
            platterType ? platterBasePrices[platterType][size] : null;

          return (
            <label
              key={size}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: ".75rem",
                padding: ".6rem .7rem",
                borderRadius: 12,
                border: "1px solid #eee",
                cursor: platterType ? "pointer" : "not-allowed",
                opacity: platterType ? 1 : 0.5,
                background: platterSize === size ? "#f2f6ff" : "#fff",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
                <input
                  type="radio"
                  disabled={!platterType}
                  checked={platterSize === size}
                  onChange={() => setPlatterSize(size)}
                />
                <div>
                  <div style={{ fontWeight: 800, textTransform: "capitalize" }}>
                    {size}
                  </div>
                  <div style={{ fontSize: ".9rem", color: "#555" }}>
                    Serves {platterServings[size]}
                  </div>
                </div>
              </div>

              <div style={{ fontWeight: 800, color: "#2c62ba" }}>
                {price !== null ? `$${formatCurrency(price)}` : "—"}
              </div>
            </label>
          );
        })}
      </div>

      <div style={{ marginTop: "1rem" }}>
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: ".5rem",
            cursor: platterType && platterSize ? "pointer" : "not-allowed",
            opacity: platterType && platterSize ? 1 : 0.5,
          }}
        >
          <input
            type="checkbox"
            disabled={!platterType || !platterSize}
            checked={platterFlorals}
            onChange={() => setPlatterFlorals((v) => !v)}
            style={{ marginTop: ".2rem" }}
          />
          <div>
            <div style={{ fontWeight: 800 }}>
              Add florals styling{" "}
              {platterSize ? (
                <span style={{ color: "#2c62ba" }}>
                  (+${formatCurrency(platterFloralsPrices[platterSize])})
                </span>
              ) : null}
            </div>
            <div style={{ fontSize: ".9rem", color: "#555", marginTop: ".15rem" }}>
              Optional garnish & presentation styling for the platter display.
            </div>
          </div>
        </label>
      </div>

      {(platterType || platterSize || platterFlorals) && (
        <button
          type="button"
          onClick={() => {
            setPlatterType(null);
            setPlatterSize(null);
            setPlatterFlorals(false);
          }}
          style={{
            marginTop: "1rem",
            background: "none",
            border: "none",
            color: "#b00020",
            fontWeight: 800,
            cursor: "pointer",
            padding: 0,
          }}
        >
          Remove platter selection
        </button>
      )}
    </div>
  )}
</div>

      {/* 🥗 Menu selections */}
      <h3
  style={{
    fontFamily: "'Jenna Sue', cursive",
    fontSize: "1.6rem",
    color: "#2c62ba",
  }}
>
  Appetizers:
</h3>
{appetizers.length ? (
  appetizers.map((x, i) => <p key={i}>{x}</p>)
) : (
  <p>None selected</p>
)}

      <div style={{ marginBottom: "2rem", textAlign: "center" }}>
        <h3
          style={{
            fontFamily: "'Jenna Sue', cursive",
            fontSize: "1.6rem",
            color: "#2c62ba",
          }}
        >
          Entrees:
        </h3>
        {mains.length ? (
          mains.map((x, i) => <p key={i}>{x}</p>)
        ) : (
          <p>None selected</p>
        )}

        <h3
          style={{
            fontFamily: "'Jenna Sue', cursive",
            fontSize: "1.6rem",
            color: "#2c62ba",
            marginTop: "1rem",
          }}
        >
          Sides:
        </h3>
        {sides.length ? (
          sides.map((x, i) => <p key={i}>{x}</p>)
        ) : (
          <p>None selected</p>
        )}

        <h3
          style={{
            fontFamily: "'Jenna Sue', cursive",
            fontSize: "1.6rem",
            color: "#2c62ba",
            marginTop: "1rem",
          }}
        >
          Salads:
        </h3>
        {salads.length ? (
          salads.map((x, i) => <p key={i}>{x}</p>)
        ) : (
          <p>None selected</p>
        )}
      </div>

      <div style={{ marginBottom: "1rem" }}>
      <div style={{ fontWeight: "bold" }}>
  Tier price: ${formatCurrency(basePricePerGuest)} per guest
</div>
        {perGuestUpgradeTotal > 0 && (
          <div style={{ fontSize: ".95rem", marginTop: ".25rem" }}>
            Upgrades: +${formatCurrency(perGuestUpgradeTotal)} per guest
          </div>
        )}
      </div>

      {/* 👥 Guest Count */}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ fontWeight: "bold", marginBottom: ".5rem" }}>
          How many guests?
        </div>
        <input
          type="number"
          min={0}
          max={250}
          value={gc}
          disabled={locked}
          onChange={(e) => handleGuestChange(e.target.value)}
          style={{
            padding: "0.5rem",
            fontSize: "1rem",
            width: "110px",
            borderRadius: "8px",
            textAlign: "center",
            background: locked ? "#f4f6fb" : "#fff",
            color: locked ? "#666" : "#000",
          }}
        />
        {locked && (
          <div
            style={{
              marginTop: ".5rem",
              fontSize: ".9rem",
              color: "#666",
            }}
          >
            Locked after:{" "}
            <strong>{lockedBy.join(", ") || "a booking"}</strong>.
            <br />
            You’ll be able to update your final guest count about
            45 days before your wedding.
          </div>
        )}
      </div>

      {selectedCuisine === "taco" && (
  <div style={{ marginBottom: "2rem", textAlign: "left" }}>
    <div style={{ fontWeight: 600, marginBottom: ".25rem" }}>
      Condiments Bar
    </div>
    <p style={{ fontSize: ".9rem", marginBottom: ".5rem" }}>
      Your Taco Bar comes with a classic condiments - cilantro, chopped onions, limes, green and red salsa - setup so guests can
      dress their tacos with the basics.
    </p>

    <label>
      <input
        type="checkbox"
        checked={tacoCondiments}
        onChange={() => setTacoCondiments(!tacoCondiments)}
        style={{ marginRight: "0.5rem" }}
      />
      Upgrade to Full Condiments Bar (+$
      {TACO_CONDIMENTS_PRICE.toFixed(2)} per guest)
    </label>

    <p
      style={{
        fontSize: ".85rem",
        marginTop: ".25rem",
        color: "#555",
      }}
    >
      Full bar includes red and green salsas, pico de gallo, guacamole,
      chips, chipotle aioli, sour cream, roasted corn, red cabbage,
      pickled onions, cotija and cheddar cheese, and fresh limes.
    </p>
  </div>
)}

<div style={{ marginTop: "0.75rem", marginBottom: "1rem" }}>
  <div style={{ fontWeight: 700 }}>
    Subtotal: ${formatCurrency(subtotal)}
  </div>

  <div style={{ fontSize: ".95rem", marginTop: ".25rem", color: "#555" }}>
    Fees, tax &amp; gratuity: ${formatCurrency(taxesAndFees)}
  </div>

  <div style={{ fontWeight: 800, marginTop: ".5rem" }}>
    Total (including fees, tax &amp; gratuity): ${formatCurrency(grandTotal)}
  </div>
</div>

      {/* Buttons (stacked layout) */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1rem",
          marginTop: "2rem",
        }}
      >
        <button
          className="boutique-primary-btn"
          onClick={handleContinueToCheckoutFromCart}
          style={{ width: "250px" }}
        >
          Confirm &amp; Book
        </button>

        <button
          className="boutique-back-btn"
          onClick={onStartOver}
          style={{ width: "250px" }}
        >
          ⬅ Back to Menu
        </button>
      </div>
    </div>
  );
};

export default YumCartCatering;