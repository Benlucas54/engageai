"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Comment, CommenterProfile } from "@/lib/types";
import { P_LABEL } from "@/lib/constants";
import { timeAgo } from "@/utils/timeAgo";
import { Tag } from "@/components/ui/Tag";
import { SmartTagBadge } from "@/components/ui/SmartTagBadge";
import { Card } from "@/components/ui/Card";
import { MiniLabel } from "@/components/ui/MiniLabel";
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
}

export function CommentCard({ comment: c, compact }: CommentCardProps) {
  const replyRow = c.replies?.[0];
  const reply = replyRow?.reply_text;
  const isOwnerReply = replyRow?.sent_at && !replyRow?.draft_text;
  const isSent = !!replyRow?.sent_at;
  const sendStep = replyRow?.send_step;

  const [editText, setEditText] = useState(reply || "");
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const [profile, setProfile] = useState<CommenterProfile | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);

  // Sync local state when prop changes (e.g. realtime update)
  useEffect(() => {
    if (reply) setEditText(reply);
  }, [reply]);

  const saveReply = useCallback(
    async (text: string) => {
      if (!replyRow || text === reply) return;
      setSaving(true);
      await fetch("/api/replies", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: replyRow.id,
          reply_text: text,
          draft_text: text,
        }),
      });
      setSaving(false);
    },
    [replyRow, reply]
  );

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

  const handleChange = (text: string) => {
    setEditText(text);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => saveReply(text), 800);
  };

  // Save on unmount if pending
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

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
          {!compact && (
            <span className="text-[11px] text-content-xfaint">
              on &quot;{c.post_title}&quot;
            </span>
          )}
        </div>
        <div className="flex gap-1.5 items-center shrink-0">
          <Tag type={c.status}>{c.status === "flagged" ? "inbox" : c.status}</Tag>
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
      {c.status === "replied" && !isSent && (
        <div className="mt-3.5 px-3.5 py-3 bg-surface rounded-[7px] border-l-2 border-content-xfaint">
          <MiniLabel>Engaged externally</MiniLabel>
          <p className="mt-1.5 mb-0 text-[12px] text-content-faint italic leading-[1.65]">
            Liked
          </p>
        </div>
      )}
      {/* Inbox comments: show the EngageAI draft reply for editing */}
      {reply && c.status !== "replied" && !isSent && (
        <div className="mt-3.5 px-3.5 py-3 bg-surface rounded-[7px] border-l-2 border-content-xfaint">
          <div className="flex justify-between items-center">
            <MiniLabel>EngageAI reply</MiniLabel>
            {saving && (
              <span className="text-[10px] text-content-faint">Saving...</span>
            )}
          </div>
          <textarea
            value={editText}
            onChange={(e) => handleChange(e.target.value)}
            className="mt-1.5 mb-0 w-full text-[13px] text-content-sub leading-[1.65] bg-transparent border-none outline-none resize-y font-sans p-0 min-h-[60px]"
            rows={Math.max(2, editText.split("\n").length)}
          />
          {sendStep && sendStep !== "done" && STEP_LABELS[sendStep] && (
            <div className={`mt-2 flex items-center gap-1.5 text-[11px] font-medium ${STEP_LABELS[sendStep].color}`}>
              {sendStep !== "error" && (
                <span className="inline-block w-2.5 h-2.5 rounded-full border-[1.5px] border-current border-t-transparent animate-spin" />
              )}
              {sendStep === "error" && <span>&#10007;</span>}
              {STEP_LABELS[sendStep].label}
            </div>
          )}
        </div>
      )}
      {/* Sent replies: show the actual reply that was posted */}
      {reply && isSent && (
        <div className="mt-3.5 px-3.5 py-3 bg-surface rounded-[7px] border-l-2 border-content-xfaint">
          <MiniLabel>Your reply</MiniLabel>
          <p className="mt-1.5 mb-0 text-[13px] text-content-sub leading-[1.65]">
            {reply}
          </p>
        </div>
      )}
    </Card>
  );
}
