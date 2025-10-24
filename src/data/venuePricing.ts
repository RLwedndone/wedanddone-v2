// src/data/venuePricing.ts

// ─────────────────────────────────────────────────────────────
// ✅ Back-compat: legacy flat planner fee (avoid using going forward)
export const weddingPlanningFee = 1200;

// ✅ New: tiered planner fees used at runtime
export const plannerFeeTiers: Array<{ maxGuests: number; fee: number }> = [
  { maxGuests: 100, fee: 1250 },
  { maxGuests: 150, fee: 1550 },
  { maxGuests: 200, fee: 1850 }, // 200+ ⇒ stays 1850 for now
];

/** Return the correct planner fee for a given guest count. */
export function plannerFeeForGuestCount(guestCount: number): number {
  for (const t of plannerFeeTiers) {
    if (guestCount <= t.maxGuests) return t.fee;
  }
  // >200 → use top tier
  return plannerFeeTiers[plannerFeeTiers.length - 1].fee;
}

export type Weekday =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

// ─────────────────────────────────────────────────────────────
// Data shapes

export interface VenueCostStructure {
  // Identity
  venueId: string;
  displayName: string;

  // Catering / partner flags (⚠️ do not change these — this is your margin logic)
  usesSantis: boolean;
  customCaterer?: string;
  cateringAddOn: number;

  // Capacity
  maxCapacity: number;
  /** Soft cap where overage kicks in (some venues) */
  guestCap?: number;
  /** $/guest beyond guestCap (some venues) */
  overagePerGuest?: number;

  // Fees + taxes (optional)
  /** Flat dollar venue service/admin fee (kept for back-compat) */
  serviceFee?: number;

  /** % service charge applied to the SITE FEE only (e.g., 0.22 = 22%) */
  siteServiceRate?: number;

  /** % service charge applied to MENU totals (not used yet; leave undefined) */
  menuServiceRate?: number;

  /** e.g., 0.0275 = 2.75% */
  rentalTaxRate?: number;

  // Pricing models (one of these per venue):
  /** Flat, guest-count independent */
  siteFeeFlat?: number;

  /** Tiered by guest count (map of tier key → price). Example keys: 50, 100, 150, ... */
  pricing?: { [guestCount: number]: number };

  /** By weekday (flat per day of week) */
  weekdayPricing?: { [day in Weekday]: number };

  /** Tier × day (e.g., Rubi House) */
  tieredByGuestsAndDay?: TieredByGuestsAndDay[];

  // Optional weekday modifiers
  dayOfWeekDiscounts?: {
    day: Weekday;
    amount: number;
    summerOnly?: boolean;
  }[];
  summerMonths?: number[];

  // Optional add-ons list
  rentalFees?: { description: string; amount: number }[];

  // Optional beverage package (example venue)
  beveragePackage?: {
    perGuest: number;
    additionalHourCost?: number;
  };

  // ── NEW: Dynamic “What’s Included” helpers (optional, UI only)
  /**
   * For venues where the selected spaces depend on guest count.
   * Keys should match your pricing tiers (e.g., 50, 100, 150…).
   */
  spaceByTier?: {
    ceremony: string; // one fixed ceremony space for the venue
    reception: Array<{ maxGuests: number; name: string }>; // pick the first where guestCount <= maxGuests
  };
  /**
   * Substrings to remove from the static “What’s Included” bullets
   * when spaceByTier is present (so we don’t show long generic lists).
   */
  includedStripPatterns?: string[];

  // Margin tiers (kept as-is from your file)
  marginTiers: { min: number; max: number; margin: number }[];

  // Deposit logic
  deposit: number;
  depositCalculation?: {
    baseSiteFee: number;
    fridayFoodAndBevMin: number;
    perGuestFoodAndBev: number;
    depositPercent: number;
  };

  // Operational rules
  allowsSundayBooking: boolean;
  allowsWhiskAndPaddle: boolean;
  closedWeekdays?: Weekday[];

