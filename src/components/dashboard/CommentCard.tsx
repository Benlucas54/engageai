"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Comment, CommenterProfile } from "@/lib/types";
import { P_LABEL } from "@/lib/constants";
import { timeAgo } from "@/utils/timeAgo";
import { Tag } from "@/components/ui/Tag";
import { SmartTagBadge } from "@/components/ui/SmartTagBadge";
import { Card } from "@/components/ui/Card";
import { MiniLabel } from "@/components/ui/MiniLabel";
import { ProfileBadge } from "@/components/ui/ProfileBadge";
import { getSupabase } from "@/lib/supabase";

const STEP_LABELS: Record<string, { label: string; color: string }> = {
  opening: { label: "Opening page\u2026", color: "text-blue-500" },
  finding: { label: "Finding comment\u2026", color: "text-blue-500" },
  liking: { label: "Liking comment\u2026", color: "text-pink-500" },
  opening_reply: { label: "Opening reply\u2026", color: "text-blue-500" },
  typing: { label: "Typing reply\u2026", color: "text-violet-500" },
  posting: { label: "Posting reply\u2026", color: "text-violet-500" },
  verifying: { label: "Verifying reply\u2026", color: "text-amber-500" },
  retrying: { label: "Retrying\u2026", color: "text-amber-500" },
  done: { label: "Sent!", color: "text-green-600" },
  error: { label: "Failed to send", color: "text-red-500" },
};

interface CommentCardProps {
  comment: Comment;
  compact?: boolean;
  isDismissed?: boolean;
  profileBadge?: { name: string; color: string } | null;
  onDismiss?: (id: string) => void;
  onUndoDismiss?: (id: string) => void;
  onRestore?: (id: string) => void;
  onRefetch?: () => void;
}

