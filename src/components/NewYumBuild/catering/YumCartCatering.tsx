// src/components/NewYumBuild/catering/YumCartCatering.tsx
import React, { useEffect, useState } from "react";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../firebase/firebaseConfig";
import { getGuestState, setGuestCount, setAndLockGuestCount  } from "../../../utils/guestCountStore";
// add this with your other imports
import type { GuestLockReason } from "../../../utils/guestCountStore";

const SALES_TAX_RATE = 0.086;
const STRIPE_RATE = 0.029;
const STRIPE_FLAT_FEE = 0.3;
const BASE_PRICE_PER_GUEST = 65;
const CHARCUTERIE_ADD_ON_PRICE = 25;

interface YumCartProps {
  guestCount: number; // kept for back-compat; we now drive from store
  onGuestCountChange: (count: number) => void;
  addCharcuterie: boolean;
  setAddCharcuterie: (value: boolean) => void;
  selectedCuisine: string | null;
  menuSelections: { appetizers: string[]; mains: string[]; sides: string[] };
  setMenuSelections: (menu: { appetizers: string[]; mains: string[]; sides: string[] }) => void;
  setTotal: (grandTotal: number) => void;
  setLineItems: (items: string[]) => void;
  setPaymentSummaryText: (text: string) => void;
  onContinueToCheckout: () => void;
  onStartOver: () => void;
  onClose: () => void;
  weddingDate: string | null;
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
}) => {
  const cuisineLabels: Record<string, string> = {
    italian: "Italian Bounty",
    american: "Classic American",
    mexican: "Mexican Fiesta",
    taco: "Taco Bar",
  };
  const cuisineLabel = selectedCuisine ? cuisineLabels[selectedCuisine] || "Cuisine Not Selected" : "Cuisine Not Selected";

  const [localMenuSelections, setLocalMenuSelections] = useState(menuSelections);
  const { appetizers = [], mains = [], sides = [] } = localMenuSelections;

  // Single-source guest count state
  const [gc, setGC] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState<string[]>([]);

  // Hydrate guest count from store + subscribe to changes
  useEffect(() => {
    let alive = true;

    const hydrate = async () => {
      const st = await getGuestState();
      if (!alive) return;
      const v = Number(st.value || 0);
      setGC(v);
      setLocked(!!st.locked);
      setLockedBy(st.lockedBy || []);
      onGuestCountChange?.(v); // keep parent in sync
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
  }, [onGuestCountChange]);

  // If any guest-dependent booking exists, lock (venue/planner/catering/desserts)
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
  // pick a single canonical reason (venue > planner > catering > desserts)
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

// refresh local lock state
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

  // Restore menu selections + charcuterie flag (unchanged)
  useEffect(() => {
    const localSelections = localStorage.getItem("yumMenuSelections");
    if (localSelections) {
      try {
        const parsed = JSON.parse(localSelections);
        if (parsed.appetizers && parsed.mains && parsed.sides) {
          setLocalMenuSelections(parsed);
        }
      } catch {
        /* noop */
      }
    }
    onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      try {
        const menuDoc = await getDoc(doc(db, "users", user.uid, "yumYumData", "menuSelections"));
        const data = menuDoc.data();
        if (data?.appetizers || data?.mains || data?.sides) {
          setMenuSelections(data as { appetizers: string[]; mains: string[]; sides: string[] });
        }
      } catch {
        /* noop */
      }
    });
  }, [setMenuSelections]);

  useEffect(() => {
    const localChar = localStorage.getItem("yumAddCharcuterie");
    if (localChar) setAddCharcuterie(localChar === "true");
    onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      try {
        const cartDoc = await getDoc(doc(db, "users", user.uid, "yumYumData", "cartData"));
        const data = cartDoc.data();
        if (data?.addCharcuterie !== undefined) setAddCharcuterie(data.addCharcuterie);
      } catch {
        /* noop */
      }
    });
  }, [setAddCharcuterie]);

  // Pricing math
  const subtotal = gc * BASE_PRICE_PER_GUEST + (addCharcuterie ? gc * CHARCUTERIE_ADD_ON_PRICE : 0);
  const taxesAndFees = subtotal * SALES_TAX_RATE + subtotal * STRIPE_RATE + STRIPE_FLAT_FEE;
  const grandTotal = subtotal + taxesAndFees;

  // Persist cart + update summary whenever gc/charcuterie change
  useEffect(() => {
    localStorage.setItem("yumGuestCount", String(gc));
    localStorage.setItem("yumAddCharcuterie", addCharcuterie.toString());
    localStorage.setItem("yumStep", "cart");

    onAuthStateChanged(getAuth(), async (user) => {
      if (!user) return;
      try {
        await setDoc(
          doc(db, "users", user.uid, "yumYumData", "cartData"),
          { guestCount: gc, addCharcuterie },
          { merge: true }
        );
        await setDoc(
          doc(db, "users", user.uid),
          { progress: { yumYum: { step: "cart" } } },
          { merge: true }
        );
      } catch (err) {
        console.error("❌ Failed to save cart data to Firestore:", err);
      }
    });

    setTotal(grandTotal);
    setLineItems([
      `Catering for ${gc} guests @ $${BASE_PRICE_PER_GUEST}/guest`,
      ...(addCharcuterie ? [`Charcuterie Add-On for ${gc} guests @ $${CHARCUTERIE_ADD_ON_PRICE}/guest`] : []),
    ]);

    let summary = `You're paying $${grandTotal.toFixed(2)} today.`;
    if (addCharcuterie) summary += ` That includes a charcuterie board and guest-based fees.`;
    setPaymentSummaryText(summary);
  }, [gc, addCharcuterie, setTotal, setLineItems, setPaymentSummaryText, grandTotal]);

  const handleGuestChange = async (raw: string) => {
    if (locked) return;
    const next = clamp(parseInt(raw, 10));
    setGC(next);
    onGuestCountChange?.(next);
    await setGuestCount(next);
  };

  const handleContinueToCheckoutFromCart = async () => {
    // read current store value (fallback to local mirror if needed)
    const st = await getGuestState();
const value = Number(st.value ?? localStorage.getItem("yumGuestCount") ?? 0);

// Read reasons from whatever key exists (typed store may not expose it)
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

  return (
    <div
      className="pixie-card"
      style={{ maxWidth: "700px", textAlign: "center", position: "relative", padding: "2rem 2rem 3rem" }}
    >
      {/* 🌸 Pink X close button */}
      <button
        onClick={onClose}
        aria-label="Close"
        style={{ position: "absolute", top: "1rem", right: "1rem", background: "none", border: "none", cursor: "pointer" }}
      >
        <img src="/assets/icons/pink_ex.png" alt="Close" style={{ width: 22, height: 22 }} />
      </button>
  
        <video
          src="/assets/videos/yum_cart.mp4"
          autoPlay
          loop
          muted
          playsInline
          style={{ width: "180px", margin: "0 auto 1.5rem", borderRadius: "12px" }}
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
          <p>{selectedCuisine ? cuisineLabel : "Cuisine Not Selected"}</p>
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
            Appetizers:
          </h3>
          {appetizers.length
            ? appetizers.map((x, i) => <p key={i}>{x}</p>)
            : <p>None selected</p>}
  
          <h3
            style={{
              fontFamily: "'Jenna Sue', cursive",
              fontSize: "1.6rem",
              color: "#2c62ba",
              marginTop: "1rem",
            }}
          >
            Mains:
          </h3>
          {mains.length
            ? mains.map((x, i) => <p key={i}>{x}</p>)
            : <p>None selected</p>}
  
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
          {sides.length
            ? sides.map((x, i) => <p key={i}>{x}</p>)
            : <p>None selected</p>}
        </div>
  
        <div style={{ fontWeight: "bold", marginBottom: "1rem" }}>
          Catering Price: $65 per guest
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
            <div style={{ marginTop: ".5rem", fontSize: ".9rem", color: "#666" }}>
              Locked after: <strong>{lockedBy.join(", ") || "a booking"}</strong>.
              <br />
              You’ll be able to up or confirm your final guest count about 45 days before your wedding.
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
            Add Charcuterie Board ($25 per guest)
          </label>
        </div>
  
        <div style={{ fontWeight: "bold", marginBottom: "1rem" }}>
          Total: ${grandTotal.toFixed(2)}
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
            Confirm & Book
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