"use client";

import { useState, useEffect, useCallback } from "react";
import type { PlanId, PlanLimits, PlanFeatures } from "@/lib/plans";

interface SubscriptionInfo {
  plan_id: PlanId;
  status: string;
  current_period_start: string;
  current_period_end: string;
  cancel_at_period_end: boolean;
}

interface UsageData {
  ai_replies_used: number;
  follower_messages_used: number;
  comment_tags_used: number;
  voice_analyses_used: number;
  voice_enhancements_used: number;
  follower_analyses_used: number;
  profile_summaries_used: number;
}

interface UseSubscriptionReturn {
  subscription: SubscriptionInfo | null;
  usage: UsageData | null;
  limits: PlanLimits | null;
  features: PlanFeatures | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [limits, setLimits] = useState<PlanLimits | null>(null);
  const [features, setFeatures] = useState<PlanFeatures | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const res = await fetch("/api/usage");
      if (!res.ok) {
        if (res.status === 401) {
          setError("Not authenticated");
          return;
        }
        throw new Error("Failed to fetch usage data");
      }
      const data = await res.json();
      setSubscription(data.subscription);
      setUsage(data.usage);
      setLimits(data.limits);
      setFeatures(data.features);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { subscription, usage, limits, features, isLoading, error, refetch: fetchData };
}