export function CommentCard({ comment: c, compact, isDismissed, profileBadge, onDismiss, onUndoDismiss, onRestore, onRefetch }: CommentCardProps) {
  const replyRow = c.replies?.[0];
  const reply = replyRow?.reply_text;
  const isOwnerReply = replyRow?.sent_at && !replyRow?.draft_text;
  const isSent = !!replyRow?.sent_at;
  const sendStep = replyRow?.send_step;
  const [regenerating, setRegenerating] = useState(false);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  const [profile, setProfile] = useState<CommenterProfile | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  const handleUsernameClick = useCallback(async () => {
    if (profileOpen) {
      setProfileOpen(false);
      return;
    }
    if (profile) {
      setProfileOpen(true);
      return;
    }
    setProfileLoading(true);
    const sb = getSupabase();
    const { data } = await sb
      .from("commenter_profiles")
      .select("*")
      .eq("platform", c.platform)
      .eq("username", c.username)
      .limit(1)
      .single();
    setProfile(data as CommenterProfile | null);
    setProfileOpen(true);
    setProfileLoading(false);
  }, [profileOpen, profile, c.platform, c.username]);

  const handleDismiss = useCallback(async () => {
    onDismiss?.(c.id);
    await fetch("/api/comments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, status: "hidden" }),
    });
    onRefetch?.();
  }, [c.id, onRefetch, onDismiss]);

  const handleUndo = useCallback(async () => {
    onUndoDismiss?.(c.id);
    await fetch("/api/comments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, status: "flagged" }),
    });
    onRefetch?.();
  }, [c.id, onRefetch, onUndoDismiss]);

  const handleRestore = useCallback(async () => {
    onRestore?.(c.id);
    await fetch("/api/comments", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, status: "flagged" }),
    });
    onRefetch?.();
  }, [c.id, onRefetch, onRestore]);

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
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
        const sb = getSupabase();
        if (replyRow) {
          await sb
            .from("replies")
            .update({ draft_text: data.reply_text, reply_text: data.reply_text } as never)
            .eq("id", replyRow.id);
        } else {
          await sb
            .from("replies")
            .insert({ comment_id: c.id, draft_text: data.reply_text, reply_text: data.reply_text } as never);
        }
        onRefetch?.();
      }
    } catch {
      // Silently fail
    } finally {
      setRegenerating(false);
    }
  }, [c, replyRow]);

  const handleView = useCallback(() => {
    if (c.post_url) window.open(c.post_url, "_blank");
  }, [c.post_url]);


  const [countdown, setCountdown] = useState(3);
  const countdownRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    if (!isDismissed) {
      setCountdown(3);
      if (countdownRef.current) clearInterval(countdownRef.current);
      return;
    }
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, [isDismissed]);

  if (isDismissed) {
    return (
      <Card className={`${compact ? "!px-3.5 !py-3" : ""} flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-content-faint">Comment dismissed</span>
          {countdown > 0 && (
            <span className="text-[11px] text-content-xfaint tabular-nums">{countdown}s</span>
          )}
        </div>
        {countdown > 0 && (
          <button
            onClick={handleUndo}
            className="text-[12px] text-content-sub hover:text-content font-medium cursor-pointer bg-transparent border-none underline"
          >
            Undo
          </button>
        )}
      </Card>
    );
  }

  return (
    <Card className={compact ? "!px-3.5 !py-3" : ""}>
      <div className="flex justify-between items-start gap-3 mb-3">
        <div className="flex gap-1.5 items-center flex-wrap">
          <button
            onClick={handleUsernameClick}
            className={`text-content font-medium hover:underline cursor-pointer bg-transparent border-none p-0 ${
              compact ? "text-[12px]" : "text-[13px]"
            }`}
          >
            @{c.username}
            {profileLoading && (
              <span className="ml-1 inline-block w-2.5 h-2.5 rounded-full border-[1.5px] border-current border-t-transparent animate-spin align-middle" />
            )}
          </button>
          {!compact && <Tag type={c.platform}>{P_LABEL[c.platform]}</Tag>}
          {!compact && c.smart_tag && (
            <SmartTagBadge tagKey={c.smart_tag} />
          )}
          {!compact && profileBadge && (
            <ProfileBadge name={profileBadge.name} color={profileBadge.color} />
          )}
          {!compact && (
            <span className="text-[11px] text-content-xfaint">
              on &quot;{c.post_title}&quot;
            </span>
          )}
        </div>
        <div className="flex gap-1.5 items-center shrink-0">
          <Tag type={c.status}>{c.status === "flagged" ? "inbox" : c.status === "hidden" ? "dismissed" : c.status}</Tag>
          <span className="text-[11px] text-content-faint">
            {timeAgo(c.created_at)}
          </span>
        </div>
      </div>
      <p
        className={`m-0 text-content leading-[1.65] ${
          compact ? "text-[13px]" : "text-sm"
        }`}
      >
        {c.comment_text}
      </p>
      {profileOpen && profile && (
        <div className="mt-2.5 px-3 py-2.5 bg-surface rounded-[7px] border border-border">
          <div className="flex items-center gap-2 mb-1.5">
            <MiniLabel>Commenter profile</MiniLabel>
            <span className="text-[11px] text-content-faint">
              {profile.comment_count} comment{profile.comment_count !== 1 ? "s" : ""} since{" "}
              {new Date(profile.first_seen_at).toLocaleDateString()}
            </span>
          </div>
          {profile.summary && (
            <p className="m-0 text-[12px] text-content-sub leading-[1.6]">
              {profile.summary}
            </p>
          )}
          {profile.topics.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1.5">
              {profile.topics.map((topic) => (
                <span
                  key={topic}
                  className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-content-xfaint/10 text-content-faint"
                >
                  {topic}
                </span>
              ))}
            </div>
          )}
          {!profile.summary && profile.topics.length === 0 && (
            <p className="m-0 text-[11px] text-content-faint italic">
              Profile data will appear after the next scan.
            </p>
          )}
        </div>
      )}
      {profileOpen && !profile && !profileLoading && (
        <div className="mt-2.5 px-3 py-2.5 bg-surface rounded-[7px] border border-border">
          <p className="m-0 text-[11px] text-content-faint italic">
            No profile data yet for this commenter.
          </p>
        </div>
      )}
      {/* Replied comments that were engaged externally (no reply sent through EngageAI) */}
      {c.status === "replied" && !isSent && !reply && (
        <div className="mt-3 pt-3 border-t border-border">
          <span className="text-[10px] text-content-faint">Engaged externally</span>
          <p className="mt-1 mb-0 text-[12px] text-content-faint italic leading-[1.65]">
            Liked
          </p>
        </div>
      )}
      {/* Draft reply */}
      {reply && !isSent && (
        <div className="mt-2.5">
          <p className="m-0 text-[13px] text-content-sub leading-[1.65] pl-3 border-l-2 border-border">
            {reply}
          </p>
          {sendStep && sendStep !== "done" && STEP_LABELS[sendStep] && (
            <div className={`mt-1.5 flex items-center gap-1.5 text-[11px] font-medium ${STEP_LABELS[sendStep].color}`}>
              {sendStep !== "error" && (
                <span className="inline-block w-2.5 h-2.5 rounded-full border-[1.5px] border-current border-t-transparent animate-spin" />
              )}
              {sendStep === "error" && <span>&#10007;</span>}
              {STEP_LABELS[sendStep].label}
            </div>
          )}
        </div>
      )}
      {/* Sent replies */}
      {reply && isSent && (
        <div className="mt-3 pt-3 border-t border-border">
          <span className="text-[10px] text-content-faint">Your reply</span>
          <p className="mt-1 mb-0 text-[13px] text-content-sub leading-[1.65]">
            {reply}
          </p>
        </div>
      )}
      {/* Action icons */}
      <div className="flex justify-end items-center gap-1 mt-3">
        {[
          c.status === "hidden"
            ? {
                key: "undo",
                label: "Undo dismiss",
                onClick: handleRestore,
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="1 4 1 10 7 10" />
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                  </svg>
                ),
              }
            : {
                key: "dismiss",
                label: "Dismiss",
                onClick: handleDismiss,
                icon: (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                ),
              },
          {
            key: "regenerate",
            label: regenerating ? "Generating..." : reply ? "Regenerate" : "Generate",
            onClick: handleRegenerate,
            disabled: regenerating,
            icon: regenerating ? (
              <span className="inline-block w-3.5 h-3.5 rounded-full border-[1.5px] border-current border-t-transparent animate-spin" />
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" />
                <polyline points="1 20 1 14 7 14" />
                <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10" />
                <path d="M20.49 15a9 9 0 0 1-14.85 3.36L1 14" />
              </svg>
            ),
          },
          {
            key: "view",
            label: "View",
            onClick: handleView,
            disabled: !c.post_url,
            icon: (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                <polyline points="15 3 21 3 21 9" />
                <line x1="10" y1="14" x2="21" y2="3" />
              </svg>
            ),
          },
        ].map((action) => (
          <div key={action.key} className="relative flex flex-col items-center">
            {hoveredAction === action.key && (
              <span className="absolute bottom-full mb-1 text-[10px] text-content-faint whitespace-nowrap select-none">
                {action.label}
              </span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); action.onClick(); }}
              disabled={"disabled" in action ? action.disabled : false}
              onMouseEnter={() => setHoveredAction(action.key)}
              onMouseLeave={() => setHoveredAction(null)}
              className="p-1.5 rounded-md text-content-faint hover:text-content hover:bg-surface transition-colors cursor-pointer bg-transparent border-none disabled:opacity-30 disabled:cursor-default"
            >
              {action.icon}
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
}
