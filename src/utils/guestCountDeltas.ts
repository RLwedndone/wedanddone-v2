// src/utils/guestCountDeltas.ts
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { getGuestState } from "./guestCountStore";

// ───────────────────────── Types ─────────────────────────

export type DeltaBucketId = "catering" | "dessert" | "venue" | "planner";

export interface DeltaLine {
  id: DeltaBucketId;
  label: string;
  perGuest?: number; // for display
  addedGuests: number;
  addedTotal: number; // dollars
}

export interface GuestCountDeltaResult {
  lockedGuestCount: number;
  newGuestCount: number;
  addedGuests: number;
  lines: DeltaLine[];
  totalDelta: number;
}

// ───────────────────────── Helpers: planner tiers ─────────────────────────

// Pixie Planner base prices by guest count (what they’ve already been charged)
function plannerBasePriceFor(count: number): number {
  if (count <= 50) return 1250;
  if (count <= 100) return 1550;
  if (count <= 150) return 1850;
  return 2150; // up to ~200
}

// ───────────────────────── Helpers: venue tiers ─────────────────────────

type SimpleTier = { maxGuests: number; total: number };

type RubiPriceByDay = {
  saturday: number;
  fri_sun: number;
  weekday: number;
};

type RubiTier = {
  maxGuests: number;
  priceByDay: RubiPriceByDay;
};

// Bates – we use this ONLY for per-guest calc (delta = perGuest * addedGuests)
const BATES_TIERS: SimpleTier[] = [
  { maxGuests: 50, total: 10995 },
  { maxGuests: 100, total: 15995 },
  { maxGuests: 150, total: 19995 },
  { maxGuests: 200, total: 27995 },
];

// Vic, Verrado, Tubac – “up to” tiers; delta = newTierTotal − oldTierTotal
const VENUE_SIMPLE_GUEST_TIERS: Record<string, SimpleTier[]> = {
  vic: [
    { maxGuests: 100, total: 3000 }, // Ceremony + Reception total for up to 100
    { maxGuests: 250, total: 5000 }, // 101–250
  ],
  verrado: [
    { maxGuests: 60, total: 3750 }, // ≤60
    { maxGuests: 150, total: 5000 }, // 61–150
    { maxGuests: 250, total: 5000 }, // 151–250
  ],
  tubac: [
    { maxGuests: 70, total: 4200 }, // up to 70
    { maxGuests: 200, total: 5300 }, // 71–200
    { maxGuests: 250, total: 10000 }, // 201–250
  ],
};

// Rubi – tiered by guests + day of week
const RUBI_GUEST_TIERS: RubiTier[] = [
  {
    maxGuests: 50,
    priceByDay: { saturday: 8300, fri_sun: 7800, weekday: 6800 },
  },
  {
    maxGuests: 75,
    priceByDay: { saturday: 10400, fri_sun: 9900, weekday: 8900 },
  },
  {
    maxGuests: 100,
    priceByDay: { saturday: 12500, fri_sun: 12000, weekday: 11000 },
  },
];

// space change helpers for labels (Vic, Verrado, Tubac)
const VENUE_SPACE_BY_TIER: Record<
  string,
  {
    reception: { maxGuests: number; name: string }[];
  }
> = {
  vic: {
    reception: [
      { maxGuests: 60, name: "North Patio" },
      { maxGuests: 100, name: "Desert Terrace or Event Lawn" },
      { maxGuests: 250, name: "Quad and Patio" },
    ],
  },
  verrado: {
    reception: [
      { maxGuests: 60, name: "Banquet Room" },
      { maxGuests: 150, name: "Dining & Banquet Room" },
      { maxGuests: 250, name: "South Lawn" },
    ],
  },
  tubac: {
    reception: [
      { maxGuests: 70, name: "Apache Patio & Apache Private" },
      { maxGuests: 200, name: "Geronimo Ballroom & Geronimo Deck" },
      { maxGuests: 250, name: "Otero Lawn South" },
    ],
  },
};

function pickSimpleTierTotal(tiers: SimpleTier[], guestCount: number): number {
  if (!tiers.length) return 0;
  const sorted = [...tiers].sort((a, b) => a.maxGuests - b.maxGuests);
  const found =
    sorted.find((t) => guestCount <= t.maxGuests) ||
    sorted[sorted.length - 1];
  return found.total;
}

