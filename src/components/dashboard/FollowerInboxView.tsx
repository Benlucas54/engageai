"use client";

import { useState, useMemo } from "react";
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

export function FollowerInboxView() {
  const { followers, refetch } = useFollowers();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [done, setDone] = useState<FlaggedFollower[]>([]);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");

  // Get followers that have pending actions (not yet sent or approved)
  const flagged: FlaggedFollower[] = useMemo(() => {
    return followers
      .filter((f) => f.status === "new")
      .filter((f) => {
        const actions = f.follower_actions || [];
        // Include if: has draft actions not yet approved/sent, or has no actions at all
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

  const approve = async (f: FlaggedFollower) => {
    const draftText = getDraft(f);
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
    setDone((p) => [...p, f]);
    refetch();
  };

  const dismiss = async (f: FlaggedFollower) => {
    await getSupabase()
      .from("followers")
      .update({ status: "dismissed" } as never)
      .eq("id", f.id);
    refetch();
  };

  const active = useMemo(() => {
    let items = flagged.filter((f) => !done.find((d) => d.id === f.id));
    if (platformFilter !== "all") {
      items = items.filter((f) => f.platform === platformFilter);
    }
    return items;
  }, [flagged, done, platformFilter]);

  const platforms = (["instagram", "threads", "tiktok"] as const).filter(
    (p) => platformCounts[p] > 0
  );

  return (
    <div className="flex flex-col gap-3">
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

      {active.map((f) => (
        <Card key={f.id}>
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

          <div className="flex gap-2">
            <Btn onClick={() => approve(f)}>
              Send {f.messageType === "dm" ? "DM" : "comment"}
            </Btn>
            <Btn variant="secondary" onClick={() => dismiss(f)}>
              Dismiss
            </Btn>
          </div>
        </Card>
      ))}

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
                  <Tag type="actioned">Sent</Tag>
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
