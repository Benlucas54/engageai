"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useComments } from "@/hooks/useComments";
import { useAgentStatus } from "@/hooks/useAgentStatus";
import { useAgentActivity } from "@/hooks/useAgentActivity";
import { P_LABEL } from "@/lib/constants";
import { timeAgo } from "@/utils/timeAgo";
import { Tag } from "@/components/ui/Tag";
import { Btn } from "@/components/ui/Btn";
import { Card } from "@/components/ui/Card";
import { MiniLabel } from "@/components/ui/MiniLabel";
import { Divider } from "@/components/ui/Divider";

const ACTIVITY_LABELS: Record<string, { icon: string; label: string; color: string }> = {
  scanning: { icon: "...", label: "Scanning", color: "text-blue-600" },
  liked: { icon: "\u2764", label: "Liked & queued", color: "text-pink-500" },
  replied: { icon: "\u2713", label: "Replied", color: "text-green-600" },
  flagged: { icon: "\u25CF", label: "Inbox", color: "text-amber-500" },
};

function AgentActivityFeed() {
  const { items, isRunning } = useAgentActivity();

  if (items.length === 0 && !isRunning) return null;

  return (
    <Card>
      <div className="flex items-center gap-2 mb-3">
        <MiniLabel>Agent activity</MiniLabel>
        {isRunning && (
          <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        )}
      </div>
      {items.length === 0 && isRunning && (
        <p className="text-[12px] text-content-faint">Scanning for new comments...</p>
      )}
      <div className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
        {items.map((item) => {
          const a = ACTIVITY_LABELS[item.status] || ACTIVITY_LABELS.scanning;
          return (
            <div key={item.id} className="flex items-center gap-2 py-1">
              <span className={`text-[12px] ${a.color} w-4 text-center shrink-0`}>{a.icon}</span>
              <Tag type={item.platform}>{P_LABEL[item.platform]}</Tag>
              <span className="text-[12px] text-content font-medium">@{item.username}</span>
              <span className="text-[11px] text-content-faint truncate flex-1">{item.text}</span>
              <span className={`text-[11px] font-medium ${a.color} shrink-0`}>{a.label}</span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export function OverviewView() {
  const { comments } = useComments();
  const agentRun = useAgentStatus();
  const [runState, setRunState] = useState<"idle" | "starting" | "running">("idle");

  const isAgentRunning = agentRun?.status === "running";

  // Sync local state with real-time agent status
  useEffect(() => {
    if (runState === "starting" && isAgentRunning) {
      setRunState("running");
    }
    if (runState === "running" && !isAgentRunning) {
      setRunState("idle");
    }
  }, [isAgentRunning, runState]);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();
  const todayComments = comments.filter((c) => c.synced_at >= todayISO || c.created_at >= todayISO);

  const replied = todayComments.filter((c) => c.replies?.some((r) => r.auto_sent && r.sent_at)).length;
  const flagged = comments.filter((c) => {
    if (c.status !== "flagged" && c.status !== "pending") return false;
    if (c.replies?.some((r) => r.sent_at)) return false;
    if (c.replies?.some((r) => r.approved)) return false;
    return true;
  }).length;

  const platforms = (["instagram", "threads", "x", "linkedin", "tiktok", "youtube"] as const).map((p) => {
    const total = todayComments.filter((c) => c.platform === p).length;
    const auto = todayComments.filter(
      (c) => c.platform === p && c.replies?.some((r) => r.auto_sent && r.sent_at)
    ).length;
    return { p, total, auto };
  });

  return (
    <div className="flex flex-col gap-3.5">
      {/* Agent run + Stat cards */}
      <div className="flex items-center justify-between">
        <MiniLabel>
          {isAgentRunning
            ? `Agent running — started ${timeAgo(agentRun.started_at)}`
            : agentRun?.completed_at
              ? `Last run ${timeAgo(agentRun.completed_at)}`
              : "Agent has not run yet"}
        </MiniLabel>
        <Btn
          size="sm"
          onClick={async () => {
            setRunState("starting");
            try {
              await fetch("/api/run-now", { method: "POST" });
              setRunState("running");
            } catch {
              setRunState("idle");
            }
          }}
          disabled={runState === "starting"}
        >
          {runState === "starting"
            ? "Restarting…"
            : isAgentRunning
              ? "Restart Agent"
              : "Run Now"}
        </Btn>
      </div>

      <AgentActivityFeed />

      <div className="grid grid-cols-3 gap-2.5">
        {[
          { label: "Total today", val: todayComments.length, tag: null },
          { label: "Auto-handled", val: replied, tag: "replied" as const },
          { label: "Inbox", val: flagged, tag: "flagged" as const },
        ].map(({ label, val, tag }) => (
          <Card key={label}>
            <MiniLabel>{label}</MiniLabel>
            <div className="my-2.5 text-4xl font-light tracking-[-0.03em] text-content font-display leading-none">
              {val}
            </div>
            {tag && (
              <Tag type={tag}>
                {tag === "replied" ? "Auto-replied" : "Needs reply"}
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

      {/* Inbox nudge */}
      {flagged > 0 && (
        <Link href="/inbox" className="no-underline">
          <Card className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <Tag type="flagged">Action needed</Tag>
              <div>
                <div className="text-[13px] text-content font-medium">
                  {flagged} comments waiting for your reply
                </div>
                <div className="text-xs text-content-faint mt-0.5">
                  Unengaged comments needing your reply
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
                  <Tag type={c.status}>{c.status === "flagged" ? "inbox" : c.status}</Tag>
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
