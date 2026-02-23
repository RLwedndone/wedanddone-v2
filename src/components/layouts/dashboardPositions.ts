// dashboardPositions.ts
export const DESKTOP_ASPECT = { w: 1920, h: 1080 };
export const MOBILE_ASPECT  = { w: 1080, h: 1920 };

export const DESKTOP_POS = {
  hud: {
    // ⛅ Logo: centered, a bit smaller
    // tweak widthClamp if you want it smaller/larger globally
    logoCloud: { topPct: 18, leftPct: 50, widthClamp: "clamp(260px, 20vw, 420px)" },

    // HUD items (feel free to tweak later)
    madge:      { topPct: 80, leftPct: 92, widthPct: 18  },
    menu:       { topPct:  10, leftPct: 93, widthPct: 7 },
    avatar:     { topPct: 23, leftPct: 93, widthPct: 6 },
    goldKey:    { topPct: 22, leftPct: 92, widthPct: 6  },
    budgetWand: { topPct: 20, leftPct:  8, widthPct: 10 },
    magicBook:  { topPct: 20, leftPct: 18, widthPct: 10 },
        // Social icons (bottom-left)
        facebook:  { topPct: 94, leftPct: 6,  widthPct: 5 },
        instagram: { topPct: 94, leftPct: 10, widthPct: 5 },
        youtube:   { topPct: 94, leftPct: 14, widthPct: 5 },
        tiktok:    { topPct: 94, leftPct: 18, widthPct: 5 },
  },

  boutiques: {
    // All boutique buttons share the same visual size via widthClamp.
    // Adjust once here to scale them all consistently.
    // Tip: if some still *look* bigger, it’s the PNG art’s internal padding.
    // Normalize canvas bounds in the assets for perfect match.
    photo:   { topPct: 46, leftPct: 33, widthClamp: "clamp(140px, 13.5vw, 220px)" },
    venue: { topPct: 46, leftPct: 50, widthClamp: "clamp(165px, 16vw, 265px)" },
    floral:  { topPct: 46, leftPct: 68, widthClamp: "clamp(140px, 13.5vw, 220px)" },

    yum:     { topPct: 76, leftPct: 33, widthClamp: "clamp(140px, 13.5vw, 220px)" },
    planner: { topPct: 76, leftPct: 50, widthClamp: "clamp(140px, 13.5vw, 220px)" },
    jam:     { topPct: 76, leftPct: 68, widthClamp: "clamp(140px, 13.5vw, 220px)" },
  },
};

// (unchanged) – tune later after desktop is finalized
export const MOBILE_POS = {
  hud: {
    logoCloud: { topPct: 13, leftPct: 50, widthPct: 45 },
    madge: { topPct: 86, leftPct: 86, widthPct: 40 },
    menu:       { topPct:  6, leftPct: 90, widthPct: 16 },
    avatar:     { topPct: 14, leftPct: 89, widthPct: 12 },
    goldKey:    { topPct: 14, leftPct: 88, widthPct: 12 },
    budgetWand: { topPct: 12, leftPct: 15, widthPct: 28 },
    magicBook:  { topPct: 78, leftPct: 50, widthPct: 25 },
        // Social icons (bottom-left)
        facebook:  { topPct: 95, leftPct: 10, widthPct: 14 },
        instagram: { topPct: 95, leftPct: 22, widthPct: 14 },
        youtube:   { topPct: 95, leftPct: 35, widthPct: 14 },
        tiktok:    { topPct: 95, leftPct: 47, widthPct: 14 },
  },
  boutiques: {
    venue: { topPct: 33, leftPct: 50, widthPct: 38 },
    photo:   { topPct: 43, leftPct: 20, widthPct: 31 },
    floral:  { topPct: 43, leftPct: 80, widthPct: 31 },
    yum:     { topPct: 63, leftPct: 20, widthPct: 31 },
    jam:     { topPct: 63, leftPct: 80, widthPct: 31 },
    planner: { topPct: 52, leftPct: 50, widthPct: 31 },
  },
};