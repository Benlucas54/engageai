import Stripe from "stripe";

let stripeInstance: Stripe | null = null;

export function getStripe(): Stripe {
  if (!stripeInstance) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("Missing STRIPE_SECRET_KEY env var");
    }
    stripeInstance = new Stripe(key, {
      apiVersion: "2026-02-25.clover",
    });
  }
  return stripeInstance;
}
