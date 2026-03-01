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
    // Poll every 5s while running, every 60s otherwise
    const ms = run?.status === "running" ? 5_000 : 60_000;
    const interval = setInterval(fetchStatus, ms);
    return () => clearInterval(interval);
  }, [fetchStatus, run?.status]);

  return run;
}
