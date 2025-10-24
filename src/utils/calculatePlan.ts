import { differenceInMonths, addMonths, subDays, parseISO, isBefore } from "date-fns";
import { computeVenueTotal } from "./computeVenueTotal";
import { getVenueDeposit } from "./getVenueDeposit";

export function calculatePlan({
  venueSlug,
  guestCount,
  weddingDate, // "YYYY-MM-DD"
  today = new Date(),
  payFull = false,
  plannerPaidCents = 0,        // 👈 NEW: pass planner payments (in cents)
}: {
  venueSlug: string;
  guestCount: number;
  weddingDate: string;
  today?: Date;
  payFull?: boolean;
  plannerPaidCents?: number;   // 👈 NEW
}) {
  const grossTotal = computeVenueTotal(venueSlug, guestCount, weddingDate);

  // Apply planner credit once, centrally (credit can exceed the tier; cap at total)
  const plannerCredit = Math.min(grossTotal, (plannerPaidCents || 0) / 100);
  const total = Math.max(0, grossTotal - plannerCredit);   // 👉 this is the number UI should show everywhere

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
      // Optional: expose the components if you want to show credit
      meta: { grossTotal, plannerCredit },
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
      meta: { grossTotal, plannerCredit },
    };
  }

  const deposit = venueDeposit;
  const remainder = Math.max(0, total - deposit);
  const monthly = Math.floor((remainder / months) * 100) / 100; // round down
  const lastInstallment = Math.round((remainder - monthly * (months - 1)) * 100) / 100;

  return {
    total,
    deposit,
    months,
    monthly,
    lastInstallment,
    firstChargeOn: addMonths(today, 1),
    finalDueDate: finalDue.toISOString().slice(0, 10),
    payInFullRequired: false,
    meta: { grossTotal, plannerCredit },
  };
}