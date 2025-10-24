import { parseISO } from "date-fns";
import { venuePricing, Weekday } from "../data/venuePricing";

function weekday(dateISO: string): Weekday {
  return (parseISO(dateISO)
    .toLocaleDateString("en-US", { weekday: "long" })
    .toLowerCase()) as Weekday;
}

/**
 * Returns the deposit owed today for a venue.
 * - Default: use `venuePricing[slug].deposit`.
 * - Tubac: use `depositCalculation`:
 *      deposit = depositPercent * ( baseSiteFee + food&bevRequirement )
 *   where food&bevRequirement = max(fridayMin(if Friday), perGuestFoodAndBev * guestCount)
 * The result is clamped to not exceed the total price (caller can clamp again if desired).
 */
export function getVenueDeposit({
  venueSlug,
  guestCount,
  weddingDateISO,
  totalPrice, // optional clamp
}: {
  venueSlug: string;
  guestCount: number;
  weddingDateISO: string;
  totalPrice?: number;
}): number {
  const v = venuePricing[venueSlug];
  if (!v) throw new Error(`Unknown venue: ${venueSlug}`);

  // Tubac special rule
  if (v.depositCalculation) {
    const d = v.depositCalculation;
    const dow = weekday(weddingDateISO);

    const perGuestMin = (d.perGuestFoodAndBev || 0) * guestCount;
    const fridayMin = d.fridayFoodAndBevMin || 0;
    const fnbRequirement = dow === "friday" ? Math.max(fridayMin, perGuestMin) : perGuestMin;

    const basis = (d.baseSiteFee || 0) + fnbRequirement;
    let deposit = Math.round((basis * (d.depositPercent || 0)) * 100) / 100;

    if (totalPrice != null) deposit = Math.min(deposit, totalPrice);
    return Math.max(0, deposit);
  }

  // Default flat deposit
  let deposit = Math.max(0, v.deposit || 0);
  if (totalPrice != null) deposit = Math.min(deposit, totalPrice);
  return Math.round(deposit * 100) / 100;
}