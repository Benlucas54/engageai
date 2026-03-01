import type { Comment } from "@/lib/types";
import { P_LABEL } from "@/lib/constants";
import { timeAgo } from "@/utils/timeAgo";
import { Tag } from "@/components/ui/Tag";
import { Card } from "@/components/ui/Card";
import { MiniLabel } from "@/components/ui/MiniLabel";

interface CommentCardProps {
  comment: Comment;
  compact?: boolean;
}

export function CommentCard({ comment: c, compact }: CommentCardProps) {
  const replyRow = c.replies?.[0];
  const reply = replyRow?.reply_text;
  const isOwnerReply = replyRow?.sent_at && !replyRow?.draft_text;

  return (
    <Card className={compact ? "!px-3.5 !py-3" : ""}>
      <div className="flex justify-between items-start gap-3 mb-3">
        <div className="flex gap-1.5 items-center flex-wrap">
          <span
            className={`text-content font-medium ${
              compact ? "text-[12px]" : "text-[13px]"
            }`}
          >
            @{c.username}
          </span>
          {!compact && <Tag type={c.platform}>{P_LABEL[c.platform]}</Tag>}
          {!compact && (
            <span className="text-[11px] text-content-xfaint">
              on &quot;{c.post_title}&quot;
            </span>
          )}
        </div>
        <div className="flex gap-1.5 items-center shrink-0">
          <Tag type={c.status}>{c.status}</Tag>
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
      {reply && (
        <div className="mt-3.5 px-3.5 py-3 bg-surface rounded-[7px] border-l-2 border-content-xfaint">
          <MiniLabel>{isOwnerReply ? "Your reply" : "EngageAI reply"}</MiniLabel>
          <p className="mt-1.5 mb-0 text-[13px] text-content-sub leading-[1.65]">
            {reply}
          </p>
        </div>
      )}
    </Card>
  );
}
