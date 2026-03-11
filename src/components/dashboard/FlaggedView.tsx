"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { getSupabase } from "@/lib/supabase";
import { useComments } from "@/hooks/useComments";
import { useSmartTags } from "@/hooks/useSmartTags";
import { useProfiles } from "@/hooks/useProfiles";
import { buildPlatformProfileMap, buildProfileIdMap, resolveProfileBadge } from "@/lib/profileLookup";
import { P_LABEL } from "@/lib/constants";
import { timeAgo } from "@/utils/timeAgo";
import { Tag } from "@/components/ui/Tag";
import { SmartTagBadge } from "@/components/ui/SmartTagBadge";
import { ProfileBadge } from "@/components/ui/ProfileBadge";
import { Btn } from "@/components/ui/Btn";
import { Card } from "@/components/ui/Card";
import { MiniLabel } from "@/components/ui/MiniLabel";
import { Divider } from "@/components/ui/Divider";
import type { FlaggedComment } from "@/lib/types";

function responseAge(createdAt: string): { label: string; urgent: boolean } {
  const hours = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60);
  if (hours < 1) return { label: `${Math.round(hours * 60)}m`, urgent: false };
  if (hours < 24) return { label: `${Math.round(hours)}h`, urgent: hours > 6 };
  return { label: `${Math.round(hours / 24)}d`, urgent: true };
}

