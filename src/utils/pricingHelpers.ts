// src/utils/pricingHelpers.ts
import { plannerFeeForGuestCount } from "../data/venuePricing";

export function effectivePlannerFee(guestCount: number, alreadyHasPlanner: boolean): number {
  const safe = Math.max(0, Number(guestCount) || 0);
  return alreadyHasPlanner ? 0 : plannerFeeForGuestCount(safe);
}

export function clampGuestCount(n: number, max = 250): number {
  const v = Math.max(0, Math.floor(Number(n) || 0));
  return Math.min(v, max);
}