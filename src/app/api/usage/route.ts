import { NextRequest, NextResponse } from "next/server";
import { getSubscription, getUsage, getUserFromRequest, getLimits, getFeatures } from "@/lib/subscription";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscription = await getSubscription(userId);
    const usage = await getUsage(userId, subscription.current_period_start);
    const limits = getLimits(subscription.plan_id);
    const features = getFeatures(subscription.plan_id);

    return NextResponse.json({
      subscription: {
        plan_id: subscription.plan_id,
        status: subscription.status,
        current_period_start: subscription.current_period_start,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
      },
      usage,
      limits,
      features,
    });
  } catch (err) {
    console.error("[usage] Error:", err);
    return NextResponse.json(
      { error: "Failed to get usage data" },
      { status: 500 }
    );
  }
}
