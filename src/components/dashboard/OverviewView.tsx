"use client";

import Link from "next/link";
import { useComments } from "@/hooks/useComments";
import { useAgentStatus } from "@/hooks/useAgentStatus";
import { P_LABEL } from "@/lib/constants";
import { timeAgo } from "@/utils/timeAgo";
import { Tag } from "@/components/ui/Tag";
import { Btn } from "@/components/ui/Btn";
import { Card } from "@/components/ui/Card";
import { MiniLabel } from "@/components/ui/MiniLabel";
import { Divider } from "@/components/ui/Divider";

export function OverviewView() {
  const { comments } = useComments();
  const agentRun = useAgentStatus();

  const replied = comments.filter((c) => c.status === "replied").length;
  const flagged = comments.filter((c) => c.status === "flagged").length;

  const platforms = (["instagram", "threads", "x"] as const).map((p) => {
    const total = comments.filter((c) => c.platform === p).length;
    const auto = comments.filter(
      (c) => c.platform === p && c.status === "replied"
    ).length;
    return { p, total, auto };
  });

  return (
    <div className="flex flex-col gap-3.5">
      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "Total today", val: comments.length, tag: null },
          { label: "Auto-handled", val: replied, tag: "replied" as const },
          { label: "Needs attention", val: flagged, tag: "flagged" as const },
        ].map(({ label, val, tag }) => (
          <Card key={label}>
            <MiniLabel>{label}</MiniLabel>
            <div className="my-2.5 text-4xl font-light tracking-[-0.03em] text-content font-display leading-none">
              {val}
            </div>
            {tag && (
              <Tag type={tag}>
                {tag === "replied" ? "Auto-replied" : "Flagged"}
              </Tag>
            )}
          </Card>
        ))}
      </div>

      {/* Platform breakdown */}
      <Card>
        <MiniLabel>Platform breakdown</MiniLabel>
        <div className="mt-5 flex flex-col gap-[18px]">
          {platforms.map(({ p, total, auto }) => (
            <div key={p}>
              <div className="flex justify-between items-center mb-2">
                <Tag type={p}>{P_LABEL[p]}</Tag>
                <span className="text-xs text-content-faint">
                  {auto} / {total} replied
                </span>
              </div>
              <div className="h-[3px] bg-border-light rounded-[3px]">
                <div
                  className="h-full bg-content rounded-[3px]"
                  style={{
                    width: total > 0 ? `${(auto / total) * 100}%` : "0%",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Flagged nudge */}
      {flagged > 0 && (
        <Link href="/flagged" className="no-underline">
          <Card className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <Tag type="flagged">Action needed</Tag>
              <div>
                <div className="text-[13px] text-content font-medium">
                  {flagged} comments waiting for your reply
                </div>
                <div className="text-xs text-content-faint mt-0.5">
                  Pricing questions · founder enquiries
                </div>
              </div>
            </div>
            <Btn variant="secondary" size="sm">
              Review →
            </Btn>
          </Card>
        </Link>
      )}

      {/* Recent activity */}
      <Card>
        <MiniLabel>Recent activity</MiniLabel>
        <div className="mt-4">
          {comments.slice(0, 4).map((c, i) => (
            <div key={c.id}>
              <div className="flex justify-between items-start py-3.5 gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex gap-1.5 items-center mb-[5px] flex-wrap">
                    <span className="text-xs text-content font-medium">
                      @{c.username}
                    </span>
                    <Tag type={c.platform}>{P_LABEL[c.platform]}</Tag>
                  </div>
                  <p className="m-0 text-[13px] text-content-sub leading-[1.6] whitespace-nowrap overflow-hidden text-ellipsis">
                    {c.comment_text}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5 shrink-0">
                  <Tag type={c.status}>{c.status}</Tag>
                  <span className="text-[11px] text-content-faint">
                    {timeAgo(c.created_at)}
                  </span>
                </div>
              </div>
              {i < 3 && <Divider />}
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
  );
}
