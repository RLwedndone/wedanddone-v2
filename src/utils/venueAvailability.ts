// src/utils/venueAvailability.ts
// helpers for venue availability + booked date writes

import { doc, getDoc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { venuePricing, type Weekday } from "../data/venuePricing";

/**
 * markVenueDateUnavailable
 *
 * After someone books a venue, we call this ONCE.
 * It adds the booked date into /venues/{venueSlug}.bookedDates
 * (which CastleModal reads to block that date for future users).
 *
 * We also pass bookingId so later we could audit who blocked it.
 */
export async function markVenueDateUnavailable(opts: {
  venueSlug: string;
  weddingDate: string; // "YYYY-MM-DD"
  bookingId?: string; // optional metadata
}): Promise<void> {
  const { venueSlug, weddingDate, bookingId } = opts;

  // guard: we MUST have both
  if (!venueSlug || !weddingDate) {
    console.warn(
      "[markVenueDateUnavailable] Missing venueSlug or weddingDate, skipping."
    );
    return;
  }

  // normalize date -> YYYY-MM-DD
  const finalDate = weddingDate.includes("T")
    ? weddingDate.split("T")[0]
    : weddingDate;

  const venueRef = doc(db, "venues", venueSlug);

  // 1. read existing doc
  const snap = await getDoc(venueRef);

  if (!snap.exists()) {
    // venue doc doesn't exist yet → create it with bookedDates array
    console.warn(
      `[markVenueDateUnavailable] /venues/${venueSlug} did not exist. Creating it.`
    );
    await setDoc(venueRef, {
      bookedDates: [finalDate],
      lastUpdatedByBookingId: bookingId || null,
      lastUpdatedAt: new Date().toISOString(),
    });
    console.log(
      `[markVenueDateUnavailable] ✅ Created /venues/${venueSlug} with first booked date ${finalDate}`
    );
    return;
  }

  // 2. merge into existing array
  await updateDoc(venueRef, {
    bookedDates: arrayUnion(finalDate),
    lastUpdatedByBookingId: bookingId || null,
    lastUpdatedAt: new Date().toISOString(),
  });

  console.log(
    `[markVenueDateUnavailable] ✅ Added ${finalDate} to /venues/${venueSlug}.bookedDates`
  );
}

/* ─────────────────────────────────────────────────────────────
   ✅ Availability helper used by VenueDateEditor / calendar tiles
   Returns a consistent reason + blockedWeekdays for messaging
   ───────────────────────────────────────────────────────────── */

const weekdayMap: Weekday[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

// union helper (dedupe, preserve order)
function uniqWeekdays(list: Weekday[]): Weekday[] {
  const seen = new Set<Weekday>();
  const out: Weekday[] = [];
  for (const d of list) {
    if (!seen.has(d)) {
      seen.add(d);
      out.push(d);
    }
  }
  return out;
}

export type VenueAvailabilityReason =
  | "available"
  | "booked"
  | "blocked_range"
  | "sunday_not_allowed"
  | "closed_weekday"
  | "no_pricing_for_day"
  | "unknown_venue";

export type BlockedRange = {
  start: string; // "YYYY-MM-DD"
  end: string; // "YYYY-MM-DD"
};

export function getVenueDateAvailability(opts: {
  venueSlug: string;
  isoDate: string; // "YYYY-MM-DD"
  bookedDates: string[]; // ["YYYY-MM-DD", ...]
  blockedRanges?: BlockedRange[];
}): {
  unavailable: boolean;
  reason: VenueAvailabilityReason;
  weekday: Weekday;
  blockedWeekdays: Weekday[];
} {
  const { venueSlug, isoDate, bookedDates, blockedRanges = [] } = opts;

  // Safe parse (midday avoids timezone shifts)
  const d = new Date(`${isoDate}T12:00:00`);
  const weekday: Weekday = weekdayMap[d.getDay()] ?? "sunday";

  const venue = venuePricing[venueSlug];

  // If venue not found, don't hard-block dates, but mark unknown.
  // (You can choose to block instead, but this avoids nuking the calendar.)
  if (!venue) {
    return {
      unavailable: false,
      reason: "unknown_venue",
      weekday,
      blockedWeekdays: [],
    };
  }

  // Build a "blocked weekdays" list for UI messaging.
  // 1) explicit closedWeekdays
  const blockedFromClosed: Weekday[] = Array.isArray(venue.closedWeekdays)
    ? venue.closedWeekdays
    : [];

  // 2) weekdayPricing where day is missing or 0 → also effectively blocked
  const blockedFromPricing: Weekday[] = [];
  if (venue.weekdayPricing) {
    for (const day of weekdayMap) {
      const val = (venue.weekdayPricing as any)[day];
      // treat missing / 0 / negative as blocked (your data uses 0 for “closed”)
      if (val == null || Number(val) <= 0) blockedFromPricing.push(day);
    }
  }

  // 3) Sunday not allowed → add sunday
  const blockedFromSunday: Weekday[] =
    venue.allowsSundayBooking === false ? ["sunday"] : [];

  const blockedWeekdays = uniqWeekdays([
    ...blockedFromClosed,
    ...blockedFromPricing,
    ...blockedFromSunday,
  ]);

  // ✅ IMPORTANT: BOOKED ALWAYS WINS (real bookings override blanket holds)
  if (Array.isArray(bookedDates) && bookedDates.includes(isoDate)) {
    return {
      unavailable: true,
      reason: "booked",
      weekday,
      blockedWeekdays,
    };
  }

  // ── BLOCKED DATE RANGES (pricing freezes, seasonal holds, etc.) ──
  const isInBlockedRange =
    Array.isArray(blockedRanges) &&
    blockedRanges.some((r) => {
      const start = String((r as any)?.start || "").trim();
      const end = String((r as any)?.end || "").trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return false;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(end)) return false;

      // ISO strings compare correctly lexicographically
      return isoDate >= start && isoDate <= end;
    });

  if (isInBlockedRange) {
    return {
      unavailable: true,
      reason: "blocked_range",
      weekday,
      blockedWeekdays,
    };
  }

  // Sunday rule
  if (weekday === "sunday" && venue.allowsSundayBooking === false) {
    return {
      unavailable: true,
      reason: "sunday_not_allowed",
      weekday,
      blockedWeekdays,
    };
  }

  // Closed weekdays rule (explicit)
  if (blockedFromClosed.includes(weekday)) {
    return {
      unavailable: true,
      reason: "closed_weekday",
      weekday,
      blockedWeekdays,
    };
  }

  // weekdayPricing rule (0 / missing means not bookable)
  if (venue.weekdayPricing) {
    const val = (venue.weekdayPricing as any)[weekday];
    if (val == null || Number(val) <= 0) {
      return {
        unavailable: true,
        reason: "no_pricing_for_day",
        weekday,
        blockedWeekdays,
      };
    }
  }

  return {
    unavailable: false,
    reason: "available",
    weekday,
    blockedWeekdays,
  };
}