function pickBatesPerGuest(guestCount: number): number {
  if (!guestCount) return 0;
  const total = pickSimpleTierTotal(BATES_TIERS, guestCount);
  if (!total) return 0;
  return total / guestCount;
}

function normalizeDayType(dayOfWeek?: string | null): keyof RubiPriceByDay {
  const raw = (dayOfWeek || "").toLowerCase();
  if (raw === "saturday") return "saturday";
  if (raw === "friday" || raw === "sunday") return "fri_sun";
  return "weekday";
}

function pickRubiTierTotal(
  guestCount: number,
  dayOfWeek?: string | null
): number {
  if (!RUBI_GUEST_TIERS.length) return 0;
  const sorted = [...RUBI_GUEST_TIERS].sort(
    (a, b) => a.maxGuests - b.maxGuests
  );
  const tier =
    sorted.find((t) => guestCount <= t.maxGuests) ||
    sorted[sorted.length - 1];
  const dayKey = normalizeDayType(dayOfWeek);
  return tier.priceByDay[dayKey];
}

function pickVenueSpaceName(
  venueSlug: string,
  guestCount: number
): string | undefined {
  const cfg = VENUE_SPACE_BY_TIER[venueSlug];
  if (!cfg) return undefined;
  const tiers = cfg.reception || [];
  if (!tiers.length) return undefined;
  const sorted = [...tiers].sort((a, b) => a.maxGuests - b.maxGuests);
  const tier =
    sorted.find((t) => guestCount <= t.maxGuests) ||
    sorted[sorted.length - 1];
  return tier.name;
}

// ───────────────────────── Helpers: purchases ─────────────────────────

function asNumber(n: any): number {
  const v = Number(n);
  return Number.isFinite(v) ? v : 0;
}

function getPurchases(userData: any): any[] {
  const arr = userData?.purchases;
  return Array.isArray(arr) ? arr : [];
}

function sumContractTotals(
  userData: any,
  matcher: (p: any) => boolean
): number {
  return getPurchases(userData).reduce((sum, p) => {
    if (!matcher(p)) return sum;
    return sum + asNumber(p.contractTotal);
  }, 0);
}

// Small safety helper: all-in per-guest
function safePerGuest(totalBooked: number, guestCountAtBooking: number): number {
  if (!totalBooked || !guestCountAtBooking) return 0;
  return totalBooked / guestCountAtBooking;
}

// ───────────────────────── Main: computeGuestCountDeltas ─────────────────────────

