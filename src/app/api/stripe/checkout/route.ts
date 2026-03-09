import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { getSubscription, getUserFromRequest } from "@/lib/subscription";
import { createServerClient } from "@/lib/supabase-server";

export async function POST(req: NextRequest) {
  try {
    const userId = await getUserFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { planId } = (await req.json()) as { planId: string };

    const PRICE_MAP: Record<string, string | undefined> = {
      basic: process.env.STRIPE_BASIC_PRICE_ID,
      pro: process.env.STRIPE_PRO_PRICE_ID,
    };

    const priceId = PRICE_MAP[planId];
    if (!priceId) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 });
    }

    const stripe = getStripe();
    const supabase = createServerClient();

    // Get or create Stripe customer
    const subscription = await getSubscription(userId);
    let customerId = subscription.stripe_customer_id;

    if (!customerId) {
      // Look up user email
      const { data: userData } = await supabase.auth.admin.getUserById(userId);
      const email = userData?.user?.email;

      const customer = await stripe.customers.create({
        email: email || undefined,
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;

      // Upsert subscription row with customer ID
      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id: customerId,
          plan_id: "free",
          status: "active",
        },
        { onConflict: "user_id" }
      );
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL}/settings?billing=success`,
      cancel_url: `${req.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      metadata: { supabase_user_id: userId },
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/checkout] Error:", err);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
