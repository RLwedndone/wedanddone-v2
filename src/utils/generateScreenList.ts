// src/utils/generateScreenList.ts

// Map vibes → venue screen IDs (must match keys in VenueRankerOverlay.screenComponents)
const vibeToVenues: Record<string, string[]> = {
  "garden-greenery": ["verrado", "themeadow", "encanterra"],
  "desert-dream": ["desertfoothills", "vic"],
  "distinctly-arizona": ["batesmansion", "rubihouse", "haciendadelsol", "lakehouse", "tubac", "ocotillo"],
  industrial: ["fabric", "sunkist"],
  modern: ["valleyho", "soho63"],
  "rustic-chic": ["farmhouse", "schnepfbarn", "windmillbarn"],
};

// Common UI/label variants → canonical keys above
const vibeAliases: Record<string, string> = {
  "garden greenery": "garden-greenery",
  garden_greenery: "garden-greenery",
  "rustic but chic": "rustic-chic",
  rustic_but_chic: "rustic-chic",
};

const normalizeVibe = (v: string) =>
  (v || "").toLowerCase().replace(/[_\s]+/g, "-");

// (Optional) whitelist to avoid bad slugs causing blank renders
const KNOWN_VENUE_SCREENS = new Set<string>([
  "batesmansion",
  "desertfoothills",
  "encanterra",
  "fabric",
  "farmhouse",
  "haciendadelsol",
  "valleyho",
  "lakehouse",
  "ocotillo",
  "rubihouse",
  "schnepfbarn",
  "soho63",
  "sunkist",
  "themeadow",
  "vic",
  "tubac",
  "verrado",
  "windmillbarn",
]);

export const generateScreenList = (selectedVibes: string[]): string[] => {
  if (!Array.isArray(selectedVibes) || selectedVibes.length === 0) return [];

  const seen = new Set<string>();
  const result: string[] = [];

  selectedVibes.forEach((raw) => {
    const normalized = normalizeVibe(raw);
    const key = vibeToVenues[normalized]
      ? normalized
      : vibeAliases[normalized] || normalized;

    const venues = vibeToVenues[key];
    if (!venues) {
      console.warn(`⚠️ Unknown vibe key in generateScreenList: "${raw}" → "${key}"`);
      return;
    }

    venues.forEach((slug) => {
      if (!KNOWN_VENUE_SCREENS.has(slug)) {
        console.warn(`⚠️ Unknown venue slug "${slug}" – skipping`);
        return;
      }
      if (!seen.has(slug)) {
        seen.add(slug);
        result.push(slug);
      }
    });
  });

  // IMPORTANT: do NOT append flow screens; overlay handles completion
  return result;
};