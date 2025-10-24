// src/utils/stripePromise.ts
import { loadStripe, Stripe } from "@stripe/stripe-js";

// Pull the publishable key from env. If it's missing (staging), don't crash.
const pk = import.meta.env.VITE_STRIPE_PK;

export const stripePromise: Promise<Stripe | null> = pk
  ? loadStripe(pk)
  : Promise.resolve<Stripe | null>(null);