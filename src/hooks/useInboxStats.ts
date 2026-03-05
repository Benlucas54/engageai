"use client";

import { useMemo } from "react";
import { useComments } from "./useComments";

export function useInboxStats() {
  const { comments } = useComments();

  return useMemo(() => {
    const now = new Date();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayISO = todayStart.toISOString();

    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Pending suggestions: flagged/pending comments without a sent reply
    const pendingSuggestions = comments.filter((c) => {
      if (c.status !== "flagged" && c.status !== "pending") return false;
      if (c.replies?.some((r) => r.sent_at)) return false;
      if (c.replies?.some((r) => r.approved)) return false;
      return true;
    }).length;

    // Sent today: comments with a reply sent_at >= today
    const sentToday = comments.filter((c) =>
      c.replies?.some((r) => r.sent_at && r.sent_at >= todayISO)
    ).length;

    // Response rate (7-day rolling %): of comments in last 7 days, what % have a sent reply
    const last7DayComments = comments.filter(
      (c) => c.created_at >= sevenDaysAgo && c.status !== "hidden"
    );
    const last7DayReplied = last7DayComments.filter((c) =>
      c.replies?.some((r) => r.sent_at)
    );
    const responseRate7d =
      last7DayComments.length > 0
        ? Math.round((last7DayReplied.length / last7DayComments.length) * 100)
        : 0;

    // Average response time (hours): time between comment.created_at and reply.sent_at
    const responseTimes: number[] = [];
    for (const c of comments) {
      const sentReply = c.replies?.find((r) => r.sent_at);
      if (sentReply?.sent_at) {
        const commentTime = new Date(c.created_at).getTime();
        const replyTime = new Date(sentReply.sent_at).getTime();
        if (replyTime > commentTime) {
          responseTimes.push((replyTime - commentTime) / (1000 * 60 * 60));
        }
      }
    }
    const avgResponseTimeHours =
      responseTimes.length > 0
        ? Math.round(
            (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10
          ) / 10
        : 0;

    return {
      pendingSuggestions,
      sentToday,
      responseRate7d,
      avgResponseTimeHours,
    };
  }, [comments]);
}