export function FlaggedView() {
  const { comments, refetch: refetchComments } = useComments();
  const { enabledTags, tagLabel, tagColors, tagPriority } = useSmartTags();
  const { profiles } = useProfiles();
  const profileMap = useMemo(() => buildPlatformProfileMap(profiles), [profiles]);
  const profileIdMap = useMemo(() => buildProfileIdMap(profiles), [profiles]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [done, setDone] = useState<FlaggedComment[]>([]);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const flagged: FlaggedComment[] = comments
    .filter((c) => {
      if (c.status !== "flagged" && c.status !== "pending") return false;
      if (c.replies?.some((r) => r.sent_at)) return false;
      if (c.replies?.some((r) => r.approved)) return false;
      return true;
    })
    .map((c) => ({
      ...c,
      draft:
        c.replies?.[0]?.reply_text || c.replies?.[0]?.draft_text || "",
      replyId: c.replies?.[0]?.id,
    }));

  // Tag counts for filter bar
  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const tag of enabledTags) counts[tag.key] = 0;
    for (const c of flagged) {
      if (c.smart_tag) counts[c.smart_tag] = (counts[c.smart_tag] || 0) + 1;
    }
    return counts;
  }, [flagged, enabledTags]);

  const toggleFilter = (tag: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  const getDraft = (c: FlaggedComment) =>
    drafts[c.id] !== undefined ? drafts[c.id] : c.draft;

  const updateDraft = (id: string, val: string) =>
    setDrafts((p) => ({ ...p, [id]: val }));

  const approve = useCallback(async (c: FlaggedComment) => {
    const draftText = getDraft(c);
    // Copy to clipboard
    try { await navigator.clipboard.writeText(draftText); } catch {}
    // Open comment link in new tab
    if (c.post_url) window.open(c.post_url, "_blank");
    // Mark as approved in DB
    if (c.replyId) {
      await getSupabase()
        .from("replies")
        .update({ draft_text: draftText, reply_text: draftText, approved: true } as never)
        .eq("id", c.replyId);
    }
    setCopied(c.id);
    setTimeout(() => setCopied(null), 2000);
    setDone((p) => [...p, c]);
    refetchComments();
  }, [drafts, refetchComments]);

  const dismiss = useCallback(async (c: FlaggedComment) => {
    await getSupabase()
      .from("comments")
      .update({ status: "hidden" } as never)
      .eq("id", c.id);
    refetchComments();
  }, [refetchComments]);

  const regenerate = useCallback(async (c: FlaggedComment) => {
    setRegenerating((p) => ({ ...p, [c.id]: true }));
    try {
      const res = await fetch("/api/generate-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          comment: {
            platform: c.platform,
            username: c.username,
            comment_text: c.comment_text,
            post_title: c.post_title,
            post_url: c.post_url,
            comment_external_id: c.comment_external_id,
            created_at: c.created_at,
          },
        }),
      });
      const data = await res.json();
      if (data.reply_text) {
        updateDraft(c.id, data.reply_text);
        // Update in DB too
        if (c.replyId) {
          await getSupabase()
            .from("replies")
            .update({ draft_text: data.reply_text, reply_text: data.reply_text } as never)
            .eq("id", c.replyId);
        }
      }
    } catch {
      // Silently fail — user can try again
    } finally {
      setRegenerating((p) => ({ ...p, [c.id]: false }));
    }
  }, []);

  // Filter and sort by priority
  const active = useMemo(() => {
    let items = flagged.filter((c) => !done.find((d) => d.id === c.id));

    // Apply tag filters
    if (activeFilters.size > 0) {
      items = items.filter((c) => c.smart_tag && activeFilters.has(c.smart_tag));
    }

    // Sort by tag priority (highest first)
    items.sort((a, b) => {
      const pa = a.smart_tag ? tagPriority(a.smart_tag) : 0;
      const pb = b.smart_tag ? tagPriority(b.smart_tag) : 0;
      return pb - pa;
    });

    return items;
  }, [flagged, done, activeFilters]);

  // Keep selectedIdx in bounds
  useEffect(() => {
    if (selectedIdx >= active.length) setSelectedIdx(Math.max(0, active.length - 1));
  }, [active.length, selectedIdx]);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Don't intercept when typing in textarea
      if ((e.target as HTMLElement)?.tagName === "TEXTAREA") return;
      const c = active[selectedIdx];
      if (!c) return;

      if (e.key === "Enter") {
        e.preventDefault();
        approve(c);
      } else if (e.key === "Escape" || e.key === "d") {
        e.preventDefault();
        dismiss(c);
      } else if (e.key === "Tab") {
        e.preventDefault();
        setSelectedIdx((i) => (i + 1) % active.length);
      } else if (e.key === "r" && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        regenerate(c);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [active, selectedIdx, approve, dismiss, regenerate]);

  const hasAnyTags = flagged.some((c) => c.smart_tag);

  return (
    <div className="flex flex-col gap-3" ref={containerRef}>

      {/* Tag filter bar */}
      {hasAnyTags && (
        <div className="flex gap-1.5 flex-wrap">
          {enabledTags.map((t) => {
            const count = tagCounts[t.key] || 0;
            if (count === 0) return null;
            const isActive = activeFilters.has(t.key);
            return (
              <button
                key={t.key}
                onClick={() => toggleFilter(t.key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-[5px] rounded-full text-[11px] font-medium border-none cursor-pointer transition-opacity ${
                  isActive ? "opacity-100" : activeFilters.size > 0 ? "opacity-40" : "opacity-100"
                }`}
                style={{ background: "transparent" }}
              >
                <SmartTagBadge tagKey={t.key} />
                <span className="text-[10px] text-content-faint">{count}</span>
              </button>
            );
          })}
          {activeFilters.size > 0 && (
            <button
              onClick={() => setActiveFilters(new Set())}
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
            All caught up — nothing to action.
          </div>
        </Card>
      )}

      {active.map((c, idx) => {
        const age = responseAge(c.created_at);
        const isSelected = idx === selectedIdx;
        const badge = resolveProfileBadge(c, profileIdMap, profileMap);
        return (
          <Card
            key={c.id}
            className={isSelected ? "ring-1 ring-content/20" : ""}
            onClick={() => setSelectedIdx(idx)}
          >
            <div className="flex justify-between items-center mb-3.5">
              <div className="flex gap-1.5 items-center">
                <span className="text-[13px] font-medium text-content">
                  @{c.username}
                </span>
                <Tag type={c.platform}>{P_LABEL[c.platform]}</Tag>
                {c.smart_tag && (
                  <SmartTagBadge tagKey={c.smart_tag} />
                )}
                {badge && (
                  <ProfileBadge name={badge.name} color={badge.color} />
                )}
                <Tag type="flagged">Inbox</Tag>
              </div>
              <span className={`text-[11px] ${age.urgent ? "text-red-500 font-medium" : "text-content-faint"}`}>
                {age.label} ago
              </span>
            </div>

            <p className="mb-0 text-sm text-content leading-[1.65]">
              {c.comment_text}
            </p>

            {getDraft(c) && (
              <p className="mt-2.5 mb-0 text-[13px] text-content-sub leading-[1.65] pl-3 border-l-2 border-border">
                {getDraft(c)}
              </p>
            )}

            <div className="flex gap-1.5 items-center mt-3">
              {getDraft(c) ? (
                <>
                  <Btn size="sm" onClick={() => approve(c)}>
                    {copied === c.id ? "Copied!" : "Copy & open"}
                  </Btn>
                  <Btn
                    size="sm"
                    variant="secondary"
                    onClick={() => regenerate(c)}
                    disabled={regenerating[c.id]}
                  >
                    {regenerating[c.id] ? "Regenerating..." : "Regenerate"}
                  </Btn>
                </>
              ) : (
                <Btn
                  size="sm"
                  onClick={() => regenerate(c)}
                  disabled={regenerating[c.id]}
                >
                  {regenerating[c.id] ? "Generating..." : "Generate"}
                </Btn>
              )}
              <Btn size="sm" variant="secondary" onClick={() => dismiss(c)}>
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
            {done.map((c, i) => {
              const doneBadge = resolveProfileBadge(c, profileIdMap, profileMap);
              return (
              <div key={c.id}>
                <div className="flex justify-between items-center py-3">
                  <div className="flex gap-2 items-center">
                    <span className="text-[13px] text-content-sub">
                      @{c.username}
                    </span>
                    <Tag type={c.platform}>{P_LABEL[c.platform]}</Tag>
                    {doneBadge && (
                      <ProfileBadge name={doneBadge.name} color={doneBadge.color} />
                    )}
                  </div>
                  <Tag type="replied">Copied</Tag>
                </div>
                {i < done.length - 1 && <Divider />}
              </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
