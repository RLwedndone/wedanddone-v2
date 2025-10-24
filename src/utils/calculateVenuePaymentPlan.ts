// src/utils/calculateVenuePaymentPlan.ts
import { differenceInMonths, parseISO, subMonths } from "date-fns";
import { venuePricing } from "../data/venuePricing";

export interface PaymentPlan {
  deposit: number;
  monthlyPayment: number;
  months: number;
  finalPaymentMonth: string;
}

export function calculateVenuePaymentPlan(
  venueSlug: string,
  totalCost: number,
  weddingDateISO: string,
  bookingDateISO: string = new Date().toISOString()
): PaymentPlan | null {
  const venue = venuePricing[venueSlug];
  if (!venue || !venue.deposit) return null;

  const deposit = venue.deposit;
  const remaining = totalCost - deposit;

  const weddingDate = parseISO(weddingDateISO);
  const paymentDeadline = subMonths(weddingDate, 1);
  const bookingDate = parseISO(bookingDateISO);

  const months = differenceInMonths(paymentDeadline, bookingDate);

  if (months <= 0) {
    // Wedding is too close, user must pay full amount now
    return {
      deposit: Math.round(totalCost * 100) / 100,
      monthlyPayment: 0,
      months: 0,
      finalPaymentMonth: "immediate",
    };
  }

  const monthlyPayment = remaining / months;

  return {
    deposit: Math.round(deposit * 100) / 100,
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    months,
    finalPaymentMonth: paymentDeadline.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    }),
  };
}