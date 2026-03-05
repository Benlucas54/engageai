"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import { useFollowers } from "@/hooks/useFollowers";
import type { FollowerWithActions } from "@/hooks/useFollowers";
import { P_LABEL } from "@/lib/constants";
import { timeAgo } from "@/utils/timeAgo";
import { Tag } from "@/components/ui/Tag";
import { Btn } from "@/components/ui/Btn";
import { Card } from "@/components/ui/Card";
import { MiniLabel } from "@/components/ui/MiniLabel";
import { Divider } from "@/components/ui/Divider";
import type { FlaggedFollower } from "@/lib/types";

type PlatformFilter = "all" | "instagram" | "threads" | "tiktok";

function profileUrl(platform: string, username: string): string {
  if (platform === "instagram") return `https://www.instagram.com/${username}/`;
  if (platform === "threads") return `https://www.threads.net/@${username}`;
  if (platform === "tiktok") return `https://www.tiktok.com/@${username}`;
  return "#";
}

export function FollowerInboxView() {
  const { followers, refetch } = useFollowers();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [done, setDone] = useState<FlaggedFollower[]>([]);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);

  // Get followers that have pending actions (not yet sent or approved)
  const flagged: FlaggedFollower[] = useMemo(() => {
    return followers
      .filter((f) => f.status === "new")
      .filter((f) => {
        const actions = f.follower_actions || [];
        if (actions.length === 0) return true;
        return actions.some((a) => !a.sent_at && !a.approved);
      })
      .map((f) => {
        const action = f.follower_actions?.find((a) => !a.sent_at && !a.approved);
        return {
          ...f,
          draft: action?.draft_text || action?.message_text || "",
          actionId: action?.id,
          messageType: action?.message_type || "dm",
          actionRuleName: null,
        };
      });
  }, [followers]);

  // Platform counts for filter bar
  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = { instagram: 0, threads: 0, tiktok: 0 };
    for (const f of flagged) {
      counts[f.platform] = (counts[f.platform] || 0) + 1;
    }
    return counts;
  }, [flagged]);

  const getDraft = (f: FlaggedFollower) =>
    drafts[f.id] !== undefined ? drafts[f.id] : f.draft;

  const updateDraft = (id: string, val: string) =>
    setDrafts((p) => ({ ...p, [id]: val }));

  const approve = useCallback(async (f: FlaggedFollower) => {
    const draftText = getDraft(f);
    // Copy to clipboard
    try { await navigator.clipboard.writeText(draftText); } catch {}
    // Open profile link in new tab
    window.open(profileUrl(f.platform, f.username), "_blank");
    // Mark as approved
    if (f.actionId) {
      await getSupabase()
        .from("follower_actions")
        .update({
          draft_text: draftText,
          message_text: draftText,
          approved: true,
        } as never)
        .eq("id", f.actionId);
    }
    setCopied(f.id);
    setTimeout(() => setCopied(null), 2000);
    setDone((p) => [...p, f]);
    refetch();
  }, [drafts, refetch]);

  const dismiss = useCallback(async (f: FlaggedFollower) => {
    await getSupabase()
      .from("followers")
      .update({ status: "dismissed" } as never)
      .eq("id", f.id);
    refetch();
  }, [refetch]);

  const regenerate = useCallback(async (f: FlaggedFollower) => {
    setRegenerating((p) => ({ ...p, [f.id]: true }));
    try {
      const res = await fetch("/api/generate-follower-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          follower: { username: f.username, bio: f.bio, platform: f.platform },
          messageType: f.messageType,
        }),
      });
      const data = await res.json();
      if (data.message) {
        updateDraft(f.id, data.message);
        if (f.actionId) {
          await getSupabase()
            .from("follower_actions")
            .update({ draft_text: data.message, message_text: data.message } as never)
            .eq("id", f.actionId);
        }
      }
    } catch {
      // Silently fail
    } finally {
      setRegenerating((p) => ({ ...p, [f.id]: false }));
    }
  }, []);

  const active = useMemo(() => {
    let items = flagged.filter((f) => !done.find((d) => d.id === f.id));
    if (platformFilter !== "all") {
      items = items.filter((f) => f.platform === platformFilter);
    }
    return items;
  }, [flagged, done, platformFilter]);

  // Keep selectedIdx in bounds
  useEffect(() => {
    if (selectedIdx >= active.length) setSelectedIdx(Math.max(0, active.length - 1));
  }, [active.length, selectedIdx]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      const f = active[selectedIdx];
      if (!f) return;

      if (e.key === "Enter") {
        e.preventDefault();
        approve(f);
      } else if (e.key === "Escape" || e.key === "d") {
        e.preventDefault();
        dismiss(f);
      } else if (e.key === "Tab") {
        e.preventDefault();
        setSelectedIdx((i) => (i + 1) % active.length);
      } else if (e.key === "r" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        regenerate(f);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [active, selectedIdx, approve, dismiss, regenerate]);

  const platforms = (["instagram", "threads", "tiktok"] as const).filter(
    (p) => platformCounts[p] > 0
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Keyboard hint */}
      {active.length > 0 && (
        <div className="text-[10px] text-content-faint flex gap-3">
          <span><kbd className="px-1 py-0.5 bg-surface border border-border rounded text-[9px]">Enter</kbd> Send</span>
          <span><kbd className="px-1 py-0.5 bg-surface border border-border rounded text-[9px]">d</kbd> Dismiss</span>
          <span><kbd className="px-1 py-0.5 bg-surface border border-border rounded text-[9px]">Tab</kbd> Next</span>
          <span><kbd className="px-1 py-0.5 bg-surface border border-border rounded text-[9px]">r</kbd> Regenerate</span>
        </div>
      )}

      {/* Platform filter bar */}
      {platforms.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {platforms.map((p) => {
            const isActive = platformFilter === p;
            return (
              <button
                key={p}
                onClick={() =>
                  setPlatformFilter(platformFilter === p ? "all" : p)
                }
                className={`inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-full text-[11px] font-medium border cursor-pointer transition-opacity ${
                  isActive
                    ? "opacity-100"
                    : platformFilter !== "all"
                    ? "opacity-40"
                    : "opacity-100"
                }`}
                style={{ background: "transparent" }}
              >
                <Tag type={p}>{P_LABEL[p]}</Tag>
                <span className="text-[10px] text-content-faint">
                  {platformCounts[p]}
                </span>
              </button>
            );
          })}
          {platformFilter !== "all" && (
            <button
              onClick={() => setPlatformFilter("all")}
              className="text-[11px] text-content-faint hover:text-content cursor-pointer bg-transparent border-none px-2 py-1"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {active.length === 0 && done.length === 0 && (
        <Card className="text-center py-[60px] px-6">
          <div className="text-[13px] text-content-faint">
            No new followers to action — check back later.
          </div>
        </Card>
      )}

      {active.map((f, idx) => {
        const isSelected = idx === selectedIdx;
        return (
          <Card
            key={f.id}
            className={isSelected ? "ring-1 ring-content/20" : ""}
            onClick={() => setSelectedIdx(idx)}
          >
            <div className="flex justify-between items-center mb-3.5">
              <div className="flex gap-1.5 items-center">
                <span className="text-[13px] font-medium text-content">
                  @{f.username}
                </span>
                <Tag type={f.platform}>{P_LABEL[f.platform]}</Tag>
                <Tag type={f.messageType}>
                  {f.messageType === "dm" ? "DM" : "Comment"}
                </Tag>
                <Tag type="new">New follower</Tag>
              </div>
              <span className="text-[11px] text-content-faint">
                {timeAgo(f.first_seen_at)}
              </span>
            </div>

            {/* Profile info */}
            <div className="flex gap-4 mb-4 text-[11px] text-content-sub">
              {f.follower_count != null && (
                <span>{f.follower_count.toLocaleString()} followers</span>
              )}
              {f.following_count != null && (
                <span>{f.following_count.toLocaleString()} following</span>
              )}
              {f.post_count != null && (
                <span>{f.post_count.toLocaleString()} posts</span>
              )}
            </div>

            {f.bio && (
              <p className="mb-4 text-xs text-content-sub italic leading-[1.65]">
                {f.bio}
              </p>
            )}

            {f.display_name && (
              <p className="mb-3 text-sm text-content leading-[1.65]">
                {f.display_name}
              </p>
            )}

            <div className="mb-4">
              <MiniLabel>
                Draft {f.messageType === "dm" ? "DM" : "comment"}
              </MiniLabel>
              <textarea
                value={getDraft(f)}
                onChange={(e) => updateDraft(f.id, e.target.value)}
                rows={3}
                className="mt-2 w-full bg-surface border border-border rounded-[7px] px-3.5 py-[11px] text-content text-[13px] leading-[1.65] resize-y font-sans outline-none focus:border-content"
              />
            </div>

            <div className="flex gap-2 items-center">
              <Btn onClick={() => approve(f)}>
                {copied === f.id ? "Copied!" : `Copy & open`}
              </Btn>
              <Btn
                variant="secondary"
                onClick={() => regenerate(f)}
                disabled={regenerating[f.id]}
              >
                {regenerating[f.id] ? "Regenerating..." : "Regenerate"}
              </Btn>
              <Btn variant="secondary" onClick={() => dismiss(f)}>
                Dismiss
              </Btn>
            </div>
          </Card>
        );
      })}

      {done.length > 0 && (
        <Card>
          <MiniLabel>Sent this session</MiniLabel>
          <div className="mt-4">
            {done.map((f, i) => (
              <div key={f.id}>
                <div className="flex justify-between items-center py-3">
                  <div className="flex gap-2 items-center">
                    <span className="text-[13px] text-content-sub">
                      @{f.username}
                    </span>
                    <Tag type={f.platform}>{P_LABEL[f.platform]}</Tag>
                    <Tag type={f.messageType}>
                      {f.messageType === "dm" ? "DM" : "Comment"}
                    </Tag>
                  </div>
                  <Tag type="actioned">Copied</Tag>
                </div>
                {i < done.length - 1 && <Divider />}
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
