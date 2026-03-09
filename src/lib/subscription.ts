import { createServerClient } from "@/lib/supabase-server";
import { getPlan, isUnlimited, type PlanId, type PlanLimits, type PlanFeatures, type UsageField } from "@/lib/plans";
import { createServerClient as createSupabaseSSRClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export interface Subscription {
  plan_id: PlanId;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  bonus_ai_replies: number;
}

export interface UsageData {
  ai_replies_used: number;
  follower_messages_used: number;
  comment_tags_used: number;
  voice_analyses_used: number;
  voice_enhancements_used: number;
  follower_analyses_used: number;
  profile_summaries_used: number;
}

const DEFAULT_SUBSCRIPTION: Subscription = {
  plan_id: "free",
  status: "active",
  current_period_start: new Date().toISOString(),
  current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  cancel_at_period_end: false,
  stripe_customer_id: null,
  stripe_subscription_id: null,
  bonus_ai_replies: 0,
};

const EMPTY_USAGE: UsageData = {
  ai_replies_used: 0,
  follower_messages_used: 0,
  comment_tags_used: 0,
  voice_analyses_used: 0,
  voice_enhancements_used: 0,
  follower_analyses_used: 0,
  profile_summaries_used: 0,
};

// Map usage field names to DB column names
const USAGE_DB_COLUMNS: Record<UsageField, keyof UsageData> = {
  ai_replies: "ai_replies_used",
  follower_messages: "follower_messages_used",
  comment_tags: "comment_tags_used",
  voice_analyses: "voice_analyses_used",
  voice_enhancements: "voice_enhancements_used",
  follower_analyses: "follower_analyses_used",
  profile_summaries: "profile_summaries_used",
};

export async function getSubscription(userId: string): Promise<Subscription> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (!data) return DEFAULT_SUBSCRIPTION;

  return {
    plan_id: data.plan_id as PlanId,
    status: data.status,
    current_period_start: data.current_period_start,
    current_period_end: data.current_period_end,
    cancel_at_period_end: data.cancel_at_period_end,
    stripe_customer_id: data.stripe_customer_id,
    stripe_subscription_id: data.stripe_subscription_id,
    bonus_ai_replies: data.bonus_ai_replies ?? 0,
  };
}

export async function getUsage(userId: string, periodStart: string): Promise<UsageData> {
  const supabase = createServerClient();
  const { data } = await supabase
    .from("usage_tracking")
    .select("*")
    .eq("user_id", userId)
    .eq("period_start", periodStart)
    .single();

  if (!data) return EMPTY_USAGE;

  return {
    ai_replies_used: data.ai_replies_used || 0,
    follower_messages_used: data.follower_messages_used || 0,
    comment_tags_used: data.comment_tags_used || 0,
    voice_analyses_used: data.voice_analyses_used || 0,
    voice_enhancements_used: data.voice_enhancements_used || 0,
    follower_analyses_used: data.follower_analyses_used || 0,
    profile_summaries_used: data.profile_summaries_used || 0,
  };
}

export async function incrementUsage(
  userId: string,
  field: UsageField,
  periodStart: string,
  periodEnd: string,
  amount: number = 1
): Promise<void> {
  const supabase = createServerClient();
  const dbColumn = USAGE_DB_COLUMNS[field];

  await supabase.rpc("increment_usage", {
    p_user_id: userId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_field: dbColumn,
    p_amount: amount,
  });
}

export async function decrementBonusAiReplies(userId: string, amount: number): Promise<number> {
  const supabase = createServerClient();
  const { data, error } = await supabase.rpc("decrement_bonus_ai_replies", {
    p_user_id: userId,
    p_amount: amount,
  });
  if (error) {
    console.error("[subscription] Failed to decrement bonus:", error);
    return 0;
  }
  return data ?? 0;
}

export interface UsageGateResult {
  allowed: boolean;
  error?: string;
  status?: number;
  current?: number;
  limit?: number;
}

export async function withUsageGating(
  userId: string,
  usageField: UsageField,
  amount: number = 1
): Promise<UsageGateResult> {
  const subscription = await getSubscription(userId);

  // Check if subscription is active
  if (subscription.status !== "active" && subscription.status !== "trialing") {
    return {
      allowed: false,
      error: "Your subscription is not active. Please update your billing.",
      status: 402,
    };
  }

  const plan = getPlan(subscription.plan_id);
  const planLimit = plan.limits[usageField];

  // Unlimited plan
  if (isUnlimited(planLimit)) {
    await incrementUsage(userId, usageField, subscription.current_period_start, subscription.current_period_end, amount);
    return { allowed: true };
  }

  // For ai_replies, include bonus credits in effective limit
  const bonus = usageField === "ai_replies" ? subscription.bonus_ai_replies : 0;
  const effectiveLimit = planLimit + bonus;

  const usage = await getUsage(userId, subscription.current_period_start);
  const dbColumn = USAGE_DB_COLUMNS[usageField];
  const current = usage[dbColumn];

  if (current + amount > effectiveLimit) {
    return {
      allowed: false,
      error: `You've reached your ${plan.name} plan limit for this feature. Upgrade for more.`,
      status: 429,
      current,
      limit: effectiveLimit,
    };
  }

  await incrementUsage(userId, usageField, subscription.current_period_start, subscription.current_period_end, amount);

  // If usage crosses the plan limit, decrement bonus credits
  const newTotal = current + amount;
  if (usageField === "ai_replies" && bonus > 0 && newTotal > planLimit) {
    const bonusUsed = Math.max(0, newTotal - Math.max(current, planLimit));
    if (bonusUsed > 0) {
      await decrementBonusAiReplies(userId, bonusUsed);
    }
  }

  return { allowed: true, current: newTotal, limit: effectiveLimit };
}

export function checkFeatureAccess(planId: PlanId, feature: keyof PlanFeatures): boolean {
  const plan = getPlan(planId);
  return plan.features[feature];
}

export function getLimits(planId: PlanId): PlanLimits {
  return getPlan(planId).limits;
}

export function getFeatures(planId: PlanId): PlanFeatures {
  return getPlan(planId).features;
}

/**
 * Get the user ID from a Next.js request.
 * Checks Supabase session cookie first, then Authorization header.
 */
export async function getUserFromRequest(req: Request): Promise<string | null> {
  // 1. Try Authorization header (extension calls)
  const authHeader = req.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const supabase = createServerClient();
    const { data } = await supabase.auth.getUser(token);
    if (data?.user) return data.user.id;
  }

  // 2. Try Supabase session cookie (dashboard calls)
  try {
    const cookieStore = await cookies();
    const supabase = createSupabaseSSRClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll() {
            // Read-only in API routes
          },
        },
      }
    );
    const { data } = await supabase.auth.getUser();
    if (data?.user) return data.user.id;
  } catch {
    // cookies() may not be available in all contexts
  }

  return null;
}