  /**
   * @deprecated Planner fee is tiered now; compute at runtime via plannerFeeForGuestCount(guestCount).
   * This remains optional for back-compat so old data doesn't break.
   */
  plannerFee?: number;
}

export type DayBand = "saturday" | "fri_sun" | "weekday";

export interface TieredByGuestsAndDay {
  maxGuests: number;                  // 50, 75, 100
  priceByDay: Record<DayBand, number> // { saturday, fri_sun, weekday }
}

export function dayToBand(dow: Weekday): DayBand {
  if (dow === "saturday") return "saturday";
  if (dow === "friday" || dow === "sunday") return "fri_sun";
  return "weekday";
}

export function priceForTieredGuestsAndDay(
  tiers: TieredByGuestsAndDay[],
  guestCount: number,
  band: DayBand
): number {
  const sorted = [...tiers].sort((a,b) => a.maxGuests - b.maxGuests);
  const tier = sorted.find(t => guestCount <= t.maxGuests) ?? sorted[sorted.length - 1];
  return tier?.priceByDay[band] ?? 0;
}

// ─────────────────────────────────────────────────────────────
// Venue data

export const venuePricing: Record<string, VenueCostStructure> = {
  batesmansion: {
    venueId: "batesmansion",
    displayName: "Historic Bates Mansion",
    usesSantis: false,
    customCaterer: "Ace Catering",
    maxCapacity: 200,
    cateringAddOn: 1000,
    pricing: {
      50: 10995,
      100: 15995,
      150: 19995,
      200: 27995,
    },
    dayOfWeekDiscounts: [
      { day: "monday", amount: 500 },
      { day: "tuesday", amount: 500 },
      { day: "wednesday", amount: 500 },
      { day: "thursday", amount: 500 },
      { day: "friday", amount: 500, summerOnly: true },
      { day: "saturday", amount: 500, summerOnly: true },
    ],
    summerMonths: [6, 7, 8],
    marginTiers: [
      { min: 1200, max: 4999, margin: 2200 },
      { min: 5000, max: 8000, margin: 2800 },
      { min: 8001, max: 999999, margin: 3300 },
    ],
    deposit: 2000,
    allowsSundayBooking: true,
    allowsWhiskAndPaddle: true,
  },

  desertfoothills: {
    venueId: "desertfoothills",
    displayName: "Desert Foothills",
    usesSantis: true,
    cateringAddOn: 0,
    maxCapacity: 250,
    weekdayPricing: {
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 0,
      friday: 5600,
      saturday: 5600,
      sunday: 5300, // $4,200 base + $1,100 ceremony
    },
    beveragePackage: {
      perGuest: 25,
      additionalHourCost: 1100,
    },
    marginTiers: [
      { min: 1200, max: 4999, margin: 2200 },
      { min: 5000, max: 8000, margin: 2800 },
      { min: 8001, max: 999999, margin: 3300 },
    ],
    deposit: 4000,
    allowsSundayBooking: true,
    allowsWhiskAndPaddle: true,
    closedWeekdays: ["monday", "tuesday", "wednesday", "thursday"],
  },

  encanterra: {
    venueId: "encanterra",
    displayName: "Encanterra Golf Club",
    usesSantis: false,
    customCaterer: "Encanterra In-House Catering",
    maxCapacity: 250,
    cateringAddOn: 1000,
    pricing: {
      50: 2500,
      100: 4000,
      150: 4000,
      200: 4000,
      250: 4000,
    },
    marginTiers: [
      { min: 1200, max: 4999, margin: 2200 },
      { min: 5000, max: 8000, margin: 2800 },
      { min: 8001, max: 999999, margin: 3300 },
    ],
    deposit: 2500,
    allowsSundayBooking: true,
    allowsWhiskAndPaddle: true,
  },

  // FLAT site fee (was tier map, but values were identical)
  fabric: {
    venueId: "fabric",
    displayName: "Fabric",
    usesSantis: true,
    maxCapacity: 250,
    cateringAddOn: 0,
    siteFeeFlat: 3500,
    marginTiers: [
      { min: 1200, max: 4999, margin: 2200 },
      { min: 5000, max: 8000, margin: 2800 },
      { min: 8001, max: 999999, margin: 3300 },
    ],
    deposit: 1200,
    allowsSundayBooking: true,
    allowsWhiskAndPaddle: true,
  },

  farmhouse: {
    venueId: "farmhouse",
    displayName: "The Farmhouse",
    usesSantis: false,
    customCaterer: "Farmhouse In-House Catering",
    maxCapacity: 150,
    cateringAddOn: 1000,
    weekdayPricing: {
      monday: 5500,
      tuesday: 5500,
      wednesday: 5500,
      thursday: 5500,
      friday: 6500,
      saturday: 7000,
      sunday: 6000,
    },
    dayOfWeekDiscounts: [
      { day: "monday", amount: 1500, summerOnly: true },
      { day: "tuesday", amount: 1500, summerOnly: true },
      { day: "wednesday", amount: 1500, summerOnly: true },
      { day: "thursday", amount: 1500, summerOnly: true },
      { day: "friday", amount: 1500, summerOnly: true },
      { day: "saturday", amount: 1500, summerOnly: true },
      { day: "sunday", amount: 1500, summerOnly: true },
    ],
    summerMonths: [6, 7, 8],
    marginTiers: [
      { min: 1200, max: 4999, margin: 2200 },
      { min: 5000, max: 8000, margin: 2800 },
      { min: 8001, max: 999999, margin: 3300 },
    ],
    deposit: 2000,
    allowsSundayBooking: true,
    allowsWhiskAndPaddle: true,
    serviceFee: 650,
    rentalTaxRate: 0.0275,
  },

  themeadow: {
    venueId: "themeadow",
    displayName: "Schnepf's Farm - The Meadow",
    usesSantis: false,
    cateringAddOn: 1000,
    maxCapacity: 150,
    weekdayPricing: {
      monday: 0,
      tuesday: 0,
      wednesday: 0,
      thursday: 7000,
      friday: 7000,
      saturday: 7000,
      sunday: 7000,
    },
    marginTiers: [
      { min: 1200, max: 4999, margin: 2200 },
      { min: 5000, max: 8000, margin: 2800 },
      { min: 8001, max: 999999, margin: 3300 },
    ],
    deposit: 2000,
    allowsSundayBooking: true,
    allowsWhiskAndPaddle: true,
    serviceFee: 650,
    rentalTaxRate: 0.0275,
  },

  schnepfbarn: {
    venueId: "schnepfbarn",
    displayName: "Schnepf's Big Red Barn",
    usesSantis: false,
    maxCapacity: 250,
    cateringAddOn: 1000,
    weekdayPricing: {
      monday: 5400,
      tuesday: 5400,
      wednesday: 5400,
      thursday: 5400,
      friday: 5800,
      saturday: 6000,
      sunday: 5600,
    },
    dayOfWeekDiscounts: [
      { day: "monday", amount: 1500, summerOnly: true },
      { day: "tuesday", amount: 1500, summerOnly: true },
      { day: "wednesday", amount: 1500, summerOnly: true },
      { day: "thursday", amount: 1500, summerOnly: true },
      { day: "friday", amount: 1500, summerOnly: true },
      { day: "saturday", amount: 1500, summerOnly: true },
      { day: "sunday", amount: 1500, summerOnly: true },
    ],
    summerMonths: [6, 7, 8],
    marginTiers: [
      { min: 1200, max: 4999, margin: 2200 },
      { min: 5000, max: 8000, margin: 2800 },
      { min: 8001, max: 999999, margin: 3300 },
    ],
    deposit: 2000,
    allowsSundayBooking: true,
    allowsWhiskAndPaddle: true,
    serviceFee: 650,
    rentalTaxRate: 0.0275,
  },

  haciendadelsol: {
    venueId: "haciendadelsol",
    displayName: "Hacienda Del Sol",
    usesSantis: false,
    maxCapacity: 150,
    customCaterer: "Hacienda Del Sol In-House Catering",
    cateringAddOn: 1000,
    weekdayPricing: {
      monday: 2500,
      tuesday: 2500,
      wednesday: 2500,
      thursday: 2500,
      friday: 3500,
      saturday: 5000,
      sunday: 3500,
    },
    marginTiers: [
      { min: 1200, max: 4999, margin: 2200 },
      { min: 5000, max: 8000, margin: 2800 },
      { min: 8001, max: 999999, margin: 3300 },
    ],
    deposit: 2000,
    allowsSundayBooking: false,
    allowsWhiskAndPaddle: false,
  },

  // FLAT site fee (was tier map, but values were identical)
  valleyho: {
    venueId: "valleyho",
    displayName: "Hotel Valley Ho",
    usesSantis: false,
    customCaterer: "Hotel Valley Ho In-House Catering",
    cateringAddOn: 1000,
    maxCapacity: 200,
    siteFeeFlat: 3495,
    marginTiers: [
      { min: 1200, max: 4999, margin: 2200 },
      { min: 5000, max: 8000, margin: 2800 },
      { min: 8001, max: 999999, margin: 3300 },
    ],
    deposit: 5000,
    allowsSundayBooking: true,
    allowsWhiskAndPaddle: false,
    rentalTaxRate: 0.0225,
  },

  lakehouse: {
    venueId: "lakehouse",
    displayName: "The Windmill Winery Lake House",
    usesSantis: true,
    cateringAddOn: 250,
    maxCapacity: 150,
    weekdayPricing: {
      monday: 7000,
      tuesday: 7000,
      wednesday: 7000,
      thursday: 7000,
      friday: 8000,
      saturday: 10000,
      sunday: 7000,
    },
    guestCap: 150,
    marginTiers: [
      { min: 1200, max: 4999, margin: 2200 },
      { min: 5000, max: 8000, margin: 2800 },
      { min: 8001, max: 999999, margin: 3300 },
    ],
    deposit: 2000,
    allowsSundayBooking: true,
    allowsWhiskAndPaddle: true,
  },

  windmillbarn: {
    venueId: "windmillbarn",
    displayName: "Big Red Barn at Windmill Winery",
    usesSantis: true,
    maxCapacity: 200,
    cateringAddOn: 0,
    weekdayPricing: {
      monday: 7000,
      tuesday: 7000,
      wednesday: 7000,
      thursday: 7000,
      friday: 9000,
      saturday: 12000,
      sunday: 9000,
    },
    guestCap: 150,
    marginTiers: [
      { min: 1200, max: 4999, margin: 2200 },
      { min: 5000, max: 8000, margin: 2800 },
      { min: 8001, max: 999999, margin: 3300 },
    ],
    deposit: 2000,
    allowsSundayBooking: true,
    allowsWhiskAndPaddle: true,
  },

  ocotillo: {
    venueId: "ocotillo",
    displayName: "The Ocotillo",
    usesSantis: false,
    cateringAddOn: 1000,
    maxCapacity: 100,
    weekdayPricing: {
      monday: 5000,
      tuesday: 5000,
      wednesday: 5000,
      thursday: 5000,
      friday: 4000,
      saturday: 5000,
      sunday: 5000,
    },
    marginTiers: [
      { min: 1200, max: 4999, margin: 2200 },
      { min: 5000, max: 8000, margin: 2800 },
      { min: 8001, max: 999999, margin: 3300 },
    ],
    deposit: 1200,
    allowsSundayBooking: true,
    allowsWhiskAndPaddle: true,
  },

  rubihouse: {
    venueId: "rubihouse",
    displayName: "The Rubi House",
    usesSantis: false,
    cateringAddOn: 1000,
    maxCapacity: 100,

    // ✅ tier × day pricing
    tieredByGuestsAndDay: [
      { maxGuests: 50,  priceByDay: { saturday:  8300, fri_sun:  7800, weekday:  6800 } },
      { maxGuests: 75,  priceByDay: { saturday: 10400, fri_sun:  9900, weekday:  8900 } },
      { maxGuests: 100, priceByDay: { saturday: 12500, fri_sun: 12000, weekday: 11000 } },
    ],

    marginTiers: [
      { min: 1200, max: 4999, margin: 2200 },
      { min: 5000, max: 8000, margin: 2800 },
      { min: 8001, max: 999999, margin: 3300 },
    ],
    deposit: 2000,
    allowsSundayBooking: true,
    allowsWhiskAndPaddle: true,
  },

  soho63: {
    venueId: "soho63",
    displayName: "Soho63",
    usesSantis: true,
    maxCapacity: 200,
    cateringAddOn: 1250, // kitchen + cleaning
    weekdayPricing: {
      monday: 5800,
      tuesday: 5800,
      wednesday: 5800,
      thursday: 5800,
      friday: 7800,
      saturday: 8800,
      sunday: 6800,
    },
    dayOfWeekDiscounts: [
      { day: "monday", amount: 1000, summerOnly: true },
      { day: "tuesday", amount: 1000, summerOnly: true },
      { day: "wednesday", amount: 1000, summerOnly: true },
      { day: "thursday", amount: 1000, summerOnly: true },
      { day: "friday", amount: 1000, summerOnly: true },
      { day: "saturday", amount: 1000, summerOnly: true },
      { day: "sunday", amount: 1000, summerOnly: true },
    ],
    summerMonths: [6, 7, 8, 9],
    marginTiers: [
      { min: 1200, max: 4999, margin: 2200 },
      { min: 5000, max: 8000, margin: 2800 },
      { min: 8001, max: 999999, margin: 3300 },
    ],
    deposit: 2000,
    allowsSundayBooking: true,
    allowsWhiskAndPaddle: true,
  },

  // FLAT site fee (was tier map, but values were identical)
  sunkist: {
    venueId: "sunkist",
    displayName: "The Sunkist Warehouse",
    usesSantis: true,
    maxCapacity: 250,
    cateringAddOn: 0,
    siteFeeFlat: 7576.5,
    marginTiers: [
      { min: 1200, max: 4999, margin: 2200 },
      { min: 5000, max: 8000, margin: 2800 },
      { min: 8001, max: 999999, margin: 3300 },
    ],
    deposit: 4000,
    allowsSundayBooking: true,
    allowsWhiskAndPaddle: true,
  },

  // ─────────────────────────────────────────────────────────────
  // THE VIC 
  vic: {
    venueId: "vic",
    displayName: "The Vic",
    usesSantis: false,
    cateringAddOn: 1000,
    maxCapacity: 250,
  
    // ✅ Dynamic by actual guest count (your compute picks smallest tier >= guestCount)
    // ≤100 guests → $3,000 (Ceremony + Reception)
    // 101–250 guests → $5,000 (Ceremony + Reception)
    pricing: {
      100: 3000,  // Ceremony + Reception total for up to 100
      250: 5000,  // Ceremony + Reception total for 101–250
    },
  
    // ✅ Spaces shown in “What’s Included” (ceremony is fixed; reception varies by capacity)
    // We’ll show the selected pair in Castle Modal via getSelectedSpacesForTier()
    spaceByTier: {
      ceremony: "The Vic Event Lawn",  // fixed ceremony location for all counts
      reception: [
        { maxGuests: 60,  name: "North Patio" },
        { maxGuests: 100, name: "Desert Terrace or Event Lawn" }, // user can choose either
        { maxGuests: 250, name: "Quad and Patio" },
      ],
    },
  
    // 🔎 When spaceByTier is present, strip generic space bullets so we don’t duplicate
    includedStripPatterns: [
      "Multiple ceremony",    // generic
      "Event Lawn",
      "Desert Terrace",
      "North Patio",
      "Quad and Patio",
      "PDR and Patio",
    ],
  
    // 🔹 22% service charge on SITE FEE only (not on cateringAddOn or margin)
    siteServiceRate: 0.22,
  
    marginTiers: [
      { min: 1200, max: 4999, margin: 2200 },
      { min: 5000, max: 8000, margin: 2800 },
      { min: 8001, max: 999999, margin: 3300 },
    ],
    deposit: 1200,
    allowsSundayBooking: true,
    allowsWhiskAndPaddle: true,
  },

  // ─────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────
// VERRADO — dynamic ceremony/reception by actual guest count
verrado: {
  venueId: "verrado",
  displayName: "Verrado Golf Club",
  usesSantis: false,
  cateringAddOn: 1000,
  maxCapacity: 250, // Reception on South Lawn caps at 250 (per your latest notes)

  // ✅ Pricing = Ceremony + Reception (pick smallest tier >= guestCount)
  //   ≤60 guests   → 2,500 (ceremony South Lawn) + 1,250 (Banquet Room)          = 3,750
  //   61–150       → 2,500 (ceremony South Lawn) + 2,500 (Dining & Banquet)      = 5,000
  //   151–250      → 2,500 (ceremony South Lawn) + 2,500 (South Lawn reception)  = 5,000
  pricing: {
    60:  3750, // Ceremony: South Lawn + Reception: Banquet Room (≤60)
    150: 5000, // Ceremony: South Lawn + Reception: Dining & Banquet (61–150)
    250: 5000, // Ceremony: South Lawn + Reception: South Lawn (151–250)
  },

  // ✅ Spaces for Castle Modal “What’s Included”
  // Ceremony is fixed; reception varies by capacity.
  spaceByTier: {
    ceremony: "South Lawn",
    reception: [
      { maxGuests: 60,  name: "Banquet Room" },
      { maxGuests: 150, name: "Dining & Banquet Room" },
      { maxGuests: 250, name: "South Lawn" },
    ],
  },

  // 🧹 Hide generic space bullets when dynamic spaces are present
  includedStripPatterns: [
    "Multiple ceremony",
    "South Lawn",
    "Banquet Room",
    "Dining and Banquet",
    "Dining & Banquet",
  ],

  // 🔹 22% service charge on SITE FEE only (not on cateringAddOn or margin)
  siteServiceRate: 0.22,

  marginTiers: [
    { min: 1200, max: 4999, margin: 2200 },
    { min: 5000, max: 8000, margin: 2800 },
    { min: 8001, max: 999999, margin: 3300 },
  ],
  deposit: 1200,
  allowsSundayBooking: true,
  allowsWhiskAndPaddle: true,
},

  tubac: {
    venueId: "tubac",
    displayName: "Tubac Golf Resort and Spa",
    usesSantis: false,
    cateringAddOn: 1000,
    maxCapacity: 250,
    pricing: {
      50: 4200,
      100: 5300,
      150: 5300,
      200: 5300,
      250: 10000,
    },
    guestCap: 250,
    marginTiers: [
      { min: 1200, max: 4999, margin: 2200 },
      { min: 5000, max: 8000, margin: 2800 },
      { min: 8001, max: 999999, margin: 3300 },
    ],
    deposit: 0, // using depositCalculation below
    depositCalculation: {
      baseSiteFee: 10000,
      fridayFoodAndBevMin: 14000,
      perGuestFoodAndBev: 88,
      depositPercent: 0.25,
    },
    allowsSundayBooking: true,
    allowsWhiskAndPaddle: true,
  },
};

