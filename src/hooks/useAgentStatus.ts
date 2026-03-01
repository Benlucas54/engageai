"use client";

import { useState, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import type { AgentRun } from "@/lib/types";

export function useAgentStatus() {
  const [run, setRun] = useState<AgentRun | null>(null);

  const fetchStatus = useCallback(async () => {
    const { data } = await getSupabase()
      .from("agent_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(1)
      .single();
    if (data) setRun(data as AgentRun);
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 60_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  return run;
}
