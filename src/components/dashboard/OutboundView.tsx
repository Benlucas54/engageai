"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useOutboundPosts } from "@/hooks/useOutboundPosts";
import { useProfiles } from "@/hooks/useProfiles";
import { buildPlatformProfileMap } from "@/lib/profileLookup";
import { P_LABEL, ACTIVE_PLATFORMS } from "@/lib/constants";
import { Tag } from "@/components/ui/Tag";
import { Card } from "@/components/ui/Card";
import { OutboundPostCard } from "./OutboundPostCard";
import type { OutboundPost } from "@/lib/types";

type PlatformFilter = "all" | OutboundPost["platform"];

export function OutboundView() {
  const { posts, refetch } = useOutboundPosts();
  const { profiles } = useProfiles();
  const profileMap = useMemo(() => buildPlatformProfileMap(profiles), [profiles]);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [viewTab, setViewTab] = useState<"active" | "history">("active");


  const active = useMemo(() => {
    return posts
      .filter((p) => p.status !== "dismissed" && p.status !== "copied")
      .filter((p) => platformFilter === "all" || p.platform === platformFilter);
  }, [posts, platformFilter]);

  const history = useMemo(() => {
    return posts
      .filter((p) => p.status === "copied")
      .filter((p) => platformFilter === "all" || p.platform === platformFilter);
  }, [posts, platformFilter]);

  // Daily stats: count copied posts per day
  const dailyStats = useMemo(() => {
    const copied = posts.filter((p) => p.status === "copied" && p.generated_at);
    const counts = new Map<string, number>();
    for (const p of copied) {
      const day = new Date(p.generated_at!).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      });
      counts.set(day, (counts.get(day) || 0) + 1);
    }
    // Return last 7 days worth of data
    return Array.from(counts.entries())
      .slice(0, 7)
      .reverse();
  }, [posts]);

  const todayLabel = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  const todayCount = dailyStats.find(([d]) => d === todayLabel)?.[1] ?? 0;

  // Keep selectedIdx in bounds
  useEffect(() => {
    if (selectedIdx >= active.length) setSelectedIdx(Math.max(0, active.length - 1));
  }, [active.length, selectedIdx]);

  const handleUpdate = useCallback(() => {
    refetch();
  }, [refetch]);

  // Platform tabs
  const platformTabs: { key: PlatformFilter; label: string }[] = [
    { key: "all", label: "All" },
    ...Array.from(ACTIVE_PLATFORMS).map((p) => ({
      key: p as PlatformFilter,
      label: P_LABEL[p] || p,
    })),
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* Daily stats bar */}
      <Card>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <div className="text-[22px] font-semibold text-content leading-none">{todayCount}</div>
              <div className="text-[11px] text-content-faint mt-1">sent today</div>
            </div>
            <div className="w-px h-8 bg-border" />
            <div>
              <div className="text-[22px] font-semibold text-content leading-none">{history.length}</div>
              <div className="text-[11px] text-content-faint mt-1">total sent</div>
            </div>
          </div>
          {dailyStats.length > 0 && (
            <div className="flex items-end gap-1 h-8">
              {dailyStats.map(([day, count]) => {
                const max = Math.max(...dailyStats.map(([, c]) => c));
                const h = Math.max(4, (count / max) * 32);
                return (
                  <div key={day} className="flex flex-col items-center gap-0.5">
                    <div
                      className="w-5 rounded-sm bg-content/20"
                      style={{ height: `${h}px` }}
                      title={`${day}: ${count}`}
                    />
                    <span className="text-[9px] text-content-faint">{day.split(" ")[0]}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      {/* Active / History toggle + Platform filter tabs */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          <button
            onClick={() => setViewTab("active")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
              viewTab === "active"
                ? "bg-content text-white"
                : "bg-surface text-content-faint hover:text-content"
            }`}
          >
            Active{active.length > 0 ? ` (${active.length})` : ""}
          </button>
          <button
            onClick={() => setViewTab("history")}
            className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
              viewTab === "history"
                ? "bg-content text-white"
                : "bg-surface text-content-faint hover:text-content"
            }`}
          >
            History{history.length > 0 ? ` (${history.length})` : ""}
          </button>
        </div>
        <div className="flex gap-1">
          {platformTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setPlatformFilter(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
                platformFilter === tab.key
                  ? "bg-content text-white"
                  : "bg-surface text-content-faint hover:text-content"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {viewTab === "active" && (
        <>
          {/* Empty state */}
          {active.length === 0 && (
            <Card className="text-center py-[60px] px-6">
              <div className="text-[13px] text-content-faint">
                No outbound posts yet. Paste a URL above or use the extension overlay to capture posts.
              </div>
            </Card>
          )}

          {/* Post list */}
          {active.map((post, idx) => (
            <OutboundPostCard
              key={post.id}
              post={post}
              isSelected={idx === selectedIdx}
              profileBadge={profileMap?.get(post.platform) ?? null}
              onSelect={() => setSelectedIdx(idx)}
              onUpdate={handleUpdate}
              onDismiss={handleUpdate}
            />
          ))}
        </>
      )}

      {viewTab === "history" && (
        <>
          {history.length === 0 && (
            <Card className="text-center py-[60px] px-6">
              <div className="text-[13px] text-content-faint">
                No sent messages yet. Copy a generated comment to see it here.
              </div>
            </Card>
          )}

          {history.map((post) => (
            <Card key={post.id}>
              <div className="flex justify-between items-center mb-2">
                <div className="flex gap-1.5 items-center">
                  {post.post_author && (
                    <span className="text-[13px] font-medium text-content">
                      @{post.post_author}
                    </span>
                  )}
                  <Tag type={post.platform}>{P_LABEL[post.platform]}</Tag>
                  <Tag type={post.source}>{post.source === "extension" ? "Extension" : "Manual"}</Tag>
                </div>
                <span className="text-[11px] text-content-faint">
                  {post.generated_at
                    ? new Date(post.generated_at).toLocaleDateString("en-GB", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </span>
              </div>
              {post.post_caption && (
                <p className="text-sm text-content leading-[1.65] mb-1">
                  {post.post_caption.length > 150
                    ? post.post_caption.slice(0, 150) + "..."
                    : post.post_caption}
                </p>
              )}
              {post.generated_comment && (
                <p className="text-[13px] text-content-sub leading-[1.65] pl-3 border-l-2 border-border">
                  {post.generated_comment}
                </p>
              )}
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
