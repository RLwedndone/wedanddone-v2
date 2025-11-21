// src/utils/pixiePurchaseTypes.ts

// High-level category so we can filter later
export type PixiePurchaseCategory = "pixie_purchase";

// More detailed “reason” for the Pixie Purchase
export type PixiePurchaseType =
  | "guest_count_increase"
  | "rush_edit"
  | "custom";

export interface PixiePurchase {
  // Unique id, e.g. "pp_1732149182000"
  id: string;

  // Optional internal type (guest_count_increase, rush_edit, etc.)
  type?: PixiePurchaseType;

  // What the user sees (“Guest Count Increase”, “Rush Edit”, etc.)
  label: string;

  // Optional extra details
  description?: string;

  // Dollar amount of the pixie purchase
  amount: number;

  // e.g. "usd"
  currency: string;

  // Payment status
  status: "pending" | "paid";

  // When the invoice was created (ms since epoch)
  createdAt: number;

  // When it was paid (ISO string) or null if unpaid
  paidAt: string | null;

  // High-level category used by the budget wand, etc.
  category: PixiePurchaseCategory;
}