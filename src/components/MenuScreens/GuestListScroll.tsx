// src/components/MenuScreens/GuestListScroll.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import CheckoutForm from "../../CheckoutForm";


import { getAuth, onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { db, app } from "../../firebase/firebaseConfig";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

import generateGuestDeltaReceiptPDF from "../../utils/generateGuestDeltaReceiptPDF";
import {
  getGuestState,
  setGuestCount,
  setAndLockGuestCount,
  type GuestLockReason,
} from "../../utils/guestCountStore";

const stripePromise = loadStripe(
  "pk_test_51Kh0qWD48xRO93UMFwIMguVpNpuICcWmVvZkD1YvK7naYFwLlhhiFtSU5requdOcmj1lKPiR0I0GhFgEAIhUVENZ00vFo6yI20"
);

// ---------- pricing snapshot types ----------
type PlannerTier = { id: string; name: string; maxGuests: number; price: number };

type PlannerSnapshot = {
  model?: "tiered" | "flat" | "none";
  tiers?: PlannerTier[];
  bookedTierId?: string;
  includedViaVenue?: boolean;
  includedTierId?: string;
  includedValue?: number;
  paidAmountStandalone?: number;
};

type PricingSnapshots = {
  salesTaxRate?: number;
  venue?: { booked?: boolean; perGuest?: number };
  catering?: { booked?: boolean; perGuest?: number };
  dessert?: { booked?: boolean; isPerGuest?: boolean; perGuest?: number };
  planner?: PlannerSnapshot;
};

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

// ---------- planner helpers ----------
function pickPlannerTier(tiers: PlannerTier[] = [], guestCount: number): PlannerTier | null {
  if (!tiers.length) return null;
  const sorted = [...tiers].sort((a, b) => a.maxGuests - b.maxGuests);
  for (const t of sorted) if (guestCount <= t.maxGuests) return t;
  return sorted[sorted.length - 1];
}

const STRIPE_RATE = 0.029; // 2.9%
const STRIPE_FLAT = 0.30;  // $0.30 flat fee

function computePlannerDeltaForGuestChange(opts: {
  previousGuests: number;
  newGuests: number;
  plannerSnapshot?: PlannerSnapshot;
}) {
  const snap = opts.plannerSnapshot;
  const explain: string[] = [];
  if (!snap || snap.model === "none") {
    return { owed: 0, newTier: null as PlannerTier | null, covered: 0, explanation: explain };
  }

  const tiers = (snap.tiers || []).slice().sort((a, b) => a.maxGuests - b.maxGuests);
  if (!tiers.length) return { owed: 0, newTier: null, covered: 0, explanation: explain };

  const newTier = pickPlannerTier(tiers, opts.newGuests);
  if (!newTier) return { owed: 0, newTier: null, covered: 0, explanation: explain };

  const included = Number(snap.includedViaVenue ? (snap.includedValue || 0) : 0);
  const paidStandalone = Number(snap.paidAmountStandalone || 0);
  const covered = included + paidStandalone;

  const bookedTier = tiers.find((t) => t.id === snap.bookedTierId) || null;
  void bookedTier;

  const newRequiredPrice = newTier.price;
  let owed = Math.max(0, newRequiredPrice - covered);
  owed = +owed.toFixed(2);

  if (snap.includedViaVenue) {
    explain.push(`Planner included via venue: value covered $${included.toFixed(2)}.`);
    if (paidStandalone > 0) explain.push(`Standalone planner already paid: $${paidStandalone.toFixed(2)}.`);
  } else {
    explain.push(`Standalone planner already paid: $${paidStandalone.toFixed(2)}.`);
  }
  explain.push(`New required planner tier: ${newTier.name} @ $${newTier.price.toFixed(2)}.`);
  if (owed > 0) explain.push(`Planner tier upgrade due now: $${owed.toFixed(2)}.`);
  else explain.push(`No additional planner amount due.`);

  return { owed, newTier, covered, explanation: explain };
}

// ---------- overall delta ----------
type DeltaBreakdown = {
  deltaGuests: number;
  venueSubtotal: number;
  cateringSubtotal: number;
  dessertSubtotal: number;
  plannerSubtotal: number;
  subtotal: number;
  tax: number;
  stripeFee: number;   // ✅ new
  totalDueNow: number;
  perGuestVenue?: number;
  perGuestCatering?: number;
  plannerExplain?: {
    originalLabel?: string;
    newLabel?: string;
    diff?: number;
    includedValue?: number;
  } | null;
};

function calcGuestDelta(
  previousCount: number,
  newCount: number,
  snapshots: PricingSnapshots
): DeltaBreakdown {
  const delta = Math.max(0, Math.floor(newCount) - Math.floor(previousCount));
  const taxRate = Number(snapshots.salesTaxRate ?? 0);

  const perGuestVenue = snapshots.venue?.booked ? Number(snapshots.venue?.perGuest || 0) : 0;
  const perGuestCatering = snapshots.catering?.booked ? Number(snapshots.catering?.perGuest || 0) : 0;
  const perGuestDessert =
    snapshots.dessert?.booked && snapshots.dessert?.isPerGuest
      ? Number(snapshots.dessert?.perGuest || 0)
      : 0;

  const venueSubtotal = delta * perGuestVenue;
  const cateringSubtotal = delta * perGuestCatering;
  const dessertSubtotal = delta * perGuestDessert;

  const plannerCalc = computePlannerDeltaForGuestChange({
    previousGuests: previousCount,
    newGuests: newCount,
    plannerSnapshot: snapshots.planner,
  });
  const plannerSubtotal = plannerCalc.owed;

  const subtotal = venueSubtotal + cateringSubtotal + dessertSubtotal + plannerSubtotal;
  const tax = +(subtotal * taxRate).toFixed(2);

// Stripe fee is based on subtotal + tax
const stripeFee = +((subtotal + tax) * STRIPE_RATE + STRIPE_FLAT).toFixed(2);

const totalDueNow = +(subtotal + tax + stripeFee).toFixed(2);

  let plannerExplain: DeltaBreakdown["plannerExplain"] = null;
  if (plannerCalc.newTier) {
    const booked =
      (snapshots.planner?.tiers || []).find((t) => t.id === snapshots.planner?.bookedTierId) || null;
    const originalLabel = booked
      ? `$${booked.price.toFixed(2)} for up to ${booked.maxGuests} guests`
      : undefined;
    const newLabel = `$${plannerCalc.newTier.price.toFixed(2)} for up to ${plannerCalc.newTier.maxGuests} guests`;
    const diff = plannerSubtotal;
    plannerExplain = {
      originalLabel,
      newLabel,
      diff: diff > 0 ? diff : 0,
      includedValue: snapshots.planner?.includedViaVenue ? (snapshots.planner?.includedValue || 0) : 0,
    };
  }

  return {
    deltaGuests: delta,
    venueSubtotal,
    cateringSubtotal,
    dessertSubtotal,
    plannerSubtotal,
    subtotal,
    tax,
    totalDueNow,
    perGuestVenue: perGuestVenue || undefined,
    perGuestCatering: perGuestCatering || undefined,
    plannerExplain,
    stripeFee,   
  };
}

// ---------- component ----------
const GuestListScroll: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [loading, setLoading] = useState(true);
  const [value, setValue] = useState<number>(0);
  const [original, setOriginal] = useState<number>(0);
  const [locked, setLocked] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);

  const [snapshots, setSnapshots] = useState<PricingSnapshots>({
    salesTaxRate: 0,
    venue: { booked: false, perGuest: 0 },
    catering: { booked: false, perGuest: 0 },
    dessert: { booked: false, isPerGuest: false, perGuest: 0 },
    planner: { model: "tiered", tiers: [], includedViaVenue: false, includedValue: 0, paidAmountStandalone: 0 },
  });

  async function loadPricingSnapshots(uid: string) {
    const catRef = doc(db, "users", uid, "pricingSnapshots", "catering");
    const catSnap = await getDoc(catRef);

    const next: PricingSnapshots = {
      salesTaxRate: 0,
      venue: { booked: false, perGuest: 0 },
      catering: { booked: false, perGuest: 0 },
      dessert: { booked: false, isPerGuest: false, perGuest: 0 },
      planner: { model: "none" },
    };

    if (catSnap.exists()) {
      const c = catSnap.data() as any;
      next.salesTaxRate = Number(c.salesTaxRate ?? 0);
      next.catering = { booked: !!c.booked, perGuest: Number(c.perGuest || 0) };
      if (c.charcuterieSelected) {
        next.dessert = {
          booked: true,
          isPerGuest: true,
          perGuest: Number(c.charcuteriePerGuest || 0),
        };
      }
    }

    return next;
  }

  useEffect(() => {
    let mounted = true;
    (async () => {
      const st = await getGuestState();
      if (!mounted) return;

      const base = Number(st.value || 0);
      setOriginal(base);
      setValue(base);
      setLocked(!!st.locked);

      onAuthStateChanged(getAuth(), async (u) => {
        if (!u) return;
        try {
          const snap = await loadPricingSnapshots(u.uid);
          if (mounted) setSnapshots(snap);
        } catch (e) {
          console.warn("⚠️ Could not load pricing snapshots:", e);
        }
      });

      // dev injection/local fallback
      try {
        // @ts-ignore
        const injected: PricingSnapshots | undefined = (window as any).__WED_PRICING__;
        if (injected) {
          setSnapshots(injected);
        } else {
          const raw = localStorage.getItem("pricingSnapshots");
          if (raw) setSnapshots(JSON.parse(raw));
        }
      } catch {
        /* noop */
      }

      setLoading(false);
    })();

    const sync = async () => {
      const st = await getGuestState();
      if (!mounted) return;
      const base = Number(st.value || 0);
      setOriginal(base);
      setValue(base);
      setLocked(!!st.locked);
    };
    window.addEventListener("guestCountUpdated", sync);
    window.addEventListener("guestCountLocked", sync);
    window.addEventListener("guestCountUnlocked", sync);
    return () => {
      mounted = false;
      window.removeEventListener("guestCountUpdated", sync);
      window.removeEventListener("guestCountLocked", sync);
      window.removeEventListener("guestCountUnlocked", sync);
    };
  }, []);

  // add-only bump
  const bump = (d: number) => setValue((v) => clamp(v + Math.abs(d), original, 2000));

  const delta = useMemo(() => calcGuestDelta(original, value, snapshots), [original, value, snapshots]);
  const pretty = useMemo(() => `${value.toLocaleString()} guests`, [value]);

  const FINAL_REASON: GuestLockReason = ("final" as unknown) as GuestLockReason;

  const handleLockAndMaybePay = async () => {
    if (delta.totalDueNow > 0) {
      setShowCheckout(true);
      return;
    }
    // no money due — persist + lock
    await setAndLockGuestCount(value, FINAL_REASON);
    window.dispatchEvent(new Event("guestCountUpdated"));
    window.dispatchEvent(new Event("guestCountLocked"));
    onClose();
  };

  const handleStripeSuccess = async () => {
    const auth = getAuth();
    const u = auth.currentUser;
    if (!u) {
      setShowCheckout(false);
      onClose();
      return;
    }

    try {
      // 1) persist + lock with reason "final"
      // ✅ new (keep the lock semantics the same as before)
await setGuestCount(value);
window.dispatchEvent(new Event("guestCountUpdated"));
window.dispatchEvent(new Event("guestCountLocked"));
      window.dispatchEvent(new Event("guestCountUpdated"));
      window.dispatchEvent(new Event("guestCountLocked"));

      // 2) mark final submission in booking (where the reminder reads it)
      const bookingRef = doc(db, "users", u.uid, "venueRankerData", "booking");
      await setDoc(
        bookingRef,
        { guestCountConfirmedAt: Date.now(), guestCountFinal: value },
        { merge: true }
      );

      // 3) generate/upload “Final Bill” (only if there was a delta)
      if (delta.totalDueNow > 0) {
        const pdf = await generateGuestDeltaReceiptPDF({
          fullName: u.displayName || "Wed&Done Client",
          weddingDate: localStorage.getItem("yumSelectedDate") || "",
          oldCount: original,
          newCount: value,
          additionalGuests: delta.deltaGuests,
          perGuest: {
            venue:   delta.perGuestVenue || 0,
            catering:delta.perGuestCatering || 0,
            dessert: 0,     // until dessert flow is wired
            planner: 0,     // planner is tier-based, never per-guest
          },
          amounts: {
            venue: delta.venueSubtotal,
            catering: delta.cateringSubtotal,
            dessert: delta.dessertSubtotal,
            planner: delta.plannerSubtotal,
            tax: delta.tax,
            stripeFee: delta.stripeFee, 
            subtotal: delta.subtotal,      // <-- was missing
            total: delta.totalDueNow,
          },
          notes: [
            delta.perGuestCatering
              ? `Per person catering cost: $${(delta.perGuestCatering || 0).toFixed(2)}`
              : "",
            delta.perGuestVenue
              ? `Per person venue cost: $${(delta.perGuestVenue || 0).toFixed(2)}`
              : "",
            delta.plannerExplain?.diff
              ? `Planner tier diff due: $${(delta.plannerExplain.diff || 0).toFixed(2)}`
              : "",
          ].filter(Boolean),
        });

        const storage = getStorage(app, "gs://wedndonev2.firebasestorage.app");
        const filename = `FinalBill_${Date.now()}.pdf`;
        const fileRef = ref(storage, `public_docs/${u.uid}/${filename}`);
        await uploadBytes(fileRef, pdf);
        const publicUrl = await getDownloadURL(fileRef);

        await updateDoc(doc(db, "users", u.uid), {
          documents: arrayUnion({
            title: "Final Bill (Guest Count Update)",
            url: publicUrl,
            uploadedAt: new Date().toISOString(),
          }),
          purchases: arrayUnion({
            label: "guest_count_delta",
            amount: Number(delta.totalDueNow.toFixed(2)),
            date: new Date().toISOString(),
            method: "final_adjustment",
          }),
        });
      }
    } catch (e) {
      console.error("❌ Finalize guest count failed:", e);
    } finally {
      setShowCheckout(false);
      onClose();
    }
  };

  return (
  <div style={styles.backdrop}>
    <div style={styles.card}>
      {/* Header (centered title, absolute close button) */}
      <div style={styles.header}>
        <h2 style={styles.h2Centered}>Add More Guests</h2>
        <button onClick={onClose} style={styles.closeAbs} aria-label="Close">
          ✖
        </button>
      </div>

      {/* Hero video */}
      <video
        src="/assets/videos/wedding_guests.mp4"
        autoPlay
        loop
        muted
        playsInline
        style={styles.heroVideo}
      />

      {loading ? (
        <div>Loading…</div>
      ) : (
        <>
          <p style={styles.sub}>
            More RSVPs than you thought? No problem! Use this little counter to add to your
            guest count. Our magic system will calculate the additional cost and show you
            exactly how much more you’ll need to pay for those extra partiers!
          </p>

          {/* Counter */}
          <div style={styles.counterWrap}>
            <div style={styles.bigNumber} aria-live="polite">
              {pretty}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
              <button onClick={() => bump(1)} style={styles.bumpBtn}>
                +1
              </button>
              <button onClick={() => bump(10)} style={styles.bumpBtn}>
                +10
              </button>
            </div>
          </div>

          {/* Exact entry */}
          <div style={styles.exactRow}>
            <label style={styles.exactLabel} htmlFor="guestCountField">
              Enter exact number
            </label>
            <input
              id="guestCountField"
              type="number"
              value={value}
              min={original}
              max={2000}
              disabled={locked}
              onChange={(e) => setValue(clamp(Number(e.target.value), original, 2000))}
              style={{ ...styles.input, opacity: locked ? 0.6 : 1 }}
            />
          </div>

          {/* Breakdown */}
          <div style={styles.breakdownCard}>
            <div style={styles.breakdownTitle}>
              {delta.deltaGuests > 0 ? `Additional guests: +${delta.deltaGuests}` : "No change to guest count"}
            </div>

            <div style={styles.totalLine}>
              Total due now: <strong>${delta.totalDueNow.toFixed(2)}</strong>
            </div>

            <div style={styles.notes}>
              {delta.deltaGuests > 0 &&
                snapshots.catering?.booked &&
                (delta.perGuestCatering ?? 0) > 0 && (
                  <div>
                    • Per person catering cost: <strong>${(delta.perGuestCatering || 0).toFixed(2)}</strong>
                  </div>
                )}
              {delta.deltaGuests > 0 &&
                snapshots.venue?.booked &&
                (delta.perGuestVenue ?? 0) > 0 && (
                  <div>
                    • Per person venue cost: <strong>${(delta.perGuestVenue || 0).toFixed(2)}</strong>
                  </div>
                )}
                {delta.deltaGuests > 0 &&
  snapshots.dessert?.booked &&
  snapshots.dessert?.isPerGuest &&
  (snapshots.dessert?.perGuest ?? 0) > 0 && (
    <div>
      • Per person charcuterie add-on:{" "}
      <strong>${(snapshots.dessert!.perGuest || 0).toFixed(2)}</strong>
    </div>
)}
              {delta.plannerSubtotal > 0 && delta.plannerExplain && (
                <div style={{ marginTop: 6 }}>
                  • Planner tier change:&nbsp;
                  {delta.plannerExplain.originalLabel && (
                    <>
                      originally included: <strong>{delta.plannerExplain.originalLabel}</strong>;{" "}
                    </>
                  )}
                  new tier: <strong>{delta.plannerExplain.newLabel}</strong>
                  {typeof delta.plannerExplain.includedValue === "number" &&
                    delta.plannerExplain.includedValue > 0 && (
                      <> (includes venue credit ${delta.plannerExplain.includedValue.toFixed(2)})</>
                    )}
                  ; difference due: <strong>${(delta.plannerExplain.diff || 0).toFixed(2)}</strong>
                </div>
              )}
              {(delta.tax > 0 || delta.stripeFee > 0) && (
                <div>
                  • Taxes &amp; fees:{" "}
                  <strong>${(delta.tax + (delta.stripeFee || 0)).toFixed(2)}</strong>
                </div>
              )}
            </div>
          </div>

          {/* CTA */}
          <div style={{ display: "flex", justifyContent: "center", marginTop: 18 }}>
            <button
              className="boutique-primary-btn"
              disabled={value < original}
              onClick={handleLockAndMaybePay}
              style={styles.cta}
            >
              Submit &amp; lock final guest count
            </button>
          </div>

          {/* Inline Stripe overlay */}
          {showCheckout && delta.totalDueNow > 0 && (
  <div style={styles.overlay}>
    <div style={styles.overlayCard}>
      {/* Floating lock video (same vibe as other checkouts) */}
      <video
        src="/assets/videos/lock.mp4"
        autoPlay
        muted
        playsInline
        loop
        style={{
          width: "140px",
          display: "block",
          margin: "0 auto 0.5rem",
          borderRadius: "12px",
        }}
        aria-hidden="true"
      />

      {/* Bigger, brandy title */}
      <h3
        style={{
          margin: "0.25rem 0 0.25rem",
          color: "#2c62ba",
          fontSize: "2rem",
          lineHeight: 1.2,
          fontWeight: 800,
          fontFamily: "'Nunito', system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        Final Balance
      </h3>

      <p style={{ marginTop: 6, fontSize: "1.1rem" }}>
        Amount due now: <strong>${delta.totalDueNow.toFixed(2)}</strong>
      </p>

      <Elements stripe={stripePromise}>
        <CheckoutForm
          total={delta.totalDueNow}
          onSuccess={handleStripeSuccess}
          isAddon={false}
        />
      </Elements>

      <button
        onClick={() => setShowCheckout(false)}
        className="boutique-back-btn"
        style={{ marginTop: 12 }}
      >
        Cancel
      </button>
    </div>
  </div>
)}
        </>
      )}
    </div>
  </div>
);
};

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    zIndex: 1000,
    background: "rgba(0,0,0,.5)",
    display: "grid",
    placeItems: "center",
    padding: 12,
  } as React.CSSProperties,

  // scrollable card
  card: {
    width: "min(92vw, 600px)",
    maxHeight: "88vh",
    overflowY: "auto", // <- important: allow scrolling
    background: "#fff",
    borderRadius: 20,
    boxShadow: "0 10px 30px rgba(0,0,0,.18)",
    padding: "22px 22px 18px",
    position: "relative",
  } as React.CSSProperties,

  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    marginBottom: 10,
  } as React.CSSProperties,

  h2Centered: {
    margin: 0,
    fontFamily: "'Jenna Sue', cursive",
    fontSize: "2.1rem",
    color: "#2c62ba",
    textAlign: "center",
  } as React.CSSProperties,

  closeAbs: {
    position: "absolute",
    right: 6,
    top: 0,
    border: "none",
    background: "transparent",
    fontSize: 22,
    cursor: "pointer",
    lineHeight: 1,
  } as React.CSSProperties,

  heroVideo: {
    width: "220px",
    display: "block",
    margin: "0.25rem auto 1rem",
    borderRadius: 16,
    // no boxShadow per your request
  } as React.CSSProperties,

  sub: { margin: "6px 0 14px", color: "#333", textAlign: "center" } as React.CSSProperties,

  counterWrap: {
    display: "grid",
    gridTemplateColumns: "1fr",
    justifyItems: "center",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  } as React.CSSProperties,

  bumpBtn: {
    padding: "10px 14px",
    background: "#f3f6ff",
    border: "1px solid #dfe6fb",
    color: "#2c62ba",
    borderRadius: 12,
    cursor: "pointer",
    fontWeight: 700,
  } as React.CSSProperties,

  bigNumber: {
    textAlign: "center",
    fontSize: "2rem",
    fontWeight: 800,
    color: "#2c62ba",
  } as React.CSSProperties,

  exactRow: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    marginTop: 10,
    justifyContent: "center",
  } as React.CSSProperties,

  exactLabel: { fontWeight: 600, color: "#2c62ba" } as React.CSSProperties,

  input: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #dcdff1",
    width: 140,
    fontWeight: 700,
  } as React.CSSProperties,

  breakdownCard: {
    marginTop: 18,
    padding: "12px 14px",
    border: "1px solid #e6ebff",
    borderRadius: 12,
    background: "#f8faff",
  } as React.CSSProperties,

  breakdownTitle: { fontWeight: 800, color: "#2c62ba", marginBottom: 8 } as React.CSSProperties,
  totalLine: { fontSize: 14, color: "#333", marginBottom: 10 } as React.CSSProperties,
  notes: { fontSize: 13, color: "#333", lineHeight: 1.5 } as React.CSSProperties,

  cta: {
    width: 280,
    padding: "12px 16px",
    fontSize: "1rem",
    fontWeight: 800,
  } as React.CSSProperties,

  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    display: "grid",
    placeItems: "center",
    zIndex: 1100,
  } as React.CSSProperties,

  overlayCard: {
    background: "#fff",
    borderRadius: 18,
    padding: "18px 18px 16px",
    width: "min(480px, 92vw)",
    boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
    textAlign: "center",
  } as React.CSSProperties,
};

export default GuestListScroll;