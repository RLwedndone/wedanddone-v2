// src/components/VenueRanker/ReDesign/rdVenueAssets.ts
//
// Single source of truth for Venue Ranker “assets” (metadata)
// used by scoring + medallions + UI helpers.
//
// ✅ Includes:
// - canonical vibe mapping (primary + secondary)
// - collection tag (Novel / Fable / Romance)
// - capacity + manualConfirm flags
// - pricing model (helpful for “flexibility” scoring later)
// - a best-effort “catering included?” flag (derived from venueDetails copy)
//
// ⚠️ Budget scoring should use the *computed total shown in CastleModal*
// (via calculatePlan/computeVenueTotal). This file intentionally does NOT
// compute totals — it only provides metadata.

import { venuePricing } from "../../../data/venuePricing";
import { venueDetails } from "../../../utils/venueDetails";
import { venueToCollection } from "../../../utils/venueCollections";

export type RDVibeId =
  | "desert-dream"
  | "garden-greenery"
  | "industrial"
  | "modern"
  | "rustic-chic"
  | "distinctly-arizona";

export type RDCollection = "Novel" | "Fable" | "Romance";
export type RDVenueSlug = keyof typeof venuePricing;

export type RDPricingModel =
  | "flat" // siteFeeFlat
  | "weekday" // weekdayPricing
  | "tier" // pricing
  | "tieredByGuestsAndDay" // tieredByGuestsAndDay
  | "unknown";

export interface RDVenueVibes {
  primary: RDVibeId;
  secondary?: RDVibeId;
}

export interface RDVenueAsset {
  slug: RDVenueSlug;
  title: string; // UI title (prefer venueDetails.title)
  displayName: string; // pricing file displayName
  collection: RDCollection;
  vibes: RDVenueVibes;

  maxCapacity: number;
  manualConfirm: boolean;

  // partner/pricing metadata (useful later)
  usesSantis: boolean;
  customCaterer?: string;
  pricingModel: RDPricingModel;

  // derived from venueDetails copy (best-effort)
  cateringIncludedInVenuePrice: boolean;
}

/** Canonical mapping (primary + secondary) */
export const rdVenueVibesBySlug: Record<string, RDVenueVibes> = {
  batesmansion: { primary: "distinctly-arizona", secondary: "rustic-chic" },
  desertfoothills: { primary: "desert-dream", secondary: "distinctly-arizona" },
  encanterra: { primary: "garden-greenery", secondary: "distinctly-arizona" },
  fabric: { primary: "industrial", secondary: "modern" },
  farmhouse: { primary: "garden-greenery", secondary: "rustic-chic" },
  haciendadelsol: { primary: "distinctly-arizona", secondary: "desert-dream" },
  valleyho: { primary: "modern", secondary: "distinctly-arizona" },
  lakehouse: { primary: "garden-greenery", secondary: "distinctly-arizona" },
  ocotillo: { primary: "distinctly-arizona", secondary: "modern" },
  rubihouse: { primary: "distinctly-arizona", secondary: "rustic-chic" },
  schnepfbarn: { primary: "rustic-chic", secondary: "distinctly-arizona" },
  soho63: { primary: "modern", secondary: "distinctly-arizona" },
  sunkist: { primary: "industrial", secondary: "distinctly-arizona" },
  themeadow: { primary: "garden-greenery", secondary: "rustic-chic" },
  vic: { primary: "desert-dream", secondary: "distinctly-arizona" },
  tubac: { primary: "garden-greenery", secondary: "distinctly-arizona" },
  verrado: { primary: "garden-greenery", secondary: "distinctly-arizona" },
  windmillbarn: { primary: "rustic-chic", secondary: "distinctly-arizona" },
};

function toCollection(value: unknown): RDCollection {
  const v = String(value || "").toLowerCase();
  if (v === "novel") return "Novel";
  if (v === "fable") return "Fable";
  if (v === "romance") return "Romance";
  // safe default (shouldn’t happen if venueToCollection is complete)
  return "Novel";
}

function detectPricingModel(slug: string): RDPricingModel {
  const v = venuePricing[slug as RDVenueSlug];
  if (!v) return "unknown";
  if (v.siteFeeFlat != null) return "flat";
  if (v.weekdayPricing && Object.keys(v.weekdayPricing).length) return "weekday";
  if (v.pricing && Object.keys(v.pricing).length) return "tier";
  if (Array.isArray(v.tieredByGuestsAndDay) && v.tieredByGuestsAndDay.length)
    return "tieredByGuestsAndDay";
  return "unknown";
}

/**
 * Best-effort: infer whether *catering is included in venue price*
 * from the venueDetails “Castle Considerations” copy.
 *
 * We only need this as metadata (not budget math).
 * Budget scoring should be done via computeVenueTotal/calculatePlan.
 */
function inferCateringIncluded(slug: string): boolean {
  const details = (venueDetails as any)?.[slug];
  const list: string[] = Array.isArray(details?.castleConsiderations)
    ? details.castleConsiderations
    : [];

  const combined = list.join(" ").toLowerCase();

  // If it explicitly says NOT included, trust that.
  if (combined.includes("catering") && combined.includes("not included")) return false;

  // If it explicitly says included, trust that.
  if (combined.includes("catering") && combined.includes("is included")) return true;

  // Otherwise unknown → default false (most are not included)
  return false;
}

/**
 * ✅ The master list used by scoring + medallion logic.
 * We build from the vibe map so we don’t accidentally include a venue
 * before it has a vibe assignment.
 */
export const rdVenueAssets: RDVenueAsset[] = Object.keys(rdVenueVibesBySlug)
  .filter((slug) => Boolean((venuePricing as any)[slug]))
  .map((slug) => {
    const v = (venuePricing as any)[slug] as (typeof venuePricing)[RDVenueSlug];
    const d = (venueDetails as any)?.[slug];

    const title =
      (typeof d?.title === "string" && d.title.trim()) ||
      (typeof v?.displayName === "string" && v.displayName.trim()) ||
      slug;

    const collection = toCollection((venueToCollection as any)?.[slug]);

    return {
      slug: slug as RDVenueSlug,
      title,
      displayName: v?.displayName || title,
      collection,
      vibes: rdVenueVibesBySlug[slug],

      maxCapacity: Number(v?.maxCapacity || 0),
      manualConfirm: Boolean(v?.manualConfirm),

      usesSantis: Boolean(v?.usesSantis),
      customCaterer: v?.customCaterer,
      pricingModel: detectPricingModel(slug),

      cateringIncludedInVenuePrice: inferCateringIncluded(slug),
    };
  });

/** Fast lookup by slug */
export const rdVenueAssetsBySlug: Record<string, RDVenueAsset> = rdVenueAssets.reduce(
  (acc, a) => {
    acc[a.slug] = a;
    return acc;
  },
  {} as Record<string, RDVenueAsset>
);

/** Convenience: list of slugs in Ranker */
export const rdVenueSlugs: RDVenueSlug[] = rdVenueAssets.map((v) => v.slug);