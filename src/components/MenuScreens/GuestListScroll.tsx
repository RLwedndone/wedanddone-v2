// src/components/MenuScreens/GuestListScroll.tsx
import React, { useEffect, useMemo, useState } from "react";
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
  setAndLockGuestCount,
  type GuestLockReason,
} from "../../utils/guestCountStore";

import {
  computeGuestCountDeltas,
  type GuestCountDeltaResult,
  type DeltaLine,
} from "../../utils/guestCountDeltas";

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const GuestListScroll: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [loading, setLoading] = useState(true);

  const [value, setValue] = useState<number>(0); // current slider/input value
  const [original, setOriginal] = useState<number>(0); // locked/base guest count
  const [locked, setLocked] = useState(false);

  const [userId, setUserId] = useState<string | null>(null);
  const [showCheckout, setShowCheckout] = useState(false);

  const [delta, setDelta] = useState<GuestCountDeltaResult | null>(null);
  const [showThankYou, setShowThankYou] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- 1) Hydrate base guest count from global guestCountStore
  useEffect(() => {
    let mounted = true;

    (async () => {
      const st = await getGuestState();
      if (!mounted) return;

      const base = Number(st.value || 0);
      setOriginal(base);
      setValue(base);
      setLocked(!!st.locked);
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

  // --- 2) Track current user id for the delta helper
  useEffect(() => {
    const unsub = onAuthStateChanged(getAuth(), (u) => {
      setUserId(u?.uid || null);
    });
    return () => unsub();
  }, []);

  // --- 3) Recompute deltas whenever the guest count changes
  useEffect(() => {
    if (!userId) {
      setDelta(null);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await computeGuestCountDeltas({
          userId,
          newGuestCount: value,
        });
        if (!cancelled) {
          setDelta(res);
        }
      } catch (e) {
        console.warn("[GuestListScroll] computeGuestCountDeltas failed:", e);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, value]);

  const bump = (d: number) =>
    setValue((v) => clamp(v + Math.abs(d), original, 2000));

  const pretty = useMemo(() => `${value.toLocaleString()} guests`, [value]);

  const FINAL_REASON: GuestLockReason = "final" as GuestLockReason;

  // 🔹 helper: keeps GuestCountReminderModal + account screen in sync
  const markGuestCountConfirmedEverywhere = async (
    uid: string,
    finalCount: number
  ) => {
    const now = Date.now();
    const bookingRef = doc(db, "users", uid, "venueRankerData", "booking");
    const userRef = doc(db, "users", uid);

    await setDoc(
      bookingRef,
      {
        guestCountConfirmedAt: now,
        guestCountFinal: finalCount,
        guestCountLocked: true,
      },
      { merge: true }
    );

    await setDoc(
      userRef,
      {
        guestCountConfirmedAt: now,
        guestCountLocked: true,
      },
      { merge: true }
    );

    try {
      localStorage.setItem("guestCountConfirmedAt", String(now));
    } catch {}
  };

  const totalDueNow = delta?.totalDelta || 0;
  const additionalGuests = delta?.addedGuests || 0;
  const deltaLines: DeltaLine[] = delta?.lines || [];

  const handleLockAndMaybePay = async () => {
    if (totalDueNow > 0) {
      setShowCheckout(true);
      return;
    }

    const auth = getAuth();
    const u = auth.currentUser;

    try {
      // 1) Lock in global guestCountStore
      await setAndLockGuestCount(value, FINAL_REASON);
      window.dispatchEvent(new Event("guestCountUpdated"));
      window.dispatchEvent(new Event("guestCountLocked"));

      // 2) Persist “confirmed + locked” for reminder/account screens
      if (u) {
        await markGuestCountConfirmedEverywhere(u.uid, value);
      }

      // 3) Show standalone Thank You screen
      setShowThankYou(true);
    } catch (e) {
      console.error("❌ Finalize guest count (no charge) failed:", e);
      onClose(); // fallback
    }
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
      // 🧙‍♀️ show magic-in-progress overlay
      setIsProcessing(true);

      // 1) Persist + lock with reason "final"
      await setAndLockGuestCount(value, FINAL_REASON);
      window.dispatchEvent(new Event("guestCountUpdated"));
      window.dispatchEvent(new Event("guestCountLocked"));

      // 2) Mark final submission in booking + user root
      await markGuestCountConfirmedEverywhere(u.uid, value);

      // 3) Generate/upload “Final Bill” PDF if there *was* a delta
      if (delta && totalDueNow > 0) {
        const cateringLine = delta.lines.find((l) => l.id === "catering");
        const dessertLine = delta.lines.find((l) => l.id === "dessert");
        const venueLine = delta.lines.find((l) => l.id === "venue");
        const plannerLine = delta.lines.find((l) => l.id === "planner");

        const subtotal =
          (cateringLine?.addedTotal || 0) +
          (dessertLine?.addedTotal || 0) +
          (venueLine?.addedTotal || 0) +
          (plannerLine?.addedTotal || 0);

        const pdf = await generateGuestDeltaReceiptPDF({
          fullName: u.displayName || "Wed&Done Client",
          weddingDate: localStorage.getItem("yumSelectedDate") || "",
          oldCount: original,
          newCount: value,
          additionalGuests: delta.addedGuests,
          perGuest: {
            venue: venueLine?.perGuest || 0,
            catering: cateringLine?.perGuest || 0,
            dessert: dessertLine?.perGuest || 0,
            planner: plannerLine?.perGuest || 0,
          },
          amounts: {
            venue: venueLine?.addedTotal || 0,
            catering: cateringLine?.addedTotal || 0,
            dessert: dessertLine?.addedTotal || 0,
            planner: plannerLine?.addedTotal || 0,
            tax: 0,
            stripeFee: 0,
            subtotal,
            total: totalDueNow,
          },
          notes: delta.lines.map((line) => {
            if (line.perGuest && line.addedGuests > 0) {
              return `${line.label}: $${line.perGuest.toFixed(2)} × ${
                line.addedGuests
              } = $${line.addedTotal.toFixed(2)}`;
            }
            return `${line.label}: $${line.addedTotal.toFixed(2)}`;
          }),
        });

        const storage = getStorage(
          app,
          "gs://wedndonev2.firebasestorage.app"
        );
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
            amount: Number(totalDueNow.toFixed(2)),
            date: new Date().toISOString(),
            method: "final_adjustment",
          }),
        });
      }

      // ✅ Done: close Stripe overlay, show thank you
      setShowCheckout(false);
      setShowThankYou(true);
    } catch (e) {
      console.error("❌ Finalize guest count failed:", e);
      setShowCheckout(false);
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  // ─────────────────────────────
  // Standalone Thank You screen
  // ─────────────────────────────
  if (showThankYou) {
    return (
      <div style={styles.backdrop}>
        <div style={styles.card}>
          <button
            onClick={onClose}
            style={styles.closeAbs}
            aria-label="Close"
          >
            ✖
          </button>

          <video
            src={`${import.meta.env.BASE_URL}assets/videos/guestcount.mp4`}
            autoPlay
            loop
            muted
            playsInline
            style={styles.heroVideo}
          />

          <h2
            style={{
              marginTop: 8,
              marginBottom: 8,
              fontFamily: "'Jenna Sue', cursive",
              fontSize: "2rem",
              color: "#2c62ba",
              textAlign: "center",
            }}
          >
            Guest count locked – you’re all set!
          </h2>

          <p
            style={{
              ...styles.sub,
              maxWidth: 480,
              margin: "0 auto 16px",
            }}
          >
            We’ve updated your final guest count and generated a little receipt
            for your records. Madge won’t bug you about guest count changes for
            this wedding anymore.
          </p>

          <div style={{ textAlign: "center", marginTop: 8 }}>
            <button
              className="boutique-primary-btn"
              style={styles.cta}
              onClick={onClose}
            >
              Back to my dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─────────────────────────────
  // Normal Scroll + Checkout UI
  // ─────────────────────────────
  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.h2Centered}>Add More Guests</h2>
          <button
            onClick={onClose}
            style={styles.closeAbs}
            aria-label="Close"
          >
            ✖
          </button>
        </div>

        {/* Hero video */}
        <video
          src={`${import.meta.env.BASE_URL}assets/videos/wedding_guests.mp4`}
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
              More RSVPs than you thought? No problem! Use this little counter
              to add to your guest count. Our magic system will calculate the
              additional cost and show you exactly how much more you’ll need to
              pay for those extra partiers!
            </p>

            {/* Counter */}
            <div style={styles.counterWrap}>
              <div style={styles.bigNumber} aria-live="polite">
                {pretty}
              </div>
              <div
                style={{ display: "flex", gap: 8, justifyContent: "center" }}
              >
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
                onChange={(e) =>
                  setValue(clamp(Number(e.target.value), original, 2000))
                }
                style={{ ...styles.input, opacity: locked ? 0.6 : 1 }}
              />
            </div>

            {/* Breakdown */}
            <div style={styles.breakdownCard}>
              <div style={styles.breakdownTitle}>
                {additionalGuests > 0
                  ? `Additional guests: +${additionalGuests}`
                  : "No change to guest count"}
              </div>

              <div style={styles.totalLine}>
                Total due now: <strong>${totalDueNow.toFixed(2)}</strong>
              </div>

              {additionalGuests > 0 && deltaLines.length > 0 && (
                <div style={styles.notes}>
                  {deltaLines.map((line) => (
                    <div key={line.id}>
                      • {line.label}:{" "}
                      {line.perGuest && line.addedGuests > 0 ? (
                        <>
                          <strong>${line.perGuest.toFixed(2)}</strong> ×{" "}
                          {line.addedGuests} guests ={" "}
                          <strong>${line.addedTotal.toFixed(2)}</strong>
                        </>
                      ) : (
                        <strong>${line.addedTotal.toFixed(2)}</strong>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* CTA */}
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginTop: 18,
              }}
            >
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
            {showCheckout && totalDueNow > 0 && (
              <div style={styles.overlay}>
                <div
                  style={{
                    ...styles.overlayCard,
                    width: isProcessing
                      ? "min(520px, 94vw)"
                      : "min(480px, 92vw)",
                    padding: isProcessing
                      ? "22px 22px 20px"
                      : styles.overlayCard.padding,
                  }}
                >
                  {isProcessing ? (
                    <>
                      {/* ✨ Magic in progress state */}
                      <video
                        src={`${import.meta.env.BASE_URL}assets/videos/magic_clock.mp4`}
                        autoPlay
                        loop
                        muted
                        playsInline
                        style={{
                          width: "260px",
                          maxWidth: "100%",
                          display: "block",
                          margin: "0 auto 0.75rem",
                          borderRadius: "12px",
                        }}
                        aria-hidden="true"
                      />

                      <h3
                        style={{
                          margin: "0.25rem 0 0.25rem",
                          color: "#2c62ba",
                          fontSize: "1.8rem",
                          lineHeight: 1.2,
                          fontWeight: 800,
                          fontFamily:
                            "'Jenna Sue', cursive, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
                        }}
                      >
                        Madge is sealing your guest scroll…
                      </h3>

                      <p
                        style={{
                          marginTop: 6,
                          fontSize: "1rem",
                          color: "#444",
                        }}
                      >
                        She’s finalizing your guest count and tucking your final
                        bill into your Documents.
                      </p>
                    </>
                  ) : (
                    <>
                      {/* 🔐 Final Balance + Stripe form */}
                      <video
                        src={`${import.meta.env.BASE_URL}assets/videos/lock.mp4`}
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

                      <h3
                        style={{
                          margin: "0.25rem 0 0.25rem",
                          color: "#2c62ba",
                          fontSize: "2rem",
                          lineHeight: 1.2,
                          fontWeight: 800,
                          fontFamily:
                            "'Nunito', system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, sans-serif",
                        }}
                      >
                        Final Balance
                      </h3>

                      <p style={{ marginTop: 6, fontSize: "1.1rem" }}>
                        Amount due now:{" "}
                        <strong>${totalDueNow.toFixed(2)}</strong>
                      </p>

                      {/* ✅ Same CheckoutForm pattern as other boutiques */}
                      <CheckoutForm
                        total={totalDueNow}
                        onSuccess={handleStripeSuccess}
                        isAddon={false}
                        customerEmail={
                          getAuth().currentUser?.email || undefined
                        }
                        customerName={
                          getAuth().currentUser?.displayName ||
                          "Wed&Done Client"
                        }
                        customerId={(() => {
                          try {
                            return (
                              localStorage.getItem("stripeCustomerId") ||
                              undefined
                            );
                          } catch {
                            return undefined;
                          }
                        })()}
                      />

                      <button
                        onClick={() => setShowCheckout(false)}
                        className="boutique-back-btn"
                        style={{ marginTop: 12 }}
                      >
                        Cancel
                      </button>
                    </>
                  )}
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

  card: {
    width: "min(92vw, 600px)",
    maxHeight: "88vh",
    overflowY: "auto",
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
  } as React.CSSProperties,

  sub: {
    margin: "6px 0 14px",
    color: "#333",
    textAlign: "center",
  } as React.CSSProperties,

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

  exactLabel: {
    fontWeight: 600,
    color: "#2c62ba",
  } as React.CSSProperties,

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

  breakdownTitle: {
    fontWeight: 800,
    color: "#2c62ba",
    marginBottom: 8,
  } as React.CSSProperties,

  totalLine: {
    fontSize: 14,
    color: "#333",
    marginBottom: 10,
  } as React.CSSProperties,

  notes: {
    fontSize: 13,
    color: "#333",
    lineHeight: 1.5,
  } as React.CSSProperties,

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