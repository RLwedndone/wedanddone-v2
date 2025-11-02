// src/data/dessertDeliveryFees.ts

/**
 * Central source of truth for dessert delivery / setup fees.
 *
 * Keys correspond exactly to the venue slugs stored in Firestore.
 * Values are flat delivery fees in USD.
 *
 * Maintenance:
 * - If Holly changes a fee, update it here.
 * - If we onboard a new shared Yum Yum venue, add it here.
 * - Any venue not listed here will default to STANDARD_LOCAL_FEE (if booked)
 *   or $0 (if no venue booked yet).
 */

export const STANDARD_LOCAL_FEE = 80;    // Default for local deliveries
export const OUT_OF_AREA_FEE = 250;      // Out-of-area (Tucson/Prescott/etc.)

export const DESSERT_DELIVERY_FEES: Record<string, number> = {
  // 🏜️ Desert Foothills (Tucson area)
  desertfoothills: OUT_OF_AREA_FEE,

  // 🧵 Fabric (Phoenix)
  fabric: STANDARD_LOCAL_FEE,

  // 💧 Windmill Winery Lake House
  lakehouse: OUT_OF_AREA_FEE,

  // 🐴 Windmill Winery Big Red Barn
  windmillbarn: OUT_OF_AREA_FEE,

  // 🏙️ Soho63 (Downtown Chandler)
  soho63: STANDARD_LOCAL_FEE,

  // 🍊 Sunkist Warehouse
  sunkist: STANDARD_LOCAL_FEE,
};

/**
 * normalizeVenueSlug:
 * Cleans up any raw venue string to a safe slug key.
 */
export function normalizeVenueSlug(raw: string | null | undefined): string {
  return (raw || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9-]/g, "");
}

/**
 * getDessertDeliveryFee:
 * - No venue booked yet → 0
 * - Venue listed here → that specific fee
 * - Venue booked but not listed → STANDARD_LOCAL_FEE
 */
export function getDessertDeliveryFee(venueSlug: string | null | undefined): number {
  if (!venueSlug) return 0;

  const norm = normalizeVenueSlug(venueSlug);

  if (norm in DESSERT_DELIVERY_FEES) {
    return DESSERT_DELIVERY_FEES[norm];
  }

  // booked venue but not explicitly listed = local fallback
  return STANDARD_LOCAL_FEE;
}