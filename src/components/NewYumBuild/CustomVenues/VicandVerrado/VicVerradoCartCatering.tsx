import React, { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";
import {
  getGuestState,
  setGuestCount,
  setAndLockGuestCount,
  type GuestLockReason,
} from "../../../../utils/guestCountStore";

type Tier = "sunflower" | "rose" | "lily" | "dahlia";

const SALES_TAX_RATE = 0.086;
const STRIPE_RATE = 0.029;
const STRIPE_FLAT_FEE = 0.3;
const FNB_MINIMUM = 8000;

const TIER_PRICE: Record<Tier, number> = {
  sunflower: 69,
  rose: 79,
  lily: 89,
  dahlia: 99,
};

const TIER_LABEL: Record<Tier, string> = {
  sunflower: "Sunflower",
  rose: "Rose",
  lily: "Lily",
  dahlia: "Dahlia",
};

export interface VicVerradoMenuSelections {
  tier: Tier;
  hors: string[];
  salads: string[];
  entrees: string[];
  starch: string[];
  veg: string[];
}

interface Props {
  selectedTier: Tier;
  menuSelections: VicVerradoMenuSelections;
  setTotal: (grandTotal: number) => void;
  setLineItems: (items: string[]) => void;
  setPaymentSummaryText: (text: string) => void;
  onContinueToCheckout: () => void;
  onBackToMenu: () => void;
  onClose: () => void;

  // NEW (optional): show/hide F&B minimum progress
  showFnbProgress?: boolean;         // default false for Vic/Verrado
  fnbMinimumDollars?: number;        // default 8000 if shown
}

const clamp = (n: number) => Math.max(0, Math.min(250, Math.floor(n) || 0));

const VicVerradoCartCatering: React.FC<Props> = ({
  selectedTier,
  menuSelections,
  setTotal,
  setLineItems,
  setPaymentSummaryText,
  onContinueToCheckout,
  onBackToMenu,
  onClose,

  showFnbProgress = false,      // 👈 hide by default for this venue
  fnbMinimumDollars = 8000,     // used only if showFnbProgress=true
}) => {
  const { tier, hors = [], salads = [], entrees = [], starch = [], veg = [] } = menuSelections;

  const [gc, setGC] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState<string[]>([]);

  // --- Hydrate guest count from the single source of truth
  useEffect(() => {
    let alive = true;
    const hydrate = async () => {
      const st = await getGuestState();
      if (!alive) return;
      const v = Number(st.value || 0);
      setGC(v);
      setLocked(!!st.locked);
      setLockedBy((st as any).lockedBy || (st as any).lockedReasons || []);
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

  // --- If any guest-dependent booking exists, ensure locked
  useEffect(() => {
    (async () => {
      const user = getAuth().currentUser;
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists()) return;
        const d = snap.data() || {};
        const b = (d.bookings ?? {}) as Record<string, any>;
        const shouldLock = b.venue || b.planner || b.catering || b.dessert;
        if (shouldLock) {
          const reason: GuestLockReason =
            (b.venue && "venue") ||
            (b.planner && "planner") ||
            (b.catering && "catering") ||
            "desserts";
          const st = await getGuestState();
          if (!st.locked) await setAndLockGuestCount(Number(st.value || 0), reason);
        }
        const st2 = await getGuestState();
        setGC(Number(st2.value || 0));
        setLocked(!!st2.locked);
        setLockedBy((st2 as any).lockedBy || (st2 as any).lockedReasons || []);
      } catch (e) {
        console.warn("⚠️ booking lock check failed:", e);
      }
    })();
  }, []);

 // pricing math
const perGuest = TIER_PRICE[selectedTier];
const subtotal = gc * perGuest;
const taxesAndFees = subtotal * SALES_TAX_RATE + subtotal * STRIPE_RATE + STRIPE_FLAT_FEE;
const grandTotal = subtotal + taxesAndFees;

// F&B minimum progress (optional)
const fnbProgress = showFnbProgress
  ? Math.min(1, (subtotal || 0) / (fnbMinimumDollars || 1))
  : 0;

  // --- Validate required selections based on tier
  const limitsByTier: Record<Tier, { hors: number; salads: number; entrees: number; starch: number; veg: number }> = {
    sunflower: { hors: 0, salads: 1, entrees: 1, starch: 1, veg: 1 },
    rose:      { hors: 1, salads: 1, entrees: 1, starch: 1, veg: 1 },
    lily:      { hors: 2, salads: 1, entrees: 2, starch: 1, veg: 1 },
    dahlia:    { hors: 3, salads: 1, entrees: 3, starch: 1, veg: 1 },
  };
  const limits = limitsByTier[selectedTier];

  const canContinue = gc > 0
    && salads.length === 1
    && starch.length === 1
    && veg.length === 1
    && entrees.length === limits.entrees
    && (limits.hors === 0 || hors.length === limits.hors);

    

  // --- Persist cart snapshot + step (localStorage + Firestore)
  useEffect(() => {
    localStorage.setItem("vicVerradoGuestCount", String(gc));
    localStorage.setItem("yumStep", "vicVerradoCart");

    const user = getAuth().currentUser;
    if (user) {
      // Save a compact, PDF-friendly snapshot
      const cartRef = doc(db, "users", user.uid, "yumYumData", "vicVerradoCart");
      setDoc(
        cartRef,
        {
          guestCount: gc,
          tier: selectedTier,
          perGuest,
          subtotal,
          taxesAndFees,
          grandTotal,
          selections: menuSelections,
          updatedAt: Date.now(),
        },
        { merge: true }
      ).catch((err) => console.error("❌ Failed to save Vic/Verrado cart data:", err));

      // progress step
      setDoc(
        doc(db, "users", user.uid),
        { progress: { yumYum: { step: "vicVerradoCart" } } },
        { merge: true }
      ).catch(() => {});
    }

    // Stripe summary for the parent/checkout
    setTotal(grandTotal);
    setLineItems([
      `Catering for ${gc} guests @ $${perGuest}/guest (${TIER_LABEL[selectedTier]})`,
    ]);
    setPaymentSummaryText(
      `You're paying $${grandTotal.toFixed(2)} today for your ${TIER_LABEL[selectedTier]} menu.`
    );
  }, [
    gc,
    perGuest,
    selectedTier,
    grandTotal,
    subtotal,
    taxesAndFees,
    menuSelections,
    setTotal,
    setLineItems,
    setPaymentSummaryText,
  ]);

  // --- Handlers
  const handleGuestChange = async (raw: string) => {
    if (locked) return;
    const next = clamp(parseInt(raw, 10));
    setGC(next);
    await setGuestCount(next);
  };

  const handleContinue = async () => {
    if (!canContinue) return;
    const st = await getGuestState();
    const value = Number(st.value ?? localStorage.getItem("vicVerradoGuestCount") ?? 0);
    const reasons = (
      (st as any).lockedReasons ??
      (st as any).guestCountLockedBy ??
      (st as any).lockedBy ??
      []
    ) as GuestLockReason[];

    if (!reasons.includes("yum:catering")) {
      await setAndLockGuestCount(value, "yum:catering");
    }
    onContinueToCheckout();
  };

  // --- UI helpers
  const List: React.FC<{ title: string; items: string[] }> = ({ title, items }) => (
    <div style={{ marginBottom: "1.25rem" }}>
      <h3 style={{ fontFamily: "'Jenna Sue', cursive", fontSize: "1.6rem", color: "#2c62ba", margin: 0 }}>
        {title}
      </h3>
      {items.length ? (
        items.map((x, i) => <p key={`${title}-${i}`} style={{ margin: ".25rem 0" }}>{x}</p>)
      ) : (
        <p style={{ margin: ".25rem 0", opacity: 0.7 }}>None selected</p>
      )}
    </div>
  );

  return (
    <div className="pixie-overlay">
      <div className="pixie-card" style={{ maxWidth: 720, textAlign: "center" }}>
        <video
          src="/assets/videos/yum_cart.mp4"
          autoPlay
          loop
          muted
          playsInline
          style={{ width: 180, margin: "0 auto 1.5rem", borderRadius: 12 }}
        />

        <h2 style={{ fontFamily: "'Jenna Sue', cursive", fontSize: "2.2rem", color: "#2c62ba", marginBottom: 8 }}>
          Your {TIER_LABEL[tier || selectedTier]} Menu
        </h2>
        <div style={{ fontWeight: 700, marginBottom: "1rem" }}>
          Catering price: ${perGuest} per guest
        </div>

        {/* Selections */}
        {selectedTier !== "sunflower" && <List title="Hors d’oeuvres" items={hors} />}
        <List title="Salad" items={salads} />
        <List title="Entrée(s)" items={entrees} />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: "1.25rem" }}>
          <div>
            <h3 style={{ fontFamily: "'Jenna Sue', cursive", fontSize: "1.6rem", color: "#2c62ba", margin: 0 }}>
              Starch
            </h3>
            {starch.length ? starch.map((x, i) => <p key={`st-${i}`} style={{ margin: ".25rem 0" }}>{x}</p>) : (
              <p style={{ margin: ".25rem 0", opacity: 0.7 }}>None selected</p>
            )}
          </div>
          <div>
            <h3 style={{ fontFamily: "'Jenna Sue', cursive", fontSize: "1.6rem", color: "#2c62ba", margin: 0 }}>
              Vegetable
            </h3>
            {veg.length ? veg.map((x, i) => <p key={`veg-${i}`} style={{ margin: ".25rem 0" }}>{x}</p>) : (
              <p style={{ margin: ".25rem 0", opacity: 0.7 }}>None selected</p>
            )}
          </div>
        </div>

        {/* Optional F&B minimum progress */}
{showFnbProgress && (
  <div
    style={{
      background: "#eef3ff",
      border: "1px solid #dfe8ff",
      borderRadius: 12,
      padding: "10px 12px",
      margin: "0 0 18px",
      textAlign: "center",
      fontWeight: 800,
      color: "#2c62ba",
    }}
  >
    Progress toward the ${fnbMinimumDollars.toLocaleString()} food & beverage minimum:
    {" "}
    ${(subtotal).toFixed(2)} ({Math.round(fnbProgress * 100)}%)
    <div
      style={{
        height: 8,
        width: "100%",
        background: "#dfe8ff",
        borderRadius: 999,
        overflow: "hidden",
        marginTop: 8,
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${Math.round(fnbProgress * 100)}%`,
          background: "#2c62ba",
        }}
      />
    </div>
  </div>
)}

        {/* Guest Count */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ fontWeight: 700, marginBottom: ".5rem" }}>How many guests?</div>
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
              width: 110,
              borderRadius: 8,
              textAlign: "center",
              background: locked ? "#f4f6fb" : "#fff",
              color: locked ? "#666" : "#000",
            }}
          />
          {locked && (
            <div style={{ marginTop: ".5rem", fontSize: ".9rem", color: "#666" }}>
              Locked after: <strong>{lockedBy.join(", ") || "a booking"}</strong>.
              <br />
              You’ll confirm your final guest count 45 days before your wedding.
            </div>
          )}
        </div>

        {/* Totals */}
        <div style={{ fontWeight: 800, marginBottom: 6 }}>
          Total: ${grandTotal.toFixed(2)}
        </div>
        <div style={{ fontSize: ".95rem", opacity: 0.8, marginBottom: "1.25rem" }}>
          Includes taxes &amp; fees.
        </div>

        {/* CTAs */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
          <button
            className="boutique-primary-btn"
            onClick={handleContinue}
            style={{ width: 260, opacity: canContinue ? 1 : 0.6, cursor: canContinue ? "pointer" : "not-allowed" }}
            disabled={!canContinue}
          >
            Confirm &amp; Book
          </button>
          <button className="boutique-back-btn" onClick={onBackToMenu} style={{ width: 260 }}>
            ⬅ Back to Menu
          </button>
          <button className="boutique-back-btn" onClick={onClose} style={{ width: 260 }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default VicVerradoCartCatering;