// ─────────────────────────────────────────────────────────────
// Helpers you already had (kept intact)
export function venueIsTiered(slug: string): boolean {
  const v = venuePricing[slug];
  return !!(v && v.pricing && Object.keys(v.pricing).length);
}

export function getVenueTierKey(slug: string, guestCount: number): number | null {
  const v = venuePricing[slug];
  if (!v || !v.pricing) return null;
  const keys = Object.keys(v.pricing).map(Number).sort((a, b) => a - b);
  const atOrAbove = keys.find((k) => k >= guestCount);
  return (atOrAbove ?? keys[keys.length - 1]) ?? null;
}

// ─────────────────────────────────────────────────────────────
// NEW: defaults + helpers for dynamic “What’s Included”

/** Default substrings to strip from static “What’s Included” when spaceByTier is present. */
export const DEFAULT_INCLUDED_STRIP_PATTERNS = [
  "Multiple ceremony",
  "South Lawn",
  "Banquet Room",
  "Dining and Banquet",
  "Dining & Banquet",
  "Event Lawn",
  "Desert Terrace",
  "North Patio",
  "Quad and Patio",
  "PDR and Patio",
];

// Support both the new and legacy shapes (back-compat).
type SpaceByTierNew = {
  ceremony: string;
  reception: Array<{ maxGuests: number; name: string }>;
};

