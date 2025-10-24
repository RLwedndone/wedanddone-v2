// src/components/NewYumBuild/dessert/dessertPricing.ts

// ──────────────────────────────────────────────────────────
// Global knobs
// ──────────────────────────────────────────────────────────
const GOODIE_MARKUP = 1.25;   // 25% margin on baker cost
const ROUND_TO = 1;           // round UP to nearest $1 (set 0.5 for 50¢, etc.)

const roundUp = (n: number, step = ROUND_TO) =>
  Math.ceil(n / step) * step;

// ──────────────────────────────────────────────────────────
// Core prices you already decided (these already include W&D margin)
// ──────────────────────────────────────────────────────────
export const DESSERT_PRICING = {
  PER_GUEST_TIERED: 8,     // $8 / guest (baker ~ $6.50 + margin)
  SMALL_CAKE_PRICE: 90,    // $90 flat (includes W&D margin)
  CUPCAKE_PRICE_EACH: 5,   // $5 each (includes W&D margin)
  CUPCAKE_MIN_EACH: 24,

  SALES_TAX_RATE: 0.086,
  STRIPE_RATE: 0.029,
  STRIPE_FLAT_FEE: 0.30,
  DEPOSIT_PCT: 0.25,
  FINAL_DUE_DAYS: 35,
} as const;

// ──────────────────────────────────────────────────────────
// Baker cost catalog (source of truth from the baker)
// ──────────────────────────────────────────────────────────
type GoodieBaseMeta = { bakerPricePerDozen: number; minDozens: number; group: string };

const GOODIE_CATALOG_BASE: Record<string, GoodieBaseMeta> = {
  // Brownies & Bars — $33/dz, min 2
  "Salted Caramel Brownies":        { bakerPricePerDozen: 33, minDozens: 2, group: "Brownies & Bars" },
  "Raspberry Oatmeal Bars":         { bakerPricePerDozen: 33, minDozens: 2, group: "Brownies & Bars" },
  "Cookies n'Cream Blondies":       { bakerPricePerDozen: 33, minDozens: 2, group: "Brownies & Bars" },

  // Shortbread Squares — $27/dz, min 2
  "Cardamom Ginger":                { bakerPricePerDozen: 27, minDozens: 2, group: "Shortbread Squares" },
  "Lemon Lavender":                 { bakerPricePerDozen: 27, minDozens: 2, group: "Shortbread Squares" },
  "Chocolate Orange":               { bakerPricePerDozen: 27, minDozens: 2, group: "Shortbread Squares" },

  // Cheesecake Bites — $27/dz, min 2
  "Vanilla Bean/Graham Crust":      { bakerPricePerDozen: 27, minDozens: 2, group: "Cheesecake Bites" },
  "Berry Swirl/Graham Crust":       { bakerPricePerDozen: 27, minDozens: 2, group: "Cheesecake Bites" },
  "Espresso/Chocolate Crust":       { bakerPricePerDozen: 27, minDozens: 2, group: "Cheesecake Bites" },

  // Homestyle Cookies — $33/dz, min 2
  "Sea Salt Chocolate Chunk":       { bakerPricePerDozen: 33, minDozens: 2, group: "Homestyle Cookies" },
  "White Chocolate Macadamia Nut":  { bakerPricePerDozen: 33, minDozens: 2, group: "Homestyle Cookies" },
  "Snickerdoodles":                 { bakerPricePerDozen: 33, minDozens: 2, group: "Homestyle Cookies" },
  "Butterscotch Crunch":            { bakerPricePerDozen: 33, minDozens: 2, group: "Homestyle Cookies" },
  "Chocolate Crinkle":              { bakerPricePerDozen: 33, minDozens: 2, group: "Homestyle Cookies" },

  // Tarts — $36/dz, min 3
  "S’mores":                        { bakerPricePerDozen: 36, minDozens: 3, group: "Tarts" },
  "Lemon Fresh Berry":              { bakerPricePerDozen: 36, minDozens: 3, group: "Tarts" },
  "Chocolate Caramel":              { bakerPricePerDozen: 36, minDozens: 3, group: "Tarts" },
  "Key Lime":                       { bakerPricePerDozen: 36, minDozens: 3, group: "Tarts" },
  "Passionfruit Margarita":         { bakerPricePerDozen: 36, minDozens: 3, group: "Tarts" },

  // Shooters — $42/dz, min 3
  "Tiramisu":                       { bakerPricePerDozen: 42, minDozens: 3, group: "Shooters" },
  "Tres Leches":                    { bakerPricePerDozen: 42, minDozens: 3, group: "Shooters" },
  "Strawberry Shortcake":           { bakerPricePerDozen: 42, minDozens: 3, group: "Shooters" },
  "Aztec Chocolate Mousse":         { bakerPricePerDozen: 42, minDozens: 3, group: "Shooters" },
  "Swedish Cream w/ Berry Compote": { bakerPricePerDozen: 42, minDozens: 3, group: "Shooters" },
  "Butterscotch Budino":            { bakerPricePerDozen: 42, minDozens: 3, group: "Shooters" },

  // Other Treats — mixed pricing, min 3
  "Creme Brulee Macarons":          { bakerPricePerDozen: 36, minDozens: 3, group: "Other Treats" },
  "Lavender Blueberry Macarons":    { bakerPricePerDozen: 36, minDozens: 3, group: "Other Treats" },
  "Simple Decor Sugar Cookies":     { bakerPricePerDozen: 39, minDozens: 3, group: "Other Treats" },
  "Chocolate & Pistachio Cannolis": { bakerPricePerDozen: 36, minDozens: 3, group: "Other Treats" },
  "Cinnamon Cereal Squares":        { bakerPricePerDozen: 30, minDozens: 3, group: "Other Treats" },
};

// ──────────────────────────────────────────────────────────
// Public catalog (with retail prices baked in)
// ──────────────────────────────────────────────────────────
export type GoodieMeta = {
  pricePerDozen: number;      // ✅ alias so callers can use pricePerDozen
  retailPerDozen: number;     // canonical name
  bakerPricePerDozen: number;
  minDozens: number;
  group: string;
};

export const GOODIE_CATALOG: Record<string, GoodieMeta> = Object.fromEntries(
  Object.entries(GOODIE_CATALOG_BASE).map(([label, meta]) => {
    const retail = roundUp(meta.bakerPricePerDozen * GOODIE_MARKUP);
    return [
      label,
      {
        pricePerDozen: retail,        // ✅ alias
        retailPerDozen: retail,       // canonical
        bakerPricePerDozen: meta.bakerPricePerDozen,
        minDozens: meta.minDozens,
        group: meta.group,
      },
    ];
  })
);