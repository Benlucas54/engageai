"use client";

import Link from "next/link";
import { useSubscription } from "@/hooks/useSubscription";
import { PLANS, isUnlimited, USAGE_FIELD_LABELS, type PlanId } from "@/lib/plans";

const USAGE_FIELD_MAP: Record<string, string> = {
  ai_replies: "ai_replies_used",
  follower_messages: "follower_messages_used",
  comment_tags: "comment_tags_used",
  voice_analyses: "voice_analyses_used",
  voice_enhancements: "voice_enhancements_used",
  follower_analyses: "follower_analyses_used",
  profile_summaries: "profile_summaries_used",
};

function ProgressBar({ used, limit }: { used: number; limit: number }) {
  const unlimited = isUnlimited(limit);
  const pct = unlimited ? 0 : Math.min((used / limit) * 100, 100);
  const isHigh = !unlimited && pct >= 80;
  const isExhausted = !unlimited && pct >= 100;

  return (
    <div className="h-2 bg-border rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${
          isExhausted
            ? "bg-red-500"
            : isHigh
            ? "bg-amber-500"
            : "bg-content"
        }`}
        style={{ width: unlimited ? "0%" : `${pct}%` }}
      />
    </div>
  );
}

export default function UsagePage() {
  const { subscription, usage, limits, bonusAiReplies, isLoading } = useSubscription();

  const planId = (subscription?.plan_id || "free") as PlanId;
  const plan = PLANS[planId] || PLANS.free;

  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const periodStart = subscription?.current_period_start
    ? new Date(subscription.current_period_start).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
      })
    : null;

  return (
    <div>
      {/* Header */}
      <div className="mb-10">
        <Link
          href="/settings"
          className="inline-flex items-center gap-1 text-[12px] text-content-faint hover:text-content transition-colors no-underline mb-3"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Settings
        </Link>
        <h1 className="text-xl font-semibold text-content tracking-tight">Usage</h1>
        <p className="text-[13px] text-content-sub mt-1">
          Track your usage across AI features for the current billing period.
        </p>
      </div>

      {/* Plan summary */}
      <div className="bg-surface-card border border-border rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[13px] text-content font-medium">{plan.name} plan</span>
            {plan.price !== null && plan.price > 0 && (
              <span className="text-[12px] text-content-sub">
                {"\u00A3"}{plan.price}/mo
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {periodStart && periodEnd && (
              <span className="text-[11px] text-content-faint">
                {periodStart} — {periodEnd}
              </span>
            )}
            <a
              href="/pricing"
              className="text-[12px] text-content font-medium hover:underline"
            >
              {planId === "free" ? "Upgrade" : "Change plan"}
            </a>
          </div>
        </div>
      </div>

      {/* Usage grid */}
      {isLoading ? (
        <div className="text-[13px] text-content-sub">Loading usage data...</div>
      ) : !usage || !limits ? (
        <div className="text-[13px] text-content-sub">No usage data available.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Object.entries(USAGE_FIELD_LABELS).map(([key, label]) => {
            const usageKey = USAGE_FIELD_MAP[key] as keyof typeof usage;
            const limitKey = key as keyof typeof limits;
            const used = (usage[usageKey] as number) || 0;
            const planLimit = limits[limitKey] as number;
            const bonus = key === "ai_replies" ? bonusAiReplies : 0;
            const limit = isUnlimited(planLimit) ? planLimit : planLimit + bonus;
            const unlimited = isUnlimited(limit);
            const pct = unlimited ? 0 : limit > 0 ? Math.round((used / limit) * 100) : 0;
            const isExhausted = !unlimited && pct >= 100;
            const isHigh = !unlimited && pct >= 80;

            return (
              <div
                key={key}
                className={`bg-surface-card border rounded-xl p-5 ${
                  isExhausted
                    ? "border-red-200"
                    : isHigh
                    ? "border-amber-200"
                    : "border-border"
                }`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[13px] text-content font-medium">{label}</span>
                  {!unlimited && (
                    <span
                      className={`text-[11px] font-medium ${
                        isExhausted
                          ? "text-red-600"
                          : isHigh
                          ? "text-amber-600"
                          : "text-content-faint"
                      }`}
                    >
                      {pct}%
                    </span>
                  )}
                </div>
                <ProgressBar used={used} limit={limit} />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[12px] text-content-sub">
                    {used.toLocaleString()} used
                  </span>
                  <span className="text-[12px] text-content-faint">
                    {unlimited ? "Unlimited" : `${limit.toLocaleString()} limit`}
                    {bonus > 0 && (
                      <span className="text-[10px] ml-1">(+{bonus} bonus)</span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