export async function computeGuestCountDeltas(params: {
  userId: string;
  newGuestCount: number;
}): Promise<GuestCountDeltaResult> {
  const { userId, newGuestCount } = params;

  // 1) Load user doc (single source of truth)
  const userRef = doc(db, "users", userId);
  const snap = await getDoc(userRef);
  const userData = snap.exists() ? (snap.data() as any) : {};

  const bookings = (userData.bookings || {}) as any;

  // 2) Locked guest count from global store (fallback to Firestore guestCount)
  const st = await getGuestState();
  const lockedFromStore = Number(st.value || 0);
  const lockedGuestCount =
    lockedFromStore || asNumber(userData.guestCount) || 0;

  const newCount = Math.max(lockedGuestCount, Math.floor(newGuestCount || 0));
  const addedGuests = Math.max(0, newCount - lockedGuestCount);

  if (addedGuests <= 0 || !lockedGuestCount) {
    return {
      lockedGuestCount,
      newGuestCount: newCount,
      addedGuests: 0,
      lines: [],
      totalDelta: 0,
    };
  }

  const lines: DeltaLine[] = [];

  // ───────── Catering (per-guest, based on contract total / locked guest count)
  if (bookings.catering) {
    const totalCatering = sumContractTotals(userData, (p) => {
      const label = (p.label || "").toLowerCase();
      const cat = (p.category || "").toLowerCase();
      const bout = (p.boutique || "").toLowerCase();
      return (
        cat === "catering" ||
        bout === "catering" ||
        label.includes("catering")
      );
    });

    const perGuest = safePerGuest(totalCatering, lockedGuestCount);
    if (perGuest > 0) {
      const addedTotal = perGuest * addedGuests;
      lines.push({
        id: "catering",
        label: "Catering",
        perGuest,
        addedGuests,
        addedTotal,
      });
    }
  }

  // ───────── Dessert (per-guest, based on contract total / locked guest count)
  if (bookings.dessert) {
    const totalDessert = sumContractTotals(userData, (p) => {
      const label = (p.label || "").toLowerCase();
      const cat = (p.category || "").toLowerCase();
      const bout = (p.boutique || "").toLowerCase();
      return (
        cat === "dessert" ||
        bout === "dessert" ||
        label.includes("dessert")
      );
    });

    const perGuest = safePerGuest(totalDessert, lockedGuestCount);
    if (perGuest > 0) {
      const addedTotal = perGuest * addedGuests;
      lines.push({
        id: "dessert",
        label: "Dessert",
        perGuest,
        addedGuests,
        addedTotal,
      });
    }
  }

  // ───────── Venue (Bates = per-guest; Rubi/Vic/Verrado/Tubac = tier diff)
  if (bookings.venue) {
    const venueSlug: string | undefined =
      bookings.venueSlug || userData.venueSlug;
    const venueDayOfWeek: string | undefined =
      bookings.dayOfWeek || userData.dayOfWeek;

    if (venueSlug === "batesmansion") {
      // Bates – per-guest based on the tier they originally booked
      const perGuest = pickBatesPerGuest(lockedGuestCount);
      if (perGuest > 0) {
        const addedTotal = perGuest * addedGuests;
        lines.push({
          id: "venue",
          label: "Venue (Bates Mansion add-on for extra guests)",
          perGuest,
          addedGuests,
          addedTotal,
        });
      }
    } else if (venueSlug === "rubi") {
      // Rubi – tiered by guest + day-type; delta = newTier − oldTier
      const oldTotal = pickRubiTierTotal(lockedGuestCount, venueDayOfWeek);
      const newTotal = pickRubiTierTotal(newCount, venueDayOfWeek);
      const diff = Math.max(0, newTotal - oldTotal);

      if (diff > 0) {
        lines.push({
          id: "venue",
          label: "Venue tier adjustment (Rubi House)",
          perGuest: diff / addedGuests,
          addedGuests,
          addedTotal: diff,
        });
      }
    } else if (
      venueSlug === "vic" ||
      venueSlug === "verrado" ||
      venueSlug === "tubac"
    ) {
      const tiers = VENUE_SIMPLE_GUEST_TIERS[venueSlug];
      if (tiers && tiers.length) {
        const oldTotal = pickSimpleTierTotal(tiers, lockedGuestCount);
        const newTotal = pickSimpleTierTotal(tiers, newCount);
        const diff = Math.max(0, newTotal - oldTotal);

        if (diff > 0) {
          const oldSpace = pickVenueSpaceName(venueSlug, lockedGuestCount);
          const newSpace = pickVenueSpaceName(venueSlug, newCount);

          let label = "Venue tier adjustment";
          if (oldSpace && newSpace && oldSpace !== newSpace) {
            label += ` (reception moves from ${oldSpace} to ${newSpace})`;
          }

          lines.push({
            id: "venue",
            label,
            perGuest: diff / addedGuests,
            addedGuests,
            addedTotal: diff,
          });
        }
      }
    }
  }

  // ───────── Planner (Pixie Planner tiers based on guest count)
  if (bookings.planner) {
    const oldPrice = plannerBasePriceFor(lockedGuestCount);
    const newPrice = plannerBasePriceFor(newCount);
    const diff = Math.max(0, newPrice - oldPrice);

    if (diff > 0) {
      lines.push({
        id: "planner",
        label: "Planner tier adjustment",
        perGuest: diff / addedGuests,
        addedGuests,
        addedTotal: diff,
      });
    }
  }

  const totalDelta = lines.reduce((sum, line) => sum + line.addedTotal, 0);

  return {
    lockedGuestCount,
    newGuestCount: newCount,
    addedGuests,
    lines,
    totalDelta,
  };
}