type SpaceByTierLegacy = {
  [guestKey: number]: { ceremony?: string; reception?: string; note?: string };
};

function isNewSpaceByTier(obj: unknown): obj is SpaceByTierNew {
  const o = obj as any;
  return !!o && typeof o.ceremony === "string" && Array.isArray(o.reception);
}

function isLegacySpaceByTier(obj: unknown): obj is SpaceByTierLegacy {
  if (!obj || typeof obj !== "object") return false;
  const keys = Object.keys(obj as Record<string, unknown>);
  if (keys.length === 0) return false;
  // legacy uses numeric string keys like "50", "100", ...
  return keys.every((k) => !Number.isNaN(Number(k)));
}

/**
 * Given a venue slug and guest count, return the ceremony/reception names
 * configured for that tier (if any). Purely for UI presentation.
 */
export function getSelectedSpacesForTier(
  slug: string,
  guestCount: number
): { ceremony?: string; reception?: string; note?: string } {
  const v = venuePricing[slug];
  const sbt = v?.spaceByTier as SpaceByTierNew | SpaceByTierLegacy | undefined;
  if (!sbt) return {};

  // New shape: { ceremony, reception: [{maxGuests, name}, ...] }
  if (isNewSpaceByTier(sbt)) {
    const ceremony = sbt.ceremony;
    const recList = [...sbt.reception].sort((a, b) => a.maxGuests - b.maxGuests);
    const chosenRec =
      recList.find((r) => guestCount <= r.maxGuests) ?? recList[recList.length - 1];
    return { ceremony, reception: chosenRec?.name };
  }

  // Legacy shape: { 50: { ceremony, reception, note }, 100: {...}, ... }
  if (isLegacySpaceByTier(sbt)) {
    const keys = Object.keys(sbt).map(Number).sort((a, b) => a - b);
    const chosen = keys.find((k) => guestCount <= k) ?? keys[keys.length - 1];
    return sbt[chosen] || {};
  }

  // Unknown shape → nothing
  return {};
}

/**
 * Returns the dollar amount of the venue's service charge on the SITE FEE only.
 * - Flat serviceFee (fixed $) is included if present
 * - siteServiceRate (%) is applied ONLY to the base site fee
 * - Does NOT touch cateringAddOn, menu totals, or any other margins/fees
 */
export function calcSiteServiceCharge(
  venue: Pick<VenueCostStructure, "serviceFee" | "siteServiceRate">,
  baseSiteFee: number
): number {
  const flatFee = venue.serviceFee ?? 0;
  const percentFee = (venue.siteServiceRate ?? 0) * baseSiteFee;
  return flatFee + percentFee;
}