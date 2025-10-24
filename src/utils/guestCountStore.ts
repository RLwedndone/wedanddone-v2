// src/utils/guestCountStore.ts
import { auth, db } from "../firebase/firebaseConfig";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

// Broaden reasons to allow boutique-scoped reasons, while keeping your originals
export type GuestLockReason =
  | "venue"
  | "catering"
  | "dessert"
  | "planner"
  | "yum:catering"
  | "yum:dessert"
  | "final_submission";

export type GuestCountState = {
  value: number;
  locked: boolean;
  lockedBy: GuestLockReason[];
  lockedAt?: number;        // ms epoch (when we locked)
  confirmedAt?: string;     // ISO string (when user/admin confirmed)
};

// ---- localStorage keys (for fast boot / guest fallback) ----
const LS_KEY = "guestCount";
const LS_LOCKED = "guestCount_locked";
const LS_LOCKED_BY = "guestCount_lockedBy";
const LS_LOCKED_AT = "guestCount_lockedAt";
const LS_CONFIRMED_AT = "guestCount_confirmedAt";

function readLS(): GuestCountState {
  const value = Number(localStorage.getItem(LS_KEY) ?? "0");
  const locked = localStorage.getItem(LS_LOCKED) === "true";
  const lockedBy = JSON.parse(localStorage.getItem(LS_LOCKED_BY) ?? "[]") as GuestLockReason[];
  const lockedAt = Number(localStorage.getItem(LS_LOCKED_AT) ?? "0") || undefined;
  const confirmedAt = localStorage.getItem(LS_CONFIRMED_AT) || undefined;
  return { value, locked, lockedBy, lockedAt, confirmedAt };
}

function writeLS(state: Partial<GuestCountState>) {
  const current = readLS();
  const next = { ...current, ...state };

  localStorage.setItem(LS_KEY, String(next.value ?? 0));
  localStorage.setItem(LS_LOCKED, String(!!next.locked));
  localStorage.setItem(LS_LOCKED_BY, JSON.stringify(next.lockedBy ?? []));
  if (next.lockedAt) localStorage.setItem(LS_LOCKED_AT, String(next.lockedAt));
  if (next.confirmedAt) localStorage.setItem(LS_CONFIRMED_AT, next.confirmedAt);
}

// ---- public API ----

export async function getGuestState(): Promise<GuestCountState> {
  const u = auth.currentUser;
  if (!u) return readLS(); // defensive; purchases should always have a user

  try {
    const snap = await getDoc(doc(db, "users", u.uid));
    if (snap.exists()) {
      const data = snap.data() as any;
      const value = Number(data.guestCount ?? 0);
      const locked = !!data.guestCountLocked;
      const lockedBy = Array.isArray(data.guestCountLockedBy)
        ? (data.guestCountLockedBy as GuestLockReason[])
        : [];
      const lockedAt = data.guestCountLockedAt ? Number(data.guestCountLockedAt) : undefined;
      const confirmedAt =
        typeof data.guestCountConfirmedAt === "string" ? data.guestCountConfirmedAt : undefined;

      // mirror to LS for fast boot + guest fallback
      writeLS({ value, locked, lockedBy, lockedAt, confirmedAt });
      return { value, locked, lockedBy, lockedAt, confirmedAt };
    }
  } catch {
    // ignore; fall back to LS
  }

  return readLS();
}

/**
 * Update the count (no locking). If already locked, emits "guestCountBlocked" and does nothing.
 */
export async function setGuestCount(next: number): Promise<void> {
  const state = await getGuestState();
  if (state.locked) {
    window.dispatchEvent(new Event("guestCountBlocked"));
    return;
  }

  const safe = Math.max(0, Number(next) || 0);
  writeLS({ value: safe });

  const u = auth.currentUser;
  if (u) {
    try {
      await setDoc(
        doc(db, "users", u.uid),
        { guestCount: safe, guestCountUpdatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch {/* noop */}
  }

  window.dispatchEvent(new Event("guestCountUpdated"));
}

/**
 * Lock the current guest count with a reason (doesn't change the value).
 */
export async function lockGuestCount(reason: GuestLockReason): Promise<void> {
  const prev = await getGuestState();
  const newReasons = Array.from(new Set([...(prev.lockedBy ?? []), reason]));
  const lockedAt = Date.now();

  writeLS({ locked: true, lockedBy: newReasons, lockedAt });

  const u = auth.currentUser;
  if (u) {
    try {
      await setDoc(
        doc(db, "users", u.uid),
        {
          guestCountLocked: true,
          guestCountLockedBy: newReasons,
          guestCountLockedAt: lockedAt,
          guestCountUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch {/* noop */}
  }

  window.dispatchEvent(new Event("guestCountLocked"));
}

/**
 * Convenience for bookings:
 * Sets the count and locks it atomically, with a reason.
 * Also stamps a confirmation time (ISO) since this usually happens at contract/checkout.
 */
export async function setAndLockGuestCount(value: number, reason: GuestLockReason): Promise<void> {
  const safe = Math.max(0, Number(value) || 0);
  const lockedAt = Date.now();
  const confirmedAt = new Date().toISOString();

  writeLS({
    value: safe,
    locked: true,
    lockedBy: Array.from(new Set([...(readLS().lockedBy ?? []), reason])),
    lockedAt,
    confirmedAt,
  });

  const u = auth.currentUser;
  if (u) {
    try {
      await setDoc(
        doc(db, "users", u.uid),
        {
          guestCount: safe,
          guestCountLocked: true,
          guestCountLockedBy: Array.from(new Set([...(readLS().lockedBy ?? []), reason])),
          guestCountLockedAt: lockedAt,
          guestCountConfirmedAt: confirmedAt,
          guestCountUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch {/* noop */}
  }

  window.dispatchEvent(new Event("guestCountUpdated"));
  window.dispatchEvent(new Event("guestCountLocked"));
}

/**
 * Tiny wrapper used by checkouts/finalize steps.
 * Keeps the “ensure” name we discussed while delegating to setAndLockGuestCount.
 */
export async function ensureGuestCountOnBooking(finalCount: number, reason: GuestLockReason): Promise<void> {
  await setAndLockGuestCount(finalCount, reason);
}

/**
 * Admin-only / debugging helper (not exposed in UI)
 */
export async function _unlockGuestCount(): Promise<void> {
  writeLS({ locked: false, lockedBy: [], lockedAt: undefined, confirmedAt: undefined });

  const u = auth.currentUser;
  if (u) {
    try {
      await setDoc(
        doc(db, "users", u.uid),
        {
          guestCountLocked: false,
          guestCountLockedBy: [],
          guestCountLockedAt: null,
          guestCountConfirmedAt: null,
          guestCountUpdatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch {/* noop */}
  }

  window.dispatchEvent(new Event("guestCountUnlocked"));
}