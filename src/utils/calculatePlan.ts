import {
  differenceInMonths,
  addMonths,
  subDays,
  parseISO,
  isBefore,
} from "date-fns";
import { computeVenueTotal } from "./computeVenueTotal";
import { getVenueDeposit } from "./getVenueDeposit";

type ComputeVenueTotalResult =
  | number
  | {
      total: number;

      // Optional breakdown fields (we’ll add these in computeVenueTotal next)
      venueSubtotalBeforeDiscount?: number;
      venueDiscountApplied?: number;
      venueSubtotalAfterDiscount?: number;
      venueTax?: number;
      venueCardFee?: number;
      plannerPortion?: number;
    };

export function calculatePlan({
  venueSlug,
  guestCount,
  weddingDate, // "YYYY-MM-DD"
  today = new Date(),
  payFull = false,
  plannerPaidCents = 0,

  // ✅ NEW: venue invite discount (in dollars)
  // (We’ll apply it “for real” in computeVenueTotal next.)
  inviteDiscountDollars = 0,
}: {
  venueSlug: string;
  guestCount: number;
  weddingDate: string;
  today?: Date;
  payFull?: boolean;
  plannerPaidCents?: number;

  // ✅ NEW
  inviteDiscountDollars?: number;
}) {
  // ✅ Backwards-safe: computeVenueTotal might return a number (today)
  // or a breakdown object (after we update it next).
  const computed = computeVenueTotal(
    venueSlug,
    guestCount,
    weddingDate,
    //computeVenueTotal will accept this options object in the next step
    { inviteDiscountDollars }
  ) as ComputeVenueTotalResult;

  const grossTotal =
    typeof computed === "number" ? computed : Number(computed?.total || 0);

  // Apply planner credit once, centrally (credit can exceed the tier; cap at total)
  const plannerCredit = Math.min(grossTotal, (plannerPaidCents || 0) / 100);

  // ⚠️ IMPORTANT:
  // We are NOT subtracting inviteDiscount here because that MUST happen
  // BEFORE tax + cc fee are computed (inside computeVenueTotal).
  //
  // For now, computeVenueTotal is still returning a single number (with fees baked in),
  // so subtracting here would NOT reduce tax/fees correctly.
  //
  // After we update computeVenueTotal, grossTotal will already reflect the discounted venue total.
  const total = Math.max(0, grossTotal - plannerCredit);

  const wedding = parseISO(weddingDate);
  const finalDue = subDays(wedding, 45);
  const within45 = isBefore(finalDue, today);

  // Compute venue-specific deposit (clamped by total)
  const venueDeposit = getVenueDeposit({
    venueSlug,
    guestCount,
    weddingDateISO: weddingDate,
    totalPrice: total,
  });

  const meta = {
    grossTotal,
    plannerCredit,

    // ✅ show discount intent right now in contract UI
    inviteDiscountDollars: Math.max(0, Number(inviteDiscountDollars || 0)),

    // ✅ if computeVenueTotal later returns a breakdown, expose it
    breakdown: typeof computed === "number" ? null : computed,
  };

  if (payFull || within45) {
    return {
      total,
      deposit: total,
      months: 0,
      monthly: 0,
      lastInstallment: 0,
      firstChargeOn: null as Date | null,
      finalDueDate: weddingDate,
      payInFullRequired: within45,
      meta,
    };
  }

  let months = Math.max(0, differenceInMonths(finalDue, today));
  if (months < 1) {
    return {
      total,
      deposit: total,
      months: 0,
      monthly: 0,
      lastInstallment: 0,
      firstChargeOn: null,
      finalDueDate: weddingDate,
      payInFullRequired: true,
      meta,
    };
  }

  const deposit = venueDeposit;
  const remainder = Math.max(0, total - deposit);
  const monthly = Math.floor((remainder / months) * 100) / 100; // round down
  const lastInstallment =
    Math.round((remainder - monthly * (months - 1)) * 100) / 100;

  return {
    total,
    deposit,
    months,
    monthly,
    lastInstallment,
    firstChargeOn: addMonths(today, 1),
    finalDueDate: finalDue.toISOString().slice(0, 10),
    payInFullRequired: false,
    meta,
  };
}