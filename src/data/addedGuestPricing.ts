// src/data/addedGuestPricing.ts
import { plannerTierDelta } from "./plannerTiers";

/** ─── Types ─────────────────────────────────────────────────────────────── */

type SiteFeeRule =
  | { kind: "none" }
  | { kind: "prorated" } // Bates style: package ÷ booked guest count
  | { kind: "tierMap"; tiers: { threshold: number; price: number }[] };

type CateringRule =
  | { kind: "none" }
  | { kind: "included"; notes?: string } // site-fee already includes catering
  | {
      kind: "perGuest";
      perGuest?: number; // explicit per-guest number (e.g., 25)
      minGuests?: number; // threshold before per-guest applies
      source?: "yum"; // pull per-guest from Yum selection at runtime
      notes?: string;
    };

export interface AddedGuestRules {
  venueId: string;
  capacity?: number;         // hard cap for venue
  taxRate?: number;          // override default if needed
  siteFee: SiteFeeRule;
  catering: CateringRule;
  notes?: string;
}

export type AddedGuestCalcOptions = {
  cateringPerGuestFromYum?: number; // pass Yum $/guest when catering.source==="yum"
};

export const DEFAULT_ADDED_GUEST_TAX_RATE = 0.086;

/** Helpers */
const round2 = (n: number) => Math.round(n * 100) / 100;

/** ─── Rules per venue ───────────────────────────────────────────────────── */

