import React, { useEffect, useMemo, useState } from "react";
import { onAuthStateChanged, getAuth, User } from "firebase/auth";
import { doc, getDoc, updateDoc, setDoc } from "firebase/firestore";
import { db } from "../../firebase/firebaseConfig";
import emailjs from "@emailjs/browser";

// ───────── Helpers ─────────
const MS_DAY = 24 * 60 * 60 * 1000;
function parseLocalYMD(ymd: string): Date | null {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  return new Date(`${ymd}T12:00:00`); // avoid TZ slip
}
function daysBetween(a: Date, b: Date) {
  return Math.ceil((a.getTime() - b.getTime()) / MS_DAY);
}

type GuestCountReminderModalProps = {
  /** Open your GuestListScroll flow */
  onOpenGuestCountFlow: () => void;
  /** Optional close callback */
  onClose?: () => void;
};

// local keys
const LOCAL_KEY_CONFIRMED = "guestCountConfirmedAt";
const LOCAL_WEDDING_KEYS = ["weddingDate", "yumSelectedDate", "weddingDateISO"] as const;

// ───────── Component ─────────
const GuestCountReminderModal: React.FC<GuestCountReminderModalProps> = ({
  onOpenGuestCountFlow,
  onClose,
}) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const [weddingDateStr, setWeddingDateStr] = useState<string | null>(null);
  const [confirmedAt, setConfirmedAt] = useState<number | null>(null);

  const [guestCount, setGuestCount] = useState<number | null>(null); // ← show this
  const [shouldShow, setShouldShow] = useState(false);

  // 1) Auth + fetch data from the single source + fallbacks
  useEffect(() => {
    const auth = getAuth();
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u ?? null);

      if (!u) {
        setLoading(false);
        return;
      }

      try {
        let weddingYMD: string | null = null;
        let confirmedMs: number | null = null;
        let currentGuests: number | null = null;

        // A) Primary: venueRankerData/booking
        const bookingRef = doc(db, "users", u.uid, "venueRankerData", "booking");
        const bookingSnap = await getDoc(bookingRef);
        if (bookingSnap.exists()) {
          const b = bookingSnap.data() || {};
          weddingYMD = (b.weddingDate as string) || weddingYMD;
          if (typeof b.guestCountConfirmedAt === "number") confirmedMs = b.guestCountConfirmedAt;
          if (typeof b.guestCount === "number") currentGuests = b.guestCount;
        }

        // B) Fallback: user root
        if (!weddingYMD || confirmedMs == null || currentGuests == null) {
          const userRef = doc(db, "users", u.uid);
          const userSnap = await getDoc(userRef);
          if (userSnap.exists()) {
            const d = userSnap.data() || {};
            weddingYMD =
              (d.weddingDate as string) ||
              (d.profileData?.weddingDate as string) ||
              weddingYMD;
            if (confirmedMs == null && typeof d.guestCountConfirmedAt === "number") {
              confirmedMs = d.guestCountConfirmedAt;
            }
            if (currentGuests == null) {
              if (typeof d.guestCount === "number") currentGuests = d.guestCount;
              else if (typeof d.yumGuestCount === "number") currentGuests = d.yumGuestCount;
            }
          }
        }

        // C) Last resort: local storage date
        if (!weddingYMD) {
          for (const key of LOCAL_WEDDING_KEYS) {
            const v = localStorage.getItem(key);
            if (v && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
              weddingYMD = v;
              break;
            }
          }
        }

        // D) Local confirmation fallback
        if (confirmedMs == null) {
          const localConfirmed = localStorage.getItem(LOCAL_KEY_CONFIRMED);
          if (localConfirmed) confirmedMs = Number(localConfirmed) || null;
        }

        setWeddingDateStr(weddingYMD);
        setConfirmedAt(confirmedMs);
        setGuestCount(currentGuests);
      } catch (e) {
        console.error("GuestCountReminderModal: fetch error", e);
      } finally {
        setLoading(false);
      }
    });
    return () => unsub();
  }, []);

  // 2) Show logic: 45→30 day window, not already confirmed
  const computed = useMemo(() => {
    const today = new Date();
    const weddingDate = weddingDateStr ? parseLocalYMD(weddingDateStr) : null;
    if (!weddingDate) return { show: false, lockDate: null as Date | null };

    const lockDate = new Date(weddingDate.getTime() - 30 * MS_DAY);
    const remindStartDate = new Date(weddingDate.getTime() - 45 * MS_DAY);
    const isWithinReminderWindow = today >= remindStartDate && today <= weddingDate;
    const isLocked = today > lockDate;

    const show = isWithinReminderWindow && !isLocked && !confirmedAt;
    return { show, lockDate };
  }, [weddingDateStr, confirmedAt]);

  useEffect(() => setShouldShow(computed.show), [computed.show]);

  if (loading || !shouldShow) return null;

  const lockDateStr =
    computed.lockDate?.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) || "";

  // ───────── Actions ─────────
  const notifyAdmin = async (payload: {
    name?: string;
    email?: string;
    uid?: string;
    guestCount?: number | null;
    weddingDate?: string | null;
  }) => {
    try {
      // keep consistent with other files you already use
      await emailjs.send(
        "service_xayel1i",
        "template_nvsea3z",
        {
          user_name: payload.name || "Guest",
          user_email: payload.email || "unknown@wedndone.com",
          wedding_date: payload.weddingDate || "TBD",
          total: "0.00",
          line_items: `Guest count locked: ${payload.guestCount ?? "N/A"} guests`,
          pdf_url: "",
          pdf_title: "Guest Count Confirmation",
          uid: payload.uid || "",
        },
        "5Lqtf5AMR9Uz5_5yF" // your public key used elsewhere
      );
    } catch (err) {
      console.warn("GuestCountReminderModal: admin email failed (non-blocking)", err);
    }
  };

  const handleConfirmAndLock = async () => {
    const now = Date.now();
    // persist locally
    localStorage.setItem(LOCAL_KEY_CONFIRMED, String(now));

    try {
      if (user) {
        const bookingRef = doc(db, "users", user.uid, "venueRankerData", "booking");
        const userRef = doc(db, "users", user.uid);

        // write to booking doc (create/merge as needed)
        try {
          const bSnap = await getDoc(bookingRef);
          if (bSnap.exists()) {
            await updateDoc(bookingRef, {
              guestCountConfirmedAt: now,
              guestCountLocked: true,
            });
          } else {
            await setDoc(
              bookingRef,
              { guestCountConfirmedAt: now, guestCountLocked: true },
              { merge: true }
            );
          }
        } catch {}

        // also mirror at user root for consistency across readers
        await setDoc(
          userRef,
          { guestCountConfirmedAt: now, guestCountLocked: true },
          { merge: true }
        );

        // fire admin notification (best-effort)
        await notifyAdmin({
          name: `${user.displayName || ""}`.trim() || undefined,
          email: user.email || undefined,
          uid: user.uid,
          guestCount,
          weddingDate: weddingDateStr,
        });
      }
    } catch (e) {
      console.error("Failed to lock guest count:", e);
    }

    setShouldShow(false);
    onClose?.();
  };

  const handleAddMoreGuests = () => {
    onOpenGuestCountFlow(); // opens GuestListScroll.tsx flow
  };

  const close = () => {
    setShouldShow(false);
    onClose?.();
  };

  // ───────── UI ─────────
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      aria-modal
      role="dialog"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff",
          borderRadius: 24,
          padding: "1.5rem",
          width: "min(640px, 92vw)",
          boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
          position: "relative",
          textAlign: "center",
        }}
      >
        {/* Close X */}
        <button
          onClick={close}
          aria-label="Close"
          style={{
            position: "absolute",
            right: 16,
            top: 16,
            background: "transparent",
            border: "none",
            fontSize: 22,
            cursor: "pointer",
          }}
        >
          ✕
        </button>

        {/* Looping video */}
        <video
          src="/assets/videos/guest_count_reminder.mp4"
          autoPlay
          loop
          muted
          playsInline
          style={{
            width: "100%",
            maxWidth: 220,
            borderRadius: 12,
            display: "block",
            margin: "0 auto 0.75rem",
          }}
        />

        {/* Copy */}
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 6 }}>
          Confirm Your Guest Count
        </div>
        <div
          style={{
            fontSize: 15,
            lineHeight: 1.5,
            margin: "0 auto 12px",
            maxWidth: 520,
            color: "#333",
          }}
        >
          Your guest list <strong>locks on {lockDateStr}</strong>. Please confirm your
          current guest count or add more guests before that date.
        </div>

        {/* Current guest count */}
        <div
          style={{
            background: "#f7f9ff",
            border: "1px solid #dfe7ff",
            borderRadius: 16,
            padding: "0.9rem 1rem",
            margin: "0 auto 1rem",
            maxWidth: 520,
            fontSize: 16,
            fontWeight: 700,
            color: "#2c62ba",
          }}
        >
          Current guest count:{" "}
          <span style={{ color: "#111" }}>
            {guestCount != null ? guestCount : "—"}
          </span>
        </div>

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 8 }}>
          <button
            onClick={handleConfirmAndLock}
            style={{
              background: "#2c62ba",
              color: "#fff",
              border: "none",
              padding: "0.85rem 1.25rem",
              borderRadius: 12,
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Confirm and lock-in my current guest count
          </button>

          <button
            onClick={handleAddMoreGuests}
            className="boutique-back-btn"
            style={{
              padding: "0.85rem 1.25rem",
              borderRadius: 12,
              fontWeight: 800,
            }}
          >
            Add more guests
          </button>
        </div>
      </div>
    </div>
  );
};

export default GuestCountReminderModal;