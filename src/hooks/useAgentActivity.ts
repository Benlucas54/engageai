"use client";

import { useState, useEffect, useCallback } from "react";
import type { Comment } from "@/lib/types";

export interface ActivityItem {
  id: string;
  username: string;
  platform: string;
  status: "scanning" | "liked" | "replied" | "flagged";
  text: string;
  ts: string;
}

export function useAgentActivity() {
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const poll = useCallback(async () => {
    // Check if agent is running
    const statusRes = await fetch("/api/agent-status");
    if (!statusRes.ok) return;
    const run = await statusRes.json();
    const running = run?.status === "running";
    setIsRunning(running);

    if (!running && !run?.completed_at) return;

    // Get comments from the last 2 minutes (covers the current run)
    const since = run?.started_at || new Date(Date.now() - 120000).toISOString();
    const res = await fetch(`/api/comments`);
    if (!res.ok) return;
    const comments: Comment[] = await res.json();

    // Filter to comments synced during this run
    const runComments = comments.filter((c) => c.synced_at >= since);

    const activity: ActivityItem[] = runComments.map((c) => {
      const hasReply = c.replies?.some((r) => r.sent_at);
      const isApproved = c.replies?.some((r) => r.approved);
      const isFlagged = c.status === "flagged";

      let status: ActivityItem["status"];
      if (hasReply) status = "replied";
      else if (isApproved) status = "liked";
      else if (isFlagged) status = "flagged";
      else status = "scanning";

      return {
        id: c.id,
        username: c.username,
        platform: c.platform,
        status,
        text: c.comment_text.slice(0, 60),
        ts: c.synced_at,
      };
    });

    setItems(activity);
  }, []);

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 3000);
    return () => clearInterval(interval);
  }, [poll]);

  return { items, isRunning };
}
