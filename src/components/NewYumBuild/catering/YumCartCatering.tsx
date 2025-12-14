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
const CHARCUTERIE_ADD_ON_PRICE = 25;

const formatCurrency = (amount: number) =>
  amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

type TierId = "signature" | "chef";

type MenuSelections = {
  mains: string[];
  sides: string[];
  salads: string[];
};

interface YumCartProps {
  guestCount: number; // still here for back-compat, but we drive from store
  onGuestCountChange: (count: number) => void;
  addCharcuterie: boolean;
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
  addCharcuterie,
  setAddCharcuterie,
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

  const { mains = [], sides = [], salads = [] } = localMenuSelections;
  const [tacoCondiments, setTacoCondiments] = useState(false);

  // Single-source guest count state
  const [gc, setGC] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState<string[]>([]);

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
        if (parsed.mains || parsed.sides || parsed.salads) {
          const merged: MenuSelections = {
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

  useEffect(() => {
    const localChar = localStorage.getItem("yumAddCharcuterie");
    if (localChar) setAddCharcuterie(localChar === "true");
  
    const localTacoCond = localStorage.getItem("yumTacoFullCondiments");
    if (localTacoCond) setTacoCondiments(localTacoCond === "true");
  
    onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      try {
        const cartDoc = await getDoc(
          doc(db, "users", user.uid, "yumYumData", "cartData")
        );
        const data = cartDoc.data() as any;
        if (data?.addCharcuterie !== undefined) {
          setAddCharcuterie(data.addCharcuterie);
        }
        if (data?.tacoFullCondiments !== undefined) {
          setTacoCondiments(data.tacoFullCondiments);
        }
      } catch {
        /* noop */
      }
    });
  }, [setAddCharcuterie]);


    // ─────────────── Pricing helpers (base + upgrades) ───────────────
const basePricePerGuest = useMemo(() => {
  if (!selectedCuisine) return 0;

  // Base tier price is the same for all cuisines
  const price = santisMenuConfig.basePricePerGuest[tier];
  return typeof price === "number" ? price : 0;
}, [selectedCuisine, tier]);

const perGuestUpgradeTotal = useMemo(() => {
  if (!selectedCuisine) return 0;

  // Pull the cuisine’s menu arrays (entrees/sides/salads)
  const cuisineCfg = santisMenuConfig.cuisines[selectedCuisine];
  if (!cuisineCfg) return 0;

  const sumSection = (items: SantiMenuItem[], chosen: string[]) =>
    items.reduce((sum, item) => {
      const fee = item.upgradeFeePerGuest || 0;
      if (fee === 0) return sum;
      // chosen items are stored by `name`
      if (!chosen.includes(item.name)) return sum;
      return sum + fee;
    }, 0);

  return (
    sumSection(cuisineCfg.entrees, mains) +
    sumSection(cuisineCfg.sides, sides) +
    sumSection(cuisineCfg.salads, salads)
  );
}, [selectedCuisine, mains, sides, salads]);

const TACO_CONDIMENTS_PRICE =
  santisMenuConfig.extras.tacoFullCondiments.upgradeFeePerGuest;

const tacoCondimentsSubtotal =
  selectedCuisine === "taco" && tacoCondiments
    ? gc * TACO_CONDIMENTS_PRICE
    : 0;

const baseSubtotal = gc * basePricePerGuest;
const upgradesSubtotal = gc * perGuestUpgradeTotal;
const charcuterieSubtotal = addCharcuterie ? gc * CHARCUTERIE_ADD_ON_PRICE : 0;

// 👉 now includes the tacoCondimentsSubtotal
const subtotal =
  baseSubtotal + upgradesSubtotal + charcuterieSubtotal + tacoCondimentsSubtotal;

const taxesAndFees =
  subtotal * SALES_TAX_RATE + subtotal * STRIPE_RATE + STRIPE_FLAT_FEE;
const grandTotal = subtotal + taxesAndFees;

// ───────────────── Persist cart + summary ─────────────────
  useEffect(() => {
    localStorage.setItem("yumGuestCount", String(gc));
    localStorage.setItem("yumAddCharcuterie", addCharcuterie.toString());
    localStorage.setItem("yumTacoFullCondiments", tacoCondiments.toString());
    localStorage.setItem("yumStep", "cateringCart");
  
    onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      try {
        await setDoc(
          doc(db, "users", user.uid, "yumYumData", "cartData"),
          { guestCount: gc, addCharcuterie, tacoFullCondiments: tacoCondiments },
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

    if (perGuestUpgradeTotal > 0) {
      items.push(
        `Menu upgrades – ${gc} guests @ $${formatCurrency(perGuestUpgradeTotal)}/guest`
      );
    }

    if (addCharcuterie) {
      items.push(
        `Charcuterie add-on – ${gc} guests @ $${formatCurrency(
  CHARCUTERIE_ADD_ON_PRICE
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
    if (addCharcuterie) {
      summary += ` Charcuterie add-on is included as well.`;
    }
    setPaymentSummaryText(summary);
  }, [
    gc,
    addCharcuterie,
    tacoCondiments,
    basePricePerGuest,
    perGuestUpgradeTotal,
    grandTotal,
    setTotal,
    setLineItems,
    setPaymentSummaryText,
    tier,
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

    const reasons = (
      (st as any).lockedReasons ??
      (st as any).guestCountLockedBy ??
      (st as any).lockedBy ??
      (st as any).reasons ??
      []
    ) as GuestLockReason[];

    const alreadyHasThisReason = reasons.includes("yum:catering");
    if (!alreadyHasThisReason) {
      await setAndLockGuestCount(value, "yum:catering");
    }
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

      {/* 🥗 Menu selections */}
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
  Base price: ${formatCurrency(basePricePerGuest)} per guest
</div>
        {perGuestUpgradeTotal > 0 && (
          <div style={{ fontSize: ".95rem", marginTop: ".25rem" }}>
            Upgrades: +${formatCurrency(perGuestUpgradeTotal)} per guest
          </div>
        )}
        {addCharcuterie && (
          <div style={{ fontSize: ".95rem", marginTop: ".25rem" }}>
            Charcuterie: +${formatCurrency(CHARCUTERIE_ADD_ON_PRICE)} per guest
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

      {/* 🧀 Charcuterie toggle */}
      <div style={{ marginBottom: "2rem" }}>
        <label>
          <input
            type="checkbox"
            checked={addCharcuterie}
            onChange={() => setAddCharcuterie(!addCharcuterie)}
            style={{ marginRight: "0.5rem" }}
          />
          Add Charcuterie Board (${CHARCUTERIE_ADD_ON_PRICE} per guest)
        </label>
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

      <div style={{ fontWeight: "bold", marginBottom: "1rem" }}>
  Total: ${formatCurrency(grandTotal)}
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