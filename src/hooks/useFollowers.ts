"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Follower, FollowerAction } from "@/lib/types";

export type FollowerWithActions = Follower & {
  follower_actions: FollowerAction[];
};

export function useFollowers() {
  const [followers, setFollowers] = useState<FollowerWithActions[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFollowers = useCallback(async () => {
    const res = await globalThis.fetch("/api/followers");
    if (res.ok) {
      const data = await res.json();
      if (data) setFollowers(data as FollowerWithActions[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFollowers();
    const supabase = getSupabase();
    const channel = supabase
      .channel("followers-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "followers" }, fetchFollowers)
      .on("postgres_changes", { event: "*", schema: "public", table: "follower_actions" }, fetchFollowers)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchFollowers]);

  return { followers, loading, refetch: fetchFollowers };
}
