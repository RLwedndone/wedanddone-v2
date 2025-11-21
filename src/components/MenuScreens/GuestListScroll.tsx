// src/components/MenuScreens/GuestListScroll.tsx
import React, { useEffect, useMemo, useState } from "react";
import { getAuth } from "firebase/auth";
import {
  doc,
  setDoc,
  collection,
  addDoc,
} from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";

import {
  getGuestState,
  setAndLockGuestCount,
  type GuestLockReason,
} from "../../utils/guestCountStore";

const clamp = (n: number, min: number, max: number) =>
  Math.max(min, Math.min(max, n));

const GuestListScroll: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [loading, setLoading] = useState(true);

  const [value, setValue] = useState<number>(0); // current slider/input value
  const [original, setOriginal] = useState<number>(0); // locked/base guest count
  const [locked, setLocked] = useState(false);

  const [showThankYou, setShowThankYou] = useState(false);

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

  const pretty = useMemo(
    () => `${value.toLocaleString()} guests`,
    [value]
  );

  const FINAL_REASON: GuestLockReason = "final" as GuestLockReason;
  const additionalGuests = Math.max(value - original, 0);

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

  // 🔹 helper: log a Pixie Purchase-style request for a human invoice
  const createGuestCountPixieRequest = async (
    uid: string,
    oldCount: number,
    newCount: number,
    added: number
  ) => {
    const nowIso = new Date().toISOString();
    const colRef = collection(db, "users", uid, "pixiePurchases");

    await addDoc(colRef, {
      type: "guest_count_increase",
      label: "Guest Count Increase",
      description: `Guest count change from ${oldCount} to ${newCount} (+${added}).`,
      amount: null, // you (human) set this later
      currency: "usd",
      status: "requested",
      createdAt: nowIso,
      updatedAt: nowIso,
      oldGuestCount: oldCount,
      newGuestCount: newCount,
      additionalGuests: added,
    });
  };

  const bump = (d: number) =>
    setValue((v) => clamp(v + Math.abs(d), original, 2000));

  const handleSubmitFinalGuestCount = async () => {
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

        // 3) If they actually added guests, create a Pixie Purchase request
        if (additionalGuests > 0) {
          await createGuestCountPixieRequest(
            u.uid,
            original,
            value,
            additionalGuests
          );
        }
      }

      // 4) Show TY overlay instead of leaving scroll visible
      setShowThankYou(true);
    } catch (e) {
      console.error("❌ Finalize guest count (request only) failed:", e);
      onClose(); // fallback
    }
  };

  // 🔹 Close helper for the Thank You screen
  const handleCloseToDashboard = () => {
    try {
      // Hint for any reminder logic that this flow completed
      localStorage.setItem("guestCountScrollCompleted", "true");
    } catch {}
    onClose();

    // Hard jump to dashboard so no “scroll window” is left behind
    try {
      const base = `${window.location.origin}${
        import.meta.env.BASE_URL || "/"
      }`;
      window.location.href = `${base}dashboard`;
    } catch {
      // fallback: onClose already ran
    }
  };

  // ─────────────────────────────
  // THANK YOU BRANCH (full overlay)
  // ─────────────────────────────
  if (!loading && showThankYou) {
    return (
      <div style={styles.backdrop}>
        <div style={styles.thankYouCard}>
          <button
            onClick={handleCloseToDashboard}
            style={styles.closeAbs}
            aria-label="Close"
          >
            ✖
          </button>

          <img
            src={`${import.meta.env.BASE_URL}assets/images/guestcount_madge.png`}
            alt="Guest count locked"
            style={styles.thankYouImage}
          />

          <h3 style={styles.thankYouTitle}>
            Guest count locked — you’re all set!
          </h3>

          <p style={styles.thankYouBody}>
            We’re preparing the final bill for your additional guests and will
            send it to you through your Pixie Purchase folder in the menu.
          </p>

          <button
            className="boutique-primary-btn"
            style={styles.cta}
            onClick={handleCloseToDashboard}
          >
            Back to my dashboard
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────
  // MAIN SCROLL UI
  // ─────────────────────────────
  return (
    <div style={styles.backdrop}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.h2Centered}>Add More Guests</h2>
          <button onClick={onClose} style={styles.closeAbs} aria-label="Close">
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
              to update your final guest count. Once you submit, we’ll lock it
              in and our Pixie team will prepare the final bill and send it to
              you through your Pixie Purchase folder in the menu.
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

            {/* Simple “additional guests” breakdown */}
            <div style={styles.breakdownCard}>
              <div style={styles.breakdownTitle}>
                {additionalGuests > 0
                  ? `Additional guests: +${additionalGuests}`
                  : "No change to guest count"}
              </div>

              <div style={styles.totalLine}>
                We’ll prepare the final bill for any additional guests and send
                it to you as a Pixie Purchase.
              </div>
            </div>

            {/* CTA */}
            <div
              style={{ display: "flex", justifyContent: "center", marginTop: 18 }}
            >
              <button
                className="boutique-primary-btn"
                disabled={value < original}
                onClick={handleSubmitFinalGuestCount}
                style={styles.cta}
              >
                Submit &amp; lock final guest count
              </button>
            </div>
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
    marginBottom: 4,
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

  // ✨ Thank-you specific styles
  thankYouCard: {
    width: "min(92vw, 620px)",
    maxHeight: "88vh",
    overflowY: "auto",
    background: "#fff",
    borderRadius: 24,
    boxShadow: "0 12px 32px rgba(0,0,0,.25)",
    padding: "30px 28px 24px",
    position: "relative",
    textAlign: "center",
  } as React.CSSProperties,

  thankYouImage: {
    width: 220,
    height: "auto",
    borderRadius: 24,
    display: "block",
    margin: "0 auto 18px",
  } as React.CSSProperties,

  thankYouTitle: {
    marginTop: 4,
    marginBottom: 10,
    fontFamily: "'Jenna Sue', cursive",
    fontSize: "2rem",
    color: "#2c62ba",
  } as React.CSSProperties,

  thankYouBody: {
    margin: "0 0 18px",
    color: "#333",
    fontSize: "0.98rem",
    maxWidth: 460,
    marginInline: "auto",
  } as React.CSSProperties,
};

export default GuestListScroll;