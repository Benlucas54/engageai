"use client";

import { useState, useEffect, useCallback } from "react";

export interface FollowerStats {
  today: number;
  week: number;
  month: number;
  total: number;
  dailyCounts: { date: string; count: number }[];
  actions: {
    dmsSentToday: number;
    commentsSentToday: number;
    dailyDmCap: number;
    dailyCommentCap: number;
  };
}

export function useFollowerStats() {
  const [stats, setStats] = useState<FollowerStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    const res = await fetch("/api/follower-stats");
    if (res.ok) {
      const data = await res.json();
      setStats(data as FollowerStats);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}
