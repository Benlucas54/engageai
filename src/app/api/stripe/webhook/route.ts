import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createServerClient } from "@/lib/supabase-server";
import { PLANS, type PlanId } from "@/lib/plans";
import Stripe from "stripe";

export const dynamic = "force-dynamic";

// Disable body parsing — Stripe needs raw body for signature verification
export const runtime = "nodejs";

function planIdFromPriceId(priceId: string): PlanId {
  for (const plan of Object.values(PLANS)) {
    if (plan.stripePriceId && plan.stripePriceId === priceId) {
      return plan.id;
    }
  }
  // Check env vars directly as fallback
  if (priceId === process.env.STRIPE_BASIC_PRICE_ID) return "basic";
  if (priceId === process.env.STRIPE_PRO_PRICE_ID) return "pro";
  return "free";
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function upsertSubscription(
  supabase: ReturnType<typeof createServerClient>,
  userId: string,
  stripeSubscription: Stripe.Subscription,
  customerId: string
) {
  const priceId = stripeSubscription.items.data[0]?.price?.id || "";
  const planId = planIdFromPriceId(priceId);

  // In newer Stripe API versions, current_period fields may be on the raw object
  // but not in the TypeScript types. Use start_date + 30 days as fallback.
  const raw = stripeSubscription as unknown as Record<string, unknown>;
  const periodStart = typeof raw.current_period_start === "number"
    ? new Date(raw.current_period_start * 1000).toISOString()
    : new Date(stripeSubscription.start_date * 1000).toISOString();
  const periodEnd = typeof raw.current_period_end === "number"
    ? new Date(raw.current_period_end * 1000).toISOString()
    : new Date((stripeSubscription.start_date + 30 * 24 * 60 * 60) * 1000).toISOString();

  await supabase.from("subscriptions").upsert(
    {
      user_id: userId,
      stripe_customer_id: customerId,
      stripe_subscription_id: stripeSubscription.id,
      stripe_price_id: priceId,
      plan_id: planId,
      status: stripeSubscription.status,
      current_period_start: periodStart,
      current_period_end: periodEnd,
      cancel_at_period_end: stripeSubscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

async function getUserIdFromCustomer(
  supabase: ReturnType<typeof createServerClient>,
  customerId: string
): Promise<string | null> {
  // Check subscriptions table first
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("user_id")
    .eq("stripe_customer_id", customerId)
    .single();
  if (sub?.user_id) return sub.user_id;

  // Check Stripe customer metadata
  const stripe = getStripe();
  const customer = await stripe.customers.retrieve(customerId);
  if (!customer.deleted && customer.metadata?.supabase_user_id) {
    return customer.metadata.supabase_user_id;
  }

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[stripe/webhook] Missing STRIPE_WEBHOOK_SECRET");
      return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
    }

    const stripe = getStripe();
    let event: Stripe.Event;

    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error("[stripe/webhook] Signature verification failed:", err);
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const supabase = createServerClient();

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === "subscription" && session.subscription && session.customer) {
          const customerId = typeof session.customer === "string" ? session.customer : session.customer.id;
          const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;

          const userId = session.metadata?.supabase_user_id ||
            await getUserIdFromCustomer(supabase, customerId);

          if (userId) {
            const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
            await upsertSubscription(supabase, userId, stripeSubscription, customerId);
          }
        }
        break;
      }

      case "customer.subscription.created":
      case "customer.subscription.updated": {
        const stripeSubscription = event.data.object as Stripe.Subscription;
        const customerId = typeof stripeSubscription.customer === "string"
          ? stripeSubscription.customer
          : stripeSubscription.customer.id;

        const userId = await getUserIdFromCustomer(supabase, customerId);
        if (userId) {
          await upsertSubscription(supabase, userId, stripeSubscription, customerId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const stripeSubscription = event.data.object as Stripe.Subscription;
        const customerId = typeof stripeSubscription.customer === "string"
          ? stripeSubscription.customer
          : stripeSubscription.customer.id;

        const userId = await getUserIdFromCustomer(supabase, customerId);
        if (userId) {
          await supabase.from("subscriptions").update({
            plan_id: "free",
            status: "canceled",
            stripe_subscription_id: null,
            stripe_price_id: null,
            cancel_at_period_end: false,
            updated_at: new Date().toISOString(),
          }).eq("user_id", userId);
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;

        if (customerId) {
          const userId = await getUserIdFromCustomer(supabase, customerId);
          if (userId) {
            await supabase.from("subscriptions").update({
              status: "past_due",
              updated_at: new Date().toISOString(),
            }).eq("user_id", userId);
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = typeof invoice.customer === "string"
          ? invoice.customer
          : invoice.customer?.id;

        // Get subscription ID from parent.subscription_details (clover API)
        const subDetails = invoice.parent?.type === "subscription_details"
          ? invoice.parent.subscription_details
          : null;
        const invoiceSubscription = subDetails?.subscription;

        if (customerId && invoiceSubscription) {
          const userId = await getUserIdFromCustomer(supabase, customerId);
          if (userId) {
            const subscriptionId = typeof invoiceSubscription === "string"
              ? invoiceSubscription
              : invoiceSubscription.id;
            const stripeSubscription = await stripe.subscriptions.retrieve(subscriptionId);
            await upsertSubscription(supabase, userId, stripeSubscription, customerId);
          }
        }
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[stripe/webhook] Error:", err);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}
