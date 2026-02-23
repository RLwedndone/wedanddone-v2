// src/components/VenueRanker/ReDesign/rdVenueScoring.ts

import type {
    BudgetTier,
    CollectionLean,
    RDInterviewState,
    VenueSlug,
    VenueScoreResult,
    MedallionTier,
    VenueVibe,
  } from "./rdVenueTypes";
  
  import {
    rdVenueAssets,
    rdVenueAssetsBySlug,
  } from "./rdVenueAssets";
  
  // --------------------------------------------------
  // Weights
  // --------------------------------------------------
  
  export const RD_WEIGHTS = {
    budget: 0.25,
    vibe: 0.40,
    flex: 0.18,
    catering: 0.10,
    guests: 0.07,
  } as const;
  
  const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
  
  function normalizeWeights() {
    const sum =
      RD_WEIGHTS.budget +
      RD_WEIGHTS.vibe +
      RD_WEIGHTS.flex +
      RD_WEIGHTS.catering +
      RD_WEIGHTS.guests;
  
    return {
      budget: RD_WEIGHTS.budget / sum,
      vibe: RD_WEIGHTS.vibe / sum,
      flex: RD_WEIGHTS.flex / sum,
      catering: RD_WEIGHTS.catering / sum,
      guests: RD_WEIGHTS.guests / sum,
    };
  }
  
  const W = normalizeWeights();
  
  // --------------------------------------------------
  // Budget
  // --------------------------------------------------
  
  function budgetTierToRange(tier: BudgetTier) {
    switch (tier) {
      case "under10":
        return { min: 0, max: 10000 };
      case "10to18":
        return { min: 10000, max: 18000 };
      case "18to25":
        return { min: 18000, max: 25000 };
      case "25plus":
        return { min: 25000, max: null };
      case "notsure":
      default:
        return { min: 0, max: null };
    }
  }
  
  function scoreBudget(venue: any, interview: RDInterviewState) {
    const tier = interview.budgetTier ?? "notsure";
    if (tier === "notsure") {
      return { score: 0.55, reason: "Budget neutral" };
    }

  
    // 🔮 IMPORTANT:
    // This assumes you'll later pipe in computed totals.
    // For now we stay neutral because rdVenueAssets does not contain pricing.
    return { score: 0.55, reason: "Budget placeholder (using neutral)" };
  }
  
  // --------------------------------------------------
  // VIBES
  // --------------------------------------------------
  
 
  
  function scoreVibes(venue: any, interview: RDInterviewState) {
    const selected = interview.vibes || [];
    if (!selected.length) {
      return { score: 0.55, reason: "Vibes neutral" };
    }
  
    const venueTags = new Set<string>(
      [venue.vibes.primary, venue.vibes.secondary].filter(Boolean)
    );
  
    const hits = selected.filter((v) => venueTags.has(v)).length;
    const ratio = hits / selected.length;
  
    const score = 0.45 + ratio * 0.55;
  
    return {
      score: clamp01(score),
      reason: `Vibes matched ${hits}/${selected.length}`,
    };
  }
  
  // --------------------------------------------------
  // FLEX / COLLECTION
  // --------------------------------------------------
  
  function scoreFlex(venue: any, interview: RDInterviewState) {
    const userLean = interview.collectionLean;
    if (!userLean || userLean === "neutral") {
      return { score: 0.55, reason: "Flex neutral" };
    }
  
    const venueCollection = venue.collection.toLowerCase(); // "novel" | "fable" | "romance"
  
    if (venueCollection === userLean) {
      return { score: 1.0, reason: "Flex perfect match" };
    }
  
    const order: CollectionLean[] = ["novel", "fable", "romance", "neutral"];
    const ui = order.indexOf(userLean);
    const vi = order.indexOf(venueCollection as CollectionLean);
  
    if (ui >= 0 && vi >= 0 && Math.abs(ui - vi) === 1) {
      return { score: 0.72, reason: "Flex close match" };
    }
  
    return { score: 0.48, reason: "Flex mismatch (soft)" };
  }
  
  // --------------------------------------------------
  // CATERING
  // --------------------------------------------------
  
  function scoreCatering(venue: any, interview: RDInterviewState) {
    const pref = interview.includeCatering;
  
    if (pref === null || typeof pref !== "boolean") {
      return { score: 0.55, reason: "Catering neutral" };
    }
  
    const included = venue.cateringIncludedInVenuePrice;
  
    if (pref === true) {
      return included
        ? { score: 1.0, reason: "Catering match" }
        : { score: 0.35, reason: "Catering mismatch" };
    }
  
    return { score: 0.7, reason: "Venue-only fine" };
  }
  
  // --------------------------------------------------
  // GUESTS (light weight)
  // --------------------------------------------------
  
  function scoreGuests(venue: any, interview: RDInterviewState) {
    const est = interview.guestCount;
  
    if (!est || typeof est !== "number") {
      return { score: 0.55, reason: "Guests neutral" };
    }
  
    const max = venue.maxCapacity;
  
    if (!max) {
      return { score: 0.55, reason: "Guests neutral (no cap)" };
    }
  
    if (est > max) {
      return { score: 0.1, reason: "Over capacity" };
    }
  
    const comfort = clamp01(1 - Math.abs(est - max * 0.6) / max);
  
    const score = 0.55 + comfort * 0.45;
  
    return {
      score: clamp01(score),
      reason: "Guest fit",
    };
  }
  
  // --------------------------------------------------
  // TIERS
  // --------------------------------------------------
  
  export const RD_TIER_CUTOFFS = {
    blue: 0.67,
    purple: 0.60,
    pink: 0.0,
  } as const;
  
  function toTier(score01: number): MedallionTier {
    if (score01 >= RD_TIER_CUTOFFS.blue) return "blue";
    if (score01 >= RD_TIER_CUTOFFS.purple) return "purple";
    return "pink";
  }
  
  // --------------------------------------------------
  // MAIN
  // --------------------------------------------------
  
  export function scoreVenue(
    slug: VenueSlug,
    interview: RDInterviewState
  ): VenueScoreResult {
    const venue = rdVenueAssetsBySlug[slug];
  
    const b = scoreBudget(venue, interview);
    const v = scoreVibes(venue, interview);
    const f = scoreFlex(venue, interview);
    const c = scoreCatering(venue, interview);
    const g = scoreGuests(venue, interview);
  
    const score01 =
      b.score * W.budget +
      v.score * W.vibe +
      f.score * W.flex +
      c.score * W.catering +
      g.score * W.guests;
  
    const tier = toTier(score01);
  
    return {
      slug,
      score: clamp01(score01),
      tier,
      breakdown: {
        budget: b.score,
        vibes: v.score,
        flex: f.score,
        catering: c.score,
        guests: g.score,
      },
      reasons: [b.reason, v.reason, f.reason, c.reason, g.reason],
    };
  }
  
  // Default: automatically use rdVenueAssets
  export function scoreAllVenues(interview: RDInterviewState) {
    const results = rdVenueAssets.map((v) =>
      scoreVenue(v.slug as VenueSlug, interview)
    );
  
    results.sort((a, b) => b.score - a.score);
  
    return results;
  }
  
  export function groupByTier(results: VenueScoreResult[]) {
    const blue: string[] = [];
    const purple: string[] = [];
    const pink: string[] = [];
  
    for (const r of results) {
      if (r.tier === "blue") blue.push(r.slug);
      else if (r.tier === "purple") purple.push(r.slug);
      else pink.push(r.slug);
    }
  
    return { blue, purple, pink };
  }