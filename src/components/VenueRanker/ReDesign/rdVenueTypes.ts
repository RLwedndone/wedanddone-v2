// src/components/VenueRanker/ReDesign/rdVenueTypes.ts

// 🏰 All venue slugs (must match overlay + medallions exactly)
export type VenueSlug =
  | "batesmansion"
  | "desertfoothills"
  | "encanterra"
  | "fabric"
  | "farmhouse"
  | "haciendadelsol"
  | "valleyho"
  | "lakehouse"
  | "ocotillo"
  | "rubihouse"
  | "schnepfbarn"
  | "soho63"
  | "sunkist"
  | "themeadow"
  | "tubac"
  | "vic"
  | "verrado"
  | "windmillbarn";

// 💰 Q1 — Budget
export type BudgetTier =
  | "under10"
  | "10to18"
  | "18to25"
  | "25plus"
  | "notsure";

// 🧭 Q2 — Flexibility / Collection Lean
export type CollectionLean =
  | "novel"     // very flexible
  | "fable"     // balanced
  | "romance"   // vision-driven
  | "neutral";  // unsure

// 🌵 Q4 — Vibes (multi-select)  ✅ CANONICAL (matches rdVenueAssets)
export type VenueVibe =
  | "desert-dream"
  | "garden-greenery"
  | "industrial"
  | "modern"
  | "rustic-chic"
  | "distinctly-arizona";

// helpful constant (optional but super useful)
export const ALL_VIBES: VenueVibe[] = [
  "desert-dream",
  "garden-greenery",
  "industrial",
  "modern",
  "rustic-chic",
  "distinctly-arizona",
];

// 🧠 Master Interview State (Q1–Q4)
export interface RDInterviewState {
    budgetTier: BudgetTier | null;
    includeCatering: boolean | null;
    collectionLean: CollectionLean | null;
  
    // ✅ NEW: specific guest count (Q3)
    guestCount: number | null;
    vibes: VenueVibe[];
  }

// 🎖️ Medallion tiers shown on the castle screen
export type MedallionTier = "blue" | "purple" | "pink";

// 📊 Final scoring result per venue
export interface VenueScoreResult {
    slug: VenueSlug;
    score: number;
    tier: MedallionTier;
  
    // ✅ keep for debugging / future “why this match?” UI
    breakdown: {
      budget: number;
      vibes: number;
      flex: number;
      catering: number;
      guests: number;
    };
    reasons: string[];
  }