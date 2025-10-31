// src/components/NewYumBuild/CustomVenues/Ocotillo/OcotilloDessertCart.tsx
import React, { useEffect, useState } from "react";
import { getAuth } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../../../firebase/firebaseConfig";

import {
  getGuestState,
  setGuestCount,
  setAndLockGuestCount,
  type GuestLockReason,
} from "../../../../utils/guestCountStore";

export type OcotilloTier = "tier1" | "tier2" | "tier3";

export interface OcotilloMenuSelections {
  tier: OcotilloTier;
  appetizers: string[];
  salads: string[];
  entrees: string[];
  desserts: string[];
}

interface Props {
  selectedTier: OcotilloTier;
  menuSelections: OcotilloMenuSelections;

  setTotal: (grandTotal: number) => void;
  setLineItems: (items: string[]) => void;
  setPaymentSummaryText: (text: string) => void;

  onContinueToCheckout: () => void;
  onBackToMenu: () => void;
  onClose: () => void;
}

/* ─────────────────── Pricing constants ─────────────────── */

const SALES_TAX_RATE = 0.086; // you can tweak
const SERVICE_CHARGE_RATE = 0.25; // 25%

const TIER_PRICE: Record<OcotilloTier, number> = {
  tier1: 85,
  tier2: 110,
  tier3: 135,
};

const TIER_LABEL: Record<OcotilloTier, string> = {
  tier1: "Tier 1",
  tier2: "Tier 2",
  tier3: "Tier 3",
};

/* pick limits for validation */
const LIMITS = {
  appetizers: 3,
  salads: 2,
  entrees: 3,
  desserts: 1,
};

const clampGuestCount = (n: number) =>
  Math.max(0, Math.min(250, Math.floor(n) || 0));

const OcotilloCateringCart: React.FC<Props> = ({
  selectedTier,
  menuSelections,
  setTotal,
  setLineItems,
  setPaymentSummaryText,
  onContinueToCheckout,
  onBackToMenu,
  onClose,
}) => {
  const { appetizers = [], salads = [], entrees = [], desserts = [] } =
    menuSelections;

  const [gc, setGC] = useState(0);
  const [locked, setLocked] = useState(false);
  const [lockedBy, setLockedBy] = useState<string[]>([]);

  /* ────────── Guest count hydrate / sync / listen ────────── */
  useEffect(() => {
    let alive = true;

    const hydrate = async () => {
      const st = await getGuestState();
      if (!alive) return;

      const v = Number(st.value || 0);
      setGC(v);

      const isLocked = !!st.locked;
      setLocked(isLocked);

      const reasons: string[] =
        (st as any).lockedBy ||
        (st as any).lockedReasons ||
        (st as any).guestCountLockedBy ||
        [];
      setLockedBy(reasons);
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

  /* ────────── If they've already booked anything, lock GC ────────── */
  useEffect(() => {
    (async () => {
      const user = getAuth().currentUser;
      if (!user) return;

      try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists()) return;

        const d = snap.data() || {};
        const b = (d.bookings ?? {}) as Record<string, any>;

        const shouldLock =
          b.venue || b.planner || b.catering || b.dessert || b.ocotilloCatering;

        if (shouldLock) {
          const reason: GuestLockReason =
            (b.venue && "venue") ||
            (b.planner && "planner") ||
            (b.catering && "catering") ||
            (b.dessert && "dessert") ||
            "catering";

          const st = await getGuestState();
          if (!st.locked) {
            await setAndLockGuestCount(Number(st.value || 0), reason);
          }
        }

        const st2 = await getGuestState();
        setGC(Number(st2.value || 0));
        setLocked(!!st2.locked);
        const reasons: string[] =
          (st2 as any).lockedBy ||
          (st2 as any).lockedReasons ||
          (st2 as any).guestCountLockedBy ||
          [];
        setLockedBy(reasons);
      } catch (e) {
        console.warn("⚠️ booking lock check failed:", e);
      }
    })();
  }, []);

  /* ────────── Pricing math ────────── */
  const perGuest = TIER_PRICE[selectedTier];
  const foodSubtotal = gc * perGuest;

  const serviceCharge = foodSubtotal * SERVICE_CHARGE_RATE;
  const taxableBase = foodSubtotal + serviceCharge;
  const salesTax = taxableBase * SALES_TAX_RATE;

  const grandTotal = foodSubtotal + serviceCharge + salesTax;

  /* ────────── Required-selections gate ────────── */
  const canContinue =
    gc > 0 &&
    appetizers.length <= LIMITS.appetizers &&
    salads.length > 0 &&
    salads.length <= LIMITS.salads &&
    entrees.length > 0 &&
    entrees.length <= LIMITS.entrees &&
    desserts.length === LIMITS.desserts;

  /* ────────── Persist snapshot to LS + Firestore, and prep checkout summary ────────── */
  useEffect(() => {
    // localStorage breadcrumb
    localStorage.setItem("ocotilloGuestCount", String(gc));
    localStorage.setItem("yumStep", "ocotilloCart");

    const snapshot = {
      guestCount: gc,
      tier: selectedTier,
      perGuest,
      foodSubtotal,
      serviceCharge,
      salesTax,
      grandTotal,
      selections: menuSelections,
      updatedAt: Date.now(),
    };

    const user = getAuth().currentUser;
    if (user) {
      // write per-user cart data (used later for PDF + contract, etc.)
      const cartRef = doc(db, "users", user.uid, "yumYumData", "ocotilloCart");
      setDoc(cartRef, snapshot, { merge: true }).catch((err) => {
        console.error("❌ Failed to save Ocotillo cart data:", err);
      });

      // store progress step
      setDoc(
        doc(db, "users", user.uid),
        { progress: { yumYum: { step: "ocotilloCart" } } },
        { merge: true }
      ).catch(() => {});
    }

    // expose totals / copy upward so checkout can show “you’re paying X today”
    setTotal(grandTotal);
    setLineItems([
      `Ocotillo catering for ${gc} guests @ $${perGuest}/guest (${TIER_LABEL[selectedTier]})`,
      "25% service charge + tax included",
    ]);
    setPaymentSummaryText(
      `You're paying $${grandTotal.toFixed(
        2
      )} today for your ${TIER_LABEL[selectedTier]} buffet menu at Ocotillo.`
    );
  }, [
    gc,
    perGuest,
    selectedTier,
    foodSubtotal,
    serviceCharge,
    salesTax,
    grandTotal,
    menuSelections,
    setTotal,
    setLineItems,
    setPaymentSummaryText,
  ]);

  /* ────────── Handlers ────────── */
  const handleGuestChange = async (raw: string) => {
    if (locked) return;
    const next = clampGuestCount(parseInt(raw, 10));
    setGC(next);
    await setGuestCount(next);
  };

  const handleContinue = async () => {
    if (!canContinue) return;

    // Lock guest count specifically as a catering booking under yum:catering
    const st = await getGuestState();
    const value = Number(
      st.value ?? localStorage.getItem("ocotilloGuestCount") ?? 0
    );
    const reasons: GuestLockReason[] =
      (st as any).lockedReasons ||
      (st as any).guestCountLockedBy ||
      (st as any).lockedBy ||
      [];

    if (!reasons.includes("yum:catering")) {
      await setAndLockGuestCount(value, "yum:catering");
    }

    onContinueToCheckout();
  };

  /* ────────── tiny helper for rendering lists ────────── */
  const ListBlock: React.FC<{ title: string; items: string[] }> = ({
    title,
    items,
  }) => (
    <div style={{ marginBottom: "1.25rem" }}>
      <h3
        style={{
          fontFamily: "'Jenna Sue', cursive",
          fontSize: "1.6rem",
          color: "#2c62ba",
          margin: 0,
        }}
      >
        {title}
      </h3>

      {items.length ? (
        items.map((line, i) => (
          <p key={`${title}-${i}`} style={{ margin: ".25rem 0" }}>
            {line}
          </p>
        ))
      ) : (
        <p style={{ margin: ".25rem 0", opacity: 0.7 }}>None selected</p>
      )}
    </div>
  );

  /* ────────── Render ────────── */
  return (
    <div className="pixie-overlay">
      <div
        className="pixie-card"
        style={{ maxWidth: 720, textAlign: "center", position: "relative" }}
      >
        {/* Pink X close */}
        <button
          className="pixie-card__close"
          onClick={onClose}
          aria-label="Close"
        >
          <img
            src={`${import.meta.env.BASE_URL}assets/icons/pink_ex.png`}
            alt="Close"
          />
        </button>

        <video
          src={`${import.meta.env.BASE_URL}assets/videos/yum_cart.mp4`}
          autoPlay
          loop
          muted
          playsInline
          style={{
            width: 180,
            margin: "0 auto 1.5rem",
            borderRadius: 12,
            display: "block",
          }}
        />

        <h2
          style={{
            fontFamily: "'Jenna Sue', cursive",
            fontSize: "2rem",
            color: "#2c62ba",
            marginBottom: 8,
          }}
        >
          Your {TIER_LABEL[selectedTier]} Menu
        </h2>

        <div
          style={{
            fontWeight: 700,
            marginBottom: "1rem",
            fontSize: "1rem",
          }}
        >
          Catering price: ${perGuest} per guest
          <br />
          (plus 25% service charge &amp; tax)
        </div>

        {/* Selections overview */}
        <ListBlock title="Appetizers" items={appetizers} />
        <ListBlock title="Salads" items={salads} />
        <ListBlock title="Entrées" items={entrees} />
        <ListBlock title="Dessert" items={desserts} />

        {/* Guest Count */}
        <div style={{ marginBottom: "1rem" }}>
          <div
            style={{
              fontWeight: 700,
              marginBottom: ".5rem",
            }}
          >
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
              width: 110,
              borderRadius: 8,
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
              You’ll confirm your final guest count 45 days before your
              wedding.
            </div>
          )}
        </div>

        {/* Totals */}
        <div
          style={{
            fontWeight: 800,
            marginBottom: 6,
            fontSize: "1.05rem",
          }}
        >
          Total: ${grandTotal.toFixed(2)}
        </div>
        <div
          style={{
            fontSize: ".95rem",
            opacity: 0.8,
            marginBottom: "1.25rem",
          }}
        >
          Includes 25% service charge and sales tax.
        </div>

        {/* CTAs */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <button
            className="boutique-primary-btn"
            onClick={handleContinue}
            style={{
              width: 260,
              opacity: canContinue ? 1 : 0.6,
              cursor: canContinue ? "pointer" : "not-allowed",
            }}
            disabled={!canContinue}
          >
            Confirm &amp; Book
          </button>

          <button
            className="boutique-back-btn"
            onClick={onBackToMenu}
            style={{ width: 260 }}
          >
            ⬅ Back to Menu
          </button>

          <button
            className="boutique-back-btn"
            onClick={onClose}
            style={{ width: 260 }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default OcotilloCateringCart;