const RULES: Record<string, AddedGuestRules> = {
  // 1) Bates — site fee includes catering; extra guests are prorated
  batesmansion: {
    venueId: "batesmansion",
    siteFee: { kind: "prorated" },
    catering: { kind: "included", notes: "Catering included in site fee (Ace Catering)." },
    notes:
      "Per Bates: package price ÷ booked guest count = per-person price for added guests. No decreases allowed.",
  },

  // 2) Desert Foothills — site fee is flat by day; catering add-on only if >200 guests ($25/guest)
  desertfoothills: {
    venueId: "desertfoothills",
    capacity: 250,
    siteFee: { kind: "none" }, // no site delta for adding guests
    catering: {
      kind: "perGuest",
      perGuest: 25,
      minGuests: 201, // only applies above 200
      notes: "$25/guest catering surcharge only for guests over 200.",
    },
  },

  // 3) Encanterra — site fee is tiered; catering priced separately (from Yum)
  encanterra: {
    venueId: "encanterra",
    siteFee: {
      kind: "tierMap",
      tiers: [
        { threshold: 50, price: 2500 },
        { threshold: 100, price: 4000 },
        { threshold: 150, price: 4000 },
        { threshold: 200, price: 4000 },
        { threshold: 250, price: 4000 },
      ],
    },
    catering: {
      kind: "perGuest",
      source: "yum", // we’ll read the selected Yum per-guest price at runtime
      notes: "Catering billed per-guest via Yum menu selection.",
    },
  },

  fabric: {
    venueId: "fabric",
    capacity: 250,
    // Flat site fee (no delta when guests increase)
    siteFee: { kind: "none" },
    // Catering is billed per guest via Yum (Santi's menus)
    catering: {
      kind: "perGuest",
      source: "yum",           // pass cateringPerGuestFromYum at compute time
      notes: "Catering priced per guest via Yum (Santi's).",
    },
    notes: "Fabric: flat site fee; added-guest charges come from Yum per‑guest catering only. Planner tier deltas still apply.",
  },
  
    // Schnepf's — Farmhouse (flat/weekday site fee; catering via Yum)
    farmhouse: {
      venueId: "farmhouse",
      capacity: 150,
      siteFee: { kind: "none" }, // no site delta for added guests
      catering: {
        kind: "perGuest",
        source: "yum",           // pass cateringPerGuestFromYum at compute time
        notes: "Catering priced per guest via Yum (in-house).",
      },
      notes: "Farmhouse: site fee is day-rate/flat; added-guest charges come from Yum per-guest catering. Planner tier deltas still apply.",
    },
  
    // Schnepf's — The Meadow (same rule as Farmhouse)
    themeadow: {
      venueId: "themeadow",
      capacity: 150,
      siteFee: { kind: "none" },
      catering: {
        kind: "perGuest",
        source: "yum",
        notes: "Catering priced per guest via Yum (in-house).",
      },
      notes: "The Meadow: site fee is day-rate/flat; added-guest charges come from Yum per-guest catering. Planner tier deltas still apply.",
    },
  
    // Schnepf's — Big Red Barn (same rule; higher capacity)
    schnepfbarn: {
      venueId: "schnepfbarn",
      capacity: 250,
      siteFee: { kind: "none" },
      catering: {
        kind: "perGuest",
        source: "yum",
        notes: "Catering priced per guest via Yum (in-house).",
      },
      notes: "Big Red Barn: site fee is day-rate/flat; added-guest charges come from Yum per-guest catering. Planner tier deltas still apply.",
    },
    haciendadelsol: {
      venueId: "haciendadelsol",
      capacity: 150,
      // Site is weekday-based/flat → no site delta for added guests
      siteFee: { kind: "none" },
      // Catering is billed per guest via Yum (their in-house menu selection)
      catering: {
        kind: "perGuest",
        source: "yum",
        notes: "Catering priced per guest via Yum (Hacienda in-house).",
      },
      notes:
        "Hacienda del Sol: site fee is day-rate/flat; added-guest charges come from Yum per-guest catering. Planner tier delta applied separately.",
    },
    valleyho: {
      venueId: "valleyho",
      capacity: 200,
      // Flat site fee → no site delta for added guests
      siteFee: { kind: "none" },
      // In-house catering; added-guest catering billed per guest via Yum selection
      catering: {
        kind: "perGuest",
        source: "yum",
        notes: "Catering priced per guest via Yum (Hotel Valley Ho in-house).",
      },
      notes:
        "Hotel Valley Ho: flat site fee; added-guest charges come from Yum per-guest catering. Planner tier delta applied separately.",
    },
    
  lakehouse: { venueId: "lakehouse", siteFee: { kind: "none" }, catering: { kind: "perGuest", source: "yum" } },
  windmillbarn: { venueId: "windmillbarn", siteFee: { kind: "none" }, catering: { kind: "perGuest", source: "yum" } },
  ocotillo: {
    venueId: "ocotillo",
    capacity: 100,
    // Site fee is flat by weekday; adding guests doesn't change it
    siteFee: { kind: "none" },
    // In-house catering priced per guest via Yum selection
    catering: {
      kind: "perGuest",
      source: "yum",
      notes: "Catering billed per guest via Yum (Ocotillo in-house).",
    },
    notes:
      "Ocotillo: flat site fee (weekday-based), so added-guest deltas come from Yum per-guest catering only. Planner tier delta applies separately.",
  },
  rubihouse: {
    venueId: "rubihouse",
    siteFee: {
      kind: "tierMap",
      tiers: [
        // Saturday pricing
        { threshold: 50, price: 8300 },   // up to 50 guests (Sat)
        { threshold: 75, price: 10400 },  // up to 75 guests (Sat)
        { threshold: 100, price: 12500 }, // up to 100 guests (Sat)
        // Fri/Sun pricing
        { threshold: 50, price: 7800 },
        { threshold: 75, price: 9900 },
        { threshold: 100, price: 12000 },
        // Weekday pricing
        { threshold: 50, price: 6800 },
        { threshold: 75, price: 8900 },
        { threshold: 100, price: 11000 },
      ],
    },
    catering: {
      kind: "perGuest",
      source: "yum", // catering always chosen via Yum Yum menus
      notes: "Catering billed per-guest via Yum menu; venue package covers site + bar.",
    },
    notes:
      "Rubi House uses tiered package pricing by guest count and day band (Sat, Fri/Sun, Weekday). " +
      "Additional guest charges = jump to higher package tier + Yum per-guest catering.",
  },

  // ─── Soho63 ────────────────────────────────────────────────────────────────
// Flat site fee by weekday (no guest-dependent site delta).
// Catering is Santi’s via Yum → per-guest.
soho63: {
  venueId: "soho63",
  capacity: 200,
  siteFee: { kind: "none" },
  catering: {
    kind: "perGuest",
    source: "yum",
    notes: "Catering priced per guest via Yum (Santi’s).",
  },
  notes:
    "Soho63 site fee doesn’t change when guests increase; added-guest charges are catering only (plus planner tier delta if crossed).",
},
  sunkist: { venueId: "sunkist", siteFee: { kind: "none" }, catering: { kind: "perGuest", source: "yum" } },
  vic: { venueId: "vic", siteFee: { kind: "tierMap", tiers: [] }, catering: { kind: "perGuest", source: "yum" } },
  verrado: { venueId: "verrado", siteFee: { kind: "tierMap", tiers: [] }, catering: { kind: "perGuest", source: "yum" } },
  tubac: { venueId: "tubac", siteFee: { kind: "tierMap", tiers: [] }, catering: { kind: "perGuest", source: "yum" } },
};

/** Safe getter */
export function getAddedGuestRules(venueId: string): AddedGuestRules {
  return RULES[venueId] ?? { venueId, siteFee: { kind: "none" }, catering: { kind: "none" } };
}

/** ─── Calculator ────────────────────────────────────────────────────────── */

export function computeAddedGuestDelta(
  venueId: string,
  args: {
    fromCount: number;
    toCount: number;
    bookedSitePrice?: number; // required when siteFee.kind === "prorated"
  },
  opts: AddedGuestCalcOptions = {}
): {
  venueDelta: number;
  cateringDelta: number;
  plannerDelta: number;
  taxDelta: number;
  totalDelta: number;
  notes: string[];
} {
  const rules = getAddedGuestRules(venueId);
  const taxRate = rules.taxRate ?? DEFAULT_ADDED_GUEST_TAX_RATE;

  const { fromCount, toCount, bookedSitePrice = 0 } = args;
  const added = Math.max(0, toCount - fromCount);

  // Venue delta
  let venueDelta = 0;
  switch (rules.siteFee.kind) {
    case "none":
      venueDelta = 0;
      break;
    case "prorated": {
      if (!bookedSitePrice || fromCount <= 0 || toCount <= fromCount) {
        venueDelta = 0;
      } else {
        const perGuest = bookedSitePrice / fromCount;
        venueDelta = round2(perGuest * added);
      }
      break;
    }
    case "tierMap": {
      const tiers = [...rules.siteFee.tiers].sort((a, b) => a.threshold - b.threshold);
      const priceFor = (count: number) => {
        let price = 0;
        for (const t of tiers) if (count <= t.threshold) { price = t.price; break; }
        if (price === 0 && tiers.length) price = tiers[tiers.length - 1].price;
        return price;
      };
      const before = priceFor(fromCount);
      const after = priceFor(toCount);
      venueDelta = round2(Math.max(0, after - before));
      break;
    }
  }

  // Catering delta
  let cateringDelta = 0;
  switch (rules.catering.kind) {
    case "none":
      cateringDelta = 0;
      break;
    case "included":
      cateringDelta = 0;
      break;
    case "perGuest": {
      const threshold = rules.catering.minGuests ?? 0;
      const perGuest =
        rules.catering.source === "yum"
          ? (opts.cateringPerGuestFromYum ?? 0)
          : (rules.catering.perGuest ?? 0);

      if (toCount <= fromCount) {
        cateringDelta = 0;
      } else if (toCount <= threshold) {
        // Entirely below or at threshold ⇒ no catering delta
        cateringDelta = 0;
      } else {
        // Portion above threshold only
        const effectiveAdded = Math.max(0, toCount - Math.max(fromCount, threshold));
        cateringDelta = round2(perGuest * effectiveAdded);
      }
      break;
    }
  }

  // Planner tier delta (not taxed)
  const plannerDelta = plannerTierDelta(fromCount, toCount);

  // Tax applies to venue+catering deltas (not planner)
  const taxable = venueDelta + cateringDelta;
  const taxDelta = round2(taxable * taxRate);

  const totalDelta = round2(venueDelta + cateringDelta + taxDelta + plannerDelta);

  // Build notes (string[])
  const notes: string[] = [];
  if (rules.notes) notes.push(rules.notes);
  if (plannerDelta > 0) notes.push(`Planner tier increase included: +$${Number(plannerDelta).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}`);
  if (taxable > 0) {
    notes.push(`Tax @ ${Number((taxRate * 100)).toLocaleString(undefined,{minimumFractionDigits:2,maximumFractionDigits:2})}% applied to venue + catering.`);
  } else {
    notes.push("No taxable venue/catering delta.");
  }

  return { venueDelta, cateringDelta, plannerDelta, taxDelta, totalDelta, notes };
}