"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { useLayout } from "@/contexts/LayoutContext";
import { useComments } from "@/hooks/useComments";
import { useFollowerStats } from "@/hooks/useFollowerStats";
import { useSmartTags } from "@/hooks/useSmartTags";
import { useProfiles } from "@/hooks/useProfiles";
import { ACTIVE_PLATFORMS, P_LABEL } from "@/lib/constants";
import { timeAgo } from "@/utils/timeAgo";
import { Tag } from "@/components/ui/Tag";
import { SmartTagBadge } from "@/components/ui/SmartTagBadge";
import { Btn } from "@/components/ui/Btn";
import { Card } from "@/components/ui/Card";
import { MiniLabel } from "@/components/ui/MiniLabel";
import { Divider } from "@/components/ui/Divider";

export function OverviewView() {
  const { setWide } = useLayout();
  const { comments } = useComments();
  const { stats: followerStats } = useFollowerStats();
  const { enabledTags, tagPriority } = useSmartTags();
  const { profiles } = useProfiles();

  useEffect(() => {
    setWide(true);
    return () => setWide(false);
  }, [setWide]);

  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

  const selectedProfile = useMemo(
    () => profiles.find((p) => p.id === selectedProfileId) ?? null,
    [profiles, selectedProfileId]
  );

  const availablePlatforms = useMemo(() => {
    const enabledAccounts = selectedProfile
      ? selectedProfile.linked_accounts.filter((a) => a.enabled)
      : profiles.flatMap((p) => p.linked_accounts.filter((a) => a.enabled));
    const platformSet = new Set<string>(enabledAccounts.map((a) => a.platform));
    return [...ACTIVE_PLATFORMS].filter((p) => platformSet.has(p));
  }, [profiles, selectedProfile]);

  // Reset platform filter when it's no longer available
  useEffect(() => {
    if (selectedPlatform && !availablePlatforms.includes(selectedPlatform)) {
      setSelectedPlatform(null);
    }
  }, [availablePlatforms, selectedPlatform]);

  const filteredComments = useMemo(() => {
    const platformSet = new Set(availablePlatforms);
    return comments.filter((c) => {
      if (!platformSet.has(c.platform)) return false;
      if (selectedPlatform && c.platform !== selectedPlatform) return false;
      return true;
    });
  }, [comments, availablePlatforms, selectedPlatform]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();
  const todayComments = useMemo(
    () => filteredComments.filter((c) => c.synced_at >= todayISO || c.created_at >= todayISO),
    [filteredComments, todayISO]
  );

  // Inline inbox stats from filteredComments
  const inboxStats = useMemo(() => {
    const now = new Date();
    const tStart = new Date();
    tStart.setHours(0, 0, 0, 0);
    const tISO = tStart.toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const pendingSuggestions = filteredComments.filter((c) => {
      if (c.status !== "flagged" && c.status !== "pending") return false;
      if (c.replies?.some((r) => r.sent_at)) return false;
      if (c.replies?.some((r) => r.approved)) return false;
      return true;
    }).length;

    const sentToday = filteredComments.filter((c) =>
      c.replies?.some((r) => r.sent_at && r.sent_at >= tISO)
    ).length;

    const last7DayComments = filteredComments.filter(
      (c) => c.created_at >= sevenDaysAgo && c.status !== "hidden"
    );
    const last7DayReplied = last7DayComments.filter((c) =>
      c.replies?.some((r) => r.sent_at)
    );
    const responseRate7d =
      last7DayComments.length > 0
        ? Math.round((last7DayReplied.length / last7DayComments.length) * 100)
        : 0;

    const responseTimes: number[] = [];
    for (const c of filteredComments) {
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

    return { pendingSuggestions, sentToday, responseRate7d, avgResponseTimeHours };
  }, [filteredComments]);

  // Platform breakdown from today's filtered comments
  const platformBreakdown = useMemo(() => {
    return availablePlatforms.map((p) => {
      const total = todayComments.filter((c) => c.platform === p).length;
      const replied = todayComments.filter(
        (c) => c.platform === p && c.replies?.some((r) => r.sent_at)
      ).length;
      const pending = todayComments.filter(
        (c) => c.platform === p && (c.status === "flagged" || c.status === "pending") && !c.replies?.some((r) => r.sent_at)
      ).length;
      return { p, total, replied, pending };
    });
  }, [availablePlatforms, todayComments]);

  // Platform comment counts for badges
  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const platformSet = new Set(availablePlatforms);
    for (const c of comments) {
      if (platformSet.has(c.platform)) {
        counts[c.platform] = (counts[c.platform] || 0) + 1;
      }
    }
    return counts;
  }, [comments, availablePlatforms]);

  // Tag distribution for today's comments
  const tagDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tag of enabledTags) counts[tag.key] = 0;
    for (const c of todayComments) {
      if (c.smart_tag) counts[c.smart_tag] = (counts[c.smart_tag] || 0) + 1;
    }
    const maxCount = Math.max(...Object.values(counts), 1);
    return enabledTags.map((t) => ({
      tag: t.key,
      count: counts[t.key] || 0,
      pct: (counts[t.key] || 0) / maxCount,
    }));
  }, [todayComments, enabledTags]);

  const hasTagData = tagDistribution.some((t) => t.count > 0);

  // Priority queue: top 5 unactioned comments sorted by tag priority
  const priorityQueue = useMemo(() => {
    return filteredComments
      .filter((c) => {
        if (c.status !== "flagged" && c.status !== "pending") return false;
        if (c.replies?.some((r) => r.sent_at)) return false;
        if (c.replies?.some((r) => r.approved)) return false;
        return true;
      })
      .sort((a, b) => {
        const pa = a.smart_tag ? tagPriority(a.smart_tag) : 0;
        const pb = b.smart_tag ? tagPriority(b.smart_tag) : 0;
        return pb - pa;
      })
      .slice(0, 5);
  }, [filteredComments, tagPriority]);

  // Recent replies: last 5 user-sent replies
  const recentReplies = useMemo(() => {
    return filteredComments
      .filter((c) => c.replies?.some((r) => r.sent_at))
      .sort((a, b) => {
        const aTime = a.replies?.find((r) => r.sent_at)?.sent_at || "";
        const bTime = b.replies?.find((r) => r.sent_at)?.sent_at || "";
        return bTime.localeCompare(aTime);
      })
      .slice(0, 5);
  }, [filteredComments]);

  const pillClass = (isActive: boolean) =>
    `px-3.5 py-1.5 rounded-full border text-xs font-medium cursor-pointer font-sans capitalize tracking-[0.02em] ${
      isActive
        ? "border-content bg-content text-white"
        : "border-border bg-surface-card text-content-sub"
    }`;

  return (
    <div className="flex flex-col gap-3.5">

      {/* Filter bar */}
      <div className="flex flex-col gap-2">
        {/* Profile selector (only if multiple profiles) */}
        {profiles.length > 1 && (
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setSelectedProfileId(null)}
              className={pillClass(selectedProfileId === null)}
            >
              All profiles
            </button>
            {profiles.map((profile) => (
              <button
                key={profile.id}
                onClick={() => setSelectedProfileId(profile.id)}
                className={pillClass(selectedProfileId === profile.id)}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className="inline-block w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: profile.color }}
                  />
                  {profile.name}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Platform pills */}
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setSelectedPlatform(null)}
            className={pillClass(selectedPlatform === null)}
          >
            All
          </button>
          {availablePlatforms.map((p) => (
            <button
              key={p}
              onClick={() => setSelectedPlatform(p)}
              className={pillClass(selectedPlatform === p)}
            >
              {P_LABEL[p] || p}
              {(platformCounts[p] || 0) > 0 && (
                <span className="ml-1 opacity-60">{platformCounts[p]}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2.5">
        {[
          { label: "Pending suggestions", val: inboxStats.pendingSuggestions, tag: "flagged" as const },
          { label: "Sent today", val: inboxStats.sentToday, tag: "replied" as const },
          { label: "Response rate", val: `${inboxStats.responseRate7d}%`, tag: null, sub: "7-day rolling" },
          { label: "Avg response time", val: inboxStats.avgResponseTimeHours > 0 ? `${inboxStats.avgResponseTimeHours}h` : "\u2014", tag: null, sub: "hours" },
        ].map(({ label, val, tag, sub }) => (
          <Card key={label}>
            <MiniLabel>{label}</MiniLabel>
            <div className="my-2.5 text-3xl font-light tracking-[-0.03em] text-content font-display leading-none">
              {val}
            </div>
            {tag && (
              <Tag type={tag}>
                {tag === "replied" ? "User-sent" : "Needs reply"}
              </Tag>
            )}
            {sub && (
              <span className="text-[11px] text-content-faint">{sub}</span>
            )}
          </Card>
        ))}
      </div>

      {/* Two-column grid for mid-section on desktop */}
      <div className={`grid grid-cols-1 ${followerStats && followerStats.total > 0 ? "lg:grid-cols-2" : ""} gap-3.5`}>
        {/* Left column */}
        <div className="flex flex-col gap-3.5">
          {/* Platform breakdown */}
          <Card>
            <MiniLabel>Platform breakdown</MiniLabel>
            <div className="mt-5 flex flex-col gap-[18px]">
              {platformBreakdown.map(({ p, total, replied, pending }) => (
                <div key={p}>
                  <div className="flex justify-between items-center mb-2">
                    <Tag type={p}>{P_LABEL[p]}</Tag>
                    <div className="flex gap-3 text-xs text-content-faint">
                      <span>{replied} / {total} replied</span>
                      {pending > 0 && (
                        <span className="text-tag-flagged-text">{pending} pending</span>
                      )}
                    </div>
                  </div>
                  <div className="h-[3px] bg-border-light rounded-[3px]">
                    <div
                      className="h-full bg-content rounded-[3px]"
                      style={{
                        width: total > 0 ? `${(replied / total) * 100}%` : "0%",
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* Comment types today */}
          {hasTagData && (
            <Card>
              <MiniLabel>Comment types today</MiniLabel>
              <div className="mt-5 flex flex-col gap-[18px]">
                {tagDistribution.map(({ tag, count, pct }) => (
                  <div key={tag}>
                    <div className="flex justify-between items-center mb-2">
                      <SmartTagBadge tagKey={tag} />
                      <span className="text-xs text-content-faint">{count}</span>
                    </div>
                    <div className="h-[3px] bg-border-light rounded-[3px]">
                      <div
                        className="h-full bg-content rounded-[3px]"
                        style={{ width: `${pct * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-3.5">
          {/* Follower growth */}
          {followerStats && followerStats.total > 0 && (
            <>
              <Card>
                <MiniLabel>New followers</MiniLabel>
                <div className="my-2.5 text-4xl font-light tracking-[-0.03em] text-content font-display leading-none">
                  {followerStats.today}
                </div>
                <div className="text-[11px] text-content-faint">
                  {followerStats.week} this week · {followerStats.month} this month
                </div>
                {/* 7-day bar chart */}
                <div className="flex items-end gap-1 mt-3 h-[32px]">
                  {followerStats.dailyCounts.map((d) => {
                    const max = Math.max(...followerStats.dailyCounts.map((x) => x.count), 1);
                    const h = d.count > 0 ? Math.max((d.count / max) * 100, 8) : 4;
                    return (
                      <div
                        key={d.date}
                        className="flex-1 rounded-sm bg-content"
                        style={{ height: `${h}%`, opacity: d.count > 0 ? 1 : 0.15 }}
                        title={`${d.date}: ${d.count}`}
                      />
                    );
                  })}
                </div>
              </Card>
              <Card>
                <MiniLabel>Follower actions</MiniLabel>
                <div className="mt-3 flex flex-col gap-2">
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-content-sub">DMs sent today</span>
                      <span className="text-content-faint">
                        {followerStats.actions.dmsSentToday} / {followerStats.actions.dailyDmCap}
                      </span>
                    </div>
                    <div className="h-[3px] bg-border-light rounded-[3px]">
                      <div
                        className="h-full bg-content rounded-[3px]"
                        style={{
                          width: `${Math.min(
                            (followerStats.actions.dmsSentToday / followerStats.actions.dailyDmCap) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-content-sub">Comments sent today</span>
                      <span className="text-content-faint">
                        {followerStats.actions.commentsSentToday} / {followerStats.actions.dailyCommentCap}
                      </span>
                    </div>
                    <div className="h-[3px] bg-border-light rounded-[3px]">
                      <div
                        className="h-full bg-content rounded-[3px]"
                        style={{
                          width: `${Math.min(
                            (followerStats.actions.commentsSentToday / followerStats.actions.dailyCommentCap) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </Card>
            </>
          )}
        </div>
      </div>

      {/* Inbox nudge */}
      {inboxStats.pendingSuggestions > 0 && (
        <Link href="/inbox" className="no-underline">
          <Card className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <Tag type="flagged">Action needed</Tag>
              <div>
                <div className="text-[13px] text-content font-medium">
                  {inboxStats.pendingSuggestions} comments waiting for your reply
                </div>
                <div className="text-xs text-content-faint mt-0.5">
                  AI suggestions ready for review
                </div>
              </div>
            </div>
            <Btn variant="secondary" size="sm">
              Review →
            </Btn>
          </Card>
        </Link>
      )}

      {/* Priority queue + Recent replies side by side on desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
        {/* Priority queue */}
        {priorityQueue.length > 0 && (
          <Card>
            <MiniLabel>Priority queue</MiniLabel>
            <div className="mt-4">
              {priorityQueue.map((c, i) => (
                <div key={c.id}>
                  <div className="flex justify-between items-start py-3.5 gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex gap-1.5 items-center mb-[5px] flex-wrap">
                        <span className="text-xs text-content font-medium">
                          @{c.username}
                        </span>
                        <Tag type={c.platform}>{P_LABEL[c.platform]}</Tag>
                        {c.smart_tag && (
                          <SmartTagBadge tagKey={c.smart_tag} />
                        )}
                      </div>
                      <p className="m-0 text-[13px] text-content-sub leading-[1.6] whitespace-nowrap overflow-hidden text-ellipsis">
                        {c.comment_text}
                      </p>
                    </div>
                    <span className="text-[11px] text-content-faint shrink-0">
                      {timeAgo(c.created_at)}
                    </span>
                  </div>
                  {i < priorityQueue.length - 1 && <Divider />}
                </div>
              ))}
            </div>
            <div className="mt-4">
              <Link href="/inbox">
                <Btn variant="ghost" size="sm">
                  Review inbox →
                </Btn>
              </Link>
            </div>
          </Card>
        )}

        {/* Recent replies */}
        <Card>
          <MiniLabel>Recent replies</MiniLabel>
          <div className="mt-4">
            {recentReplies.length === 0 && (
              <p className="text-[13px] text-content-faint text-center py-6">
                No replies sent yet
              </p>
            )}
            {recentReplies.map((c, i) => (
              <div key={c.id}>
                <div className="flex justify-between items-start py-3.5 gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex gap-1.5 items-center mb-[5px] flex-wrap">
                      <span className="text-xs text-content font-medium">
                        @{c.username}
                      </span>
                      <Tag type={c.platform}>{P_LABEL[c.platform]}</Tag>
                      {c.smart_tag && (
                        <SmartTagBadge tagKey={c.smart_tag} />
                      )}
                    </div>
                    <p className="m-0 text-[13px] text-content-sub leading-[1.6] whitespace-nowrap overflow-hidden text-ellipsis">
                      {c.replies?.find((r) => r.sent_at)?.reply_text || c.comment_text}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <Tag type="replied">Sent</Tag>
                    <span className="text-[11px] text-content-faint">
                      {timeAgo(c.replies?.find((r) => r.sent_at)?.sent_at || c.created_at)}
                    </span>
                  </div>
                </div>
                {i < recentReplies.length - 1 && <Divider />}
              </div>
            ))}
          </div>
          <div className="mt-4">
            <Link href="/feed">
              <Btn variant="ghost" size="sm">
                View full feed →
              </Btn>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
