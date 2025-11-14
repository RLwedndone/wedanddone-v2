import { parseISO } from "date-fns";
import {
  venuePricing,
  plannerFeeForGuestCount,
  dayToBand,
  priceForTieredGuestsAndDay,
  Weekday,
  VenueCostStructure,
  calcSiteServiceCharge,
  applyAlcoholDiscountIfNeeded,  
} from "../data/venuePricing";

const AZ_SALES_TAX = 0.086;  // 8.6%
const CARD_FEE_RATE = 0.029;
const CARD_FEE_FIXED = 0.30;

function getWeekdayStr(d: Date): Weekday {
  return d.toLocaleDateString("en-US", { weekday: "long" }).toLowerCase() as Weekday;
}
function isSummerMonth(d: Date, v: VenueCostStructure): boolean {
  return !!v.summerMonths?.includes(d.getMonth()); // 0-based months
}
function applyDayDiscounts(base: number, v: VenueCostStructure, dow: Weekday, inSummer: boolean): number {
  if (!v.dayOfWeekDiscounts) return base;
  let total = base;
  for (const rule of v.dayOfWeekDiscounts) {
    if (rule.day === dow && (!rule.summerOnly || inSummer)) {
      total = Math.max(0, total - (rule.amount || 0));
    }
  }
  return total;
}
function addMargin(base: number, tiers: { min: number; max: number; margin: number }[]): number {
  const t = tiers.find((t) => base >= t.min && base <= t.max) || tiers[tiers.length - 1];
  return base + (t?.margin ?? 0);
}
function grossUpProcessingFee(amount: number, rate: number, fixed: number): number {
  if (rate <= 0 && fixed <= 0) return 0;
  return Math.max(0, (amount + fixed) / (1 - rate) - amount);
}

/**
 * Flow:
 * site fee → discounts/overage → site-only service charge → catering add-on
 * → venue rental tax (SITE FEE ONLY)
 * → planner fee
 * → margin tiers
 * → AZ sales tax (on EVERYTHING above except CC fee: site + service + add-on + venue rental tax + planner + margin)
 * → CC fee gross-up (last)
 */
export function computeVenueTotal(
  venueSlug: string,
  guestCount: number,
  weddingDateISO: string
): number {
  const v = venuePricing[venueSlug];
  if (!v) throw new Error(`Unknown venue: ${venueSlug}`);

  const date = parseISO(weddingDateISO);
  const dow = getWeekdayStr(date);
  const inSummer = isSummerMonth(date, v);

  // 1) Site fee by model
  let siteFee = 0;
  if (v.siteFeeFlat != null) {
    siteFee = v.siteFeeFlat;
  } else if (v.tieredByGuestsAndDay?.length) {
    siteFee = priceForTieredGuestsAndDay(v.tieredByGuestsAndDay, guestCount, dayToBand(dow));
  } else if (v.pricing && Object.keys(v.pricing).length) {
    const keys = Object.keys(v.pricing).map(Number).sort((a, b) => a - b);
    const chosen = keys.find((k) => guestCount <= k) ?? keys[keys.length - 1];
    siteFee = v.pricing[chosen] ?? 0;
  } else if (v.weekdayPricing) {
    siteFee = v.weekdayPricing[dow] ?? 0;
  }

  // 2) Discounts
  siteFee = applyDayDiscounts(siteFee, v, dow, inSummer);

  // 3) Overage (part of site)
  if (v.guestCap && v.overagePerGuest && guestCount > v.guestCap) {
    siteFee += (guestCount - v.guestCap) * v.overagePerGuest;
  }

  // 3b) Rubi Icon (no alcohol): subtract $X/guest from site fee
  //     (uses venuePricing.rubihouse.alcoholDiscountPerGuest = 20)
  siteFee = applyAlcoholDiscountIfNeeded(v, guestCount, siteFee, { excludeAlcohol: true });

  // 4) Service charge ON SITE FEE ONLY (flat + %)
  const siteService = calcSiteServiceCharge(v, siteFee);

  // 5) Catering add-on (Wed&Done surcharge when not using Santi’s)
  const cateringAddOn = v.cateringAddOn || 0;

  // 6) Venue rental tax — SITE FEE ONLY
  const venueRentalTax = (v.rentalTaxRate ?? 0) * siteFee;

  // 7) Planner fee (not part of venue rental tax)
  const plannerFee = plannerFeeForGuestCount(guestCount);

  // 8) Subtotal before margin
  const preMargin = siteFee + siteService + cateringAddOn + venueRentalTax + plannerFee;

  // 9) Margin tiers
  const withMargin = addMargin(preMargin, v.marginTiers);

  // 10) AZ sales tax on EVERYTHING except CC fee
  //     (includes site, service, add-on, venue rental tax, planner, and your margin)
  const azSalesTax = AZ_SALES_TAX * withMargin;

  // 11) Total before CC fee
  const beforeCC = withMargin + azSalesTax;

  // 12) CC processing fee (grossed up) last
  const processingFee = grossUpProcessingFee(beforeCC, CARD_FEE_RATE, CARD_FEE_FIXED);

  const grandTotal = beforeCC + processingFee;
  return Math.round(grandTotal * 100) / 100;
}