// src/data/plannerTiers.ts

export interface PlannerTier {
    maxGuests: number;
    fee: number;
  }
  
  export const PLANNER_TIERS: PlannerTier[] = [
    { maxGuests: 100, fee: 1250 },
    { maxGuests: 150, fee: 1550 },
    { maxGuests: 200, fee: 1850 },
    // If anyone books above 200, charge the 200+ tier
  ];
  
  export function getPlannerTierForCount(guestCount: number): PlannerTier {
    return (
      PLANNER_TIERS.find(t => guestCount <= t.maxGuests) ??
      PLANNER_TIERS[PLANNER_TIERS.length - 1]
    );
  }
  
  /**
   * Compare two guest counts and return the *extra* fee owed
   * if the guest count bumps the couple into a higher tier.
   */
  export function plannerTierDelta(fromCount: number, toCount: number): number {
    const before = getPlannerTierForCount(fromCount).fee;
    const after = getPlannerTierForCount(toCount).fee;
    return Math.max(0, after - before);
  }