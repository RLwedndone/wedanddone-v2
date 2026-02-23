// src/utils/venueAvailability.ts
import { db } from "../firebase/firebaseConfig";
import { doc, getDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { venuePricing, type Weekday } from "../data/venuePricing";

/** Inclusive blocked range using ISO strings (YYYY-MM-DD). */
export type BlockedRange = {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
};

export type VenueAvailabilityReason =
  | "booked"
  | "blocked_range"
  | "closed_weekday"
  | "no_pricing_for_day"
  | "sunday_not_allowed";

function isISODate(iso: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso);
}

function weekdayFromISO(isoDate: string): Weekday {
  // midday avoids TZ shift issues
  const weekdayName = new Date(isoDate + "T12:00:00")
    .toLocaleDateString("en-US", { weekday: "long" })
    .toLowerCase();

  return weekdayName as Weekday;
}

function isInBlockedRange(isoDate: string, ranges: BlockedRange[]): boolean {
  if (!isISODate(isoDate)) return false;

  // ISO strings sort lexicographically correctly for dates
  for (const r of ranges || []) {
    if (!r?.start || !r?.end) continue;
    if (!isISODate(r.start) || !isISODate(r.end)) continue;

    const start = r.start;
    const end = r.end;

    if (isoDate >= start && isoDate <= end) return true;
  }
  return false;
}

/**
 * Single source of truth for venue date availability.
 * Precedence is intentional:
 * 1) booked (hard stop)
 * 2) blocked_range (pricing not opened / seasonal block)
 * 3) weekday rules (closed_weekday / no_pricing_for_day / sunday_not_allowed)
 */
export function getVenueDateAvailability(params: {
  venueSlug: string;
  isoDate: string;
  bookedDates?: string[];
  blockedRanges?: BlockedRange[];
}): {
  unavailable: boolean;
  reason: VenueAvailabilityReason | null;
  blockedWeekdays?: Weekday[];
} {
  const { venueSlug, isoDate, bookedDates = [], blockedRanges = [] } = params;

  if (!venueSlug || !isoDate || !isISODate(isoDate)) {
    return { unavailable: false, reason: null };
  }

  // 1) Booked date (wins over everything)
  if (bookedDates.includes(isoDate)) {
    return { unavailable: true, reason: "booked" };
  }

  // 2) Blocked range (pricing not opened yet, seasonal holds, etc.)
  if (isInBlockedRange(isoDate, blockedRanges)) {
    return { unavailable: true, reason: "blocked_range" };
  }

  const info = venuePricing?.[venueSlug];
  const weekday = weekdayFromISO(isoDate);

  // 3) Sunday rule (support either flag name)
  const sundayNotAllowed =
    (info as any)?.sundayNotAllowed === true || (info as any)?.allowSunday === false;

  if (sundayNotAllowed && weekday === "sunday") {
    return { unavailable: true, reason: "sunday_not_allowed" };
  }

  // 4) Closed weekdays list
  const closedWeekdays = Array.isArray(info?.closedWeekdays) ? info!.closedWeekdays! : [];
  if (closedWeekdays.includes(weekday)) {
    return { unavailable: true, reason: "closed_weekday", blockedWeekdays: closedWeekdays };
  }

  // 5) Optional: if your pricing model only supports some weekdays,
  // treat missing weekday pricing as "no_pricing_for_day"
  const weekdayPricing = (info as any)?.weekdayPricing;
  if (weekdayPricing && typeof weekdayPricing === "object") {
    if (weekdayPricing[weekday] == null) {
      return { unavailable: true, reason: "no_pricing_for_day" };
    }
  }

  return { unavailable: false, reason: null };
}

/**
 * Safely append a newly-booked date to a venue's bookedDates array.
 * Called AFTER successful Stripe checkout.
 *
 * Preconditions:
 * - User is authenticated
 * - Checkout succeeded
 * - weddingDate is a "YYYY-MM-DD" string
 */
export async function markVenueDateUnavailable(params: {
  venueSlug: string;
  weddingDate: string;
  bookingId: string; // we generate this in VenueCheckOut
}): Promise<void> {
  const { venueSlug, weddingDate, bookingId } = params;

  // 1. Guard: if there's no date, do nothing
  if (!weddingDate || weddingDate.trim() === "") {
    console.warn("[markVenueDateUnavailable] No weddingDate, skipping venue block");
    return;
  }

  // 2. weddingDate is already "YYYY-MM-DD" from localStorage / contract.
  // No attempt to re-parse -> avoids NaN-NaN-NaN
  const finalDate = weddingDate.trim();

  try {
    const venueRef = doc(db, "venues", venueSlug);
    const snap = await getDoc(venueRef);

    if (!snap.exists()) {
      console.error("[markVenueDateUnavailable] Venue doc does not exist:", venueSlug);
      return;
    }

    // 3. Append to bookedDates array on the venue doc
    await updateDoc(venueRef, {
      bookedDates: arrayUnion(finalDate),
      lastBookingId: bookingId,
    });

    console.log(
      `[markVenueDateUnavailable] ✅ Added ${finalDate} to venues/${venueSlug}.bookedDates`
    );
  } catch (err) {
    console.error("[markVenueDateUnavailable] ❌ Firestore write failed:", err);
    throw err;
  }
}