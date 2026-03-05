"use client";

import { useSubscription } from "@/hooks/useSubscription";
import { Card } from "@/components/ui/Card";
import { MiniLabel } from "@/components/ui/MiniLabel";
import { isUnlimited, USAGE_FIELD_LABELS } from "@/lib/plans";

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
    <div>
      <div className="flex items-center justify-between text-[11px] mb-1">
        <span className="text-content-sub">{used.toLocaleString()}</span>
        <span className="text-content-faint">
          {unlimited ? "Unlimited" : `/ ${limit.toLocaleString()}`}
        </span>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
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
    </div>
  );
}

export function UsageCard() {
  const { usage, limits, subscription, isLoading } = useSubscription();

  if (isLoading || !usage || !limits) return null;

  const periodEnd = subscription?.current_period_end
    ? new Date(subscription.current_period_end).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      })
    : null;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <MiniLabel>Usage this period</MiniLabel>
        {periodEnd && (
          <span className="text-[10px] text-content-faint">
            Resets {periodEnd}
          </span>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-4">
        {Object.entries(USAGE_FIELD_LABELS).map(([key, label]) => {
          const usageKey = USAGE_FIELD_MAP[key] as keyof typeof usage;
          const limitKey = key as keyof typeof limits;
          const used = (usage[usageKey] as number) || 0;
          const limit = limits[limitKey] as number;

          return (
            <div key={key}>
              <div className="text-[12px] text-content font-medium mb-1">{label}</div>
              <ProgressBar used={used} limit={limit} />
            </div>
          );
        })}
      </div>
    </Card>
  );
}
