"use client";

import { useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { useComments } from "@/hooks/useComments";
import { P_LABEL } from "@/lib/constants";
import { timeAgo } from "@/utils/timeAgo";
import { Tag } from "@/components/ui/Tag";
import { Btn } from "@/components/ui/Btn";
import { Card } from "@/components/ui/Card";
import { MiniLabel } from "@/components/ui/MiniLabel";
import { Divider } from "@/components/ui/Divider";
import type { FlaggedComment } from "@/lib/types";

export function FlaggedView() {
  const { comments, refetch: refetchComments } = useComments();
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [done, setDone] = useState<FlaggedComment[]>([]);

  const flagged: FlaggedComment[] = comments
    .filter((c) => {
      if (c.status !== "flagged" && c.status !== "pending") return false;
      if (c.replies?.some((r) => r.sent_at)) return false;
      return true;
    })
    .map((c) => ({
      ...c,
      draft:
        c.replies?.[0]?.reply_text || c.replies?.[0]?.draft_text || "",
      replyId: c.replies?.[0]?.id,
    }));

  const getDraft = (c: FlaggedComment) =>
    drafts[c.id] !== undefined ? drafts[c.id] : c.draft;

  const updateDraft = (id: string, val: string) =>
    setDrafts((p) => ({ ...p, [id]: val }));

  const approve = async (c: FlaggedComment) => {
    const draftText = getDraft(c);
    if (c.replyId) {
      await getSupabase()
        .from("replies")
        .update({ draft_text: draftText, reply_text: draftText, approved: true } as never)
        .eq("id", c.replyId);
    }
    setDone((p) => [...p, c]);
    refetchComments();
  };

  const dismiss = async (c: FlaggedComment) => {
    await getSupabase()
      .from("comments")
      .update({ status: "hidden" } as never)
      .eq("id", c.id);
    refetchComments();
  };

  const active = flagged.filter((c) => !done.find((d) => d.id === c.id));

  return (
    <div className="flex flex-col gap-3">
      {active.length === 0 && done.length === 0 && (
        <Card className="text-center py-[60px] px-6">
          <div className="text-[13px] text-content-faint">
            All caught up — nothing to action.
          </div>
        </Card>
      )}

      {active.map((c) => (
        <Card key={c.id}>
          <div className="flex justify-between items-center mb-3.5">
            <div className="flex gap-1.5 items-center">
              <span className="text-[13px] font-medium text-content">
                @{c.username}
              </span>
              <Tag type={c.platform}>{P_LABEL[c.platform]}</Tag>
              <Tag type="flagged">Inbox</Tag>
            </div>
            <span className="text-[11px] text-content-faint">
              {timeAgo(c.created_at)}
            </span>
          </div>

          <p className="mb-5 text-sm text-content leading-[1.65]">
            {c.comment_text}
          </p>

          <div className="mb-4">
            <MiniLabel>Draft reply</MiniLabel>
            <textarea
              value={getDraft(c)}
              onChange={(e) => updateDraft(c.id, e.target.value)}
              rows={3}
              className="mt-2 w-full bg-surface border border-border rounded-[7px] px-3.5 py-[11px] text-content text-[13px] leading-[1.65] resize-y font-sans outline-none focus:border-content"
            />
          </div>

          <div className="flex gap-2">
            <Btn onClick={() => approve(c)}>Send reply</Btn>
            <Btn variant="secondary" onClick={() => dismiss(c)}>
              Dismiss
            </Btn>
          </div>
        </Card>
      ))}

      {done.length > 0 && (
        <Card>
          <MiniLabel>Sent this session</MiniLabel>
          <div className="mt-4">
            {done.map((c, i) => (
              <div key={c.id}>
                <div className="flex justify-between items-center py-3">
                  <div className="flex gap-2 items-center">
                    <span className="text-[13px] text-content-sub">
                      @{c.username}
                    </span>
                    <Tag type={c.platform}>{P_LABEL[c.platform]}</Tag>
                  </div>
                  <Tag type="replied">Sent</Tag>
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
