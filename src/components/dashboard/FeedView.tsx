"use client";

import { useState } from "react";
import { useComments } from "@/hooks/useComments";
import { P_LABEL } from "@/lib/constants";
import { timeAgo } from "@/utils/timeAgo";
import { Tag } from "@/components/ui/Tag";
import { Card } from "@/components/ui/Card";
import { MiniLabel } from "@/components/ui/MiniLabel";

export function FeedView() {
  const { comments } = useComments();
  const [filter, setFilter] = useState("all");

  const list =
    filter === "all" ? comments : comments.filter((c) => c.status === filter);

  return (
    <div>
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {["all", "replied", "flagged", "hidden"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3.5 py-1.5 rounded-full border text-xs font-medium cursor-pointer font-sans capitalize tracking-[0.02em] ${
              filter === f
                ? "border-content bg-content text-white"
                : "border-border bg-surface-card text-content-sub"
            }`}
          >
            {f === "all" ? `All \u00B7 ${comments.length}` : f}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2.5">
        {list.map((c) => {
          const reply = c.replies?.[0]?.reply_text;
          return (
            <Card key={c.id}>
              <div className="flex justify-between items-start gap-3 mb-3">
                <div className="flex gap-1.5 items-center flex-wrap">
                  <span className="text-[13px] text-content font-medium">
                    @{c.username}
                  </span>
                  <Tag type={c.platform}>{P_LABEL[c.platform]}</Tag>
                  <span className="text-[11px] text-content-xfaint">
                    on &quot;{c.post_title}&quot;
                  </span>
                </div>
                <div className="flex gap-1.5 items-center shrink-0">
                  <Tag type={c.status}>{c.status}</Tag>
                  <span className="text-[11px] text-content-faint">
                    {timeAgo(c.created_at)}
                  </span>
                </div>
              </div>
              <p className="m-0 text-sm text-content leading-[1.65]">
                {c.comment_text}
              </p>
              {reply && (
                <div className="mt-3.5 px-3.5 py-3 bg-surface rounded-[7px] border-l-2 border-content-xfaint">
                  <MiniLabel>EngageAI reply</MiniLabel>
                  <p className="mt-1.5 mb-0 text-[13px] text-content-sub leading-[1.65]">
                    {reply}
                  </p>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
