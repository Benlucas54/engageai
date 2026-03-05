"use client";

import { useState, useEffect, useCallback } from "react";
import type { AgentRun } from "@/lib/types";

export function useSyncStatus() {
  const [run, setRun] = useState<AgentRun | null>(null);

  const fetchStatus = useCallback(async () => {
    const res = await fetch("/api/agent-status");
    if (res.ok) {
      const data = await res.json();
      if (data) setRun(data as AgentRun);
    }
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
