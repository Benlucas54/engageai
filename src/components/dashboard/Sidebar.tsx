"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { useComments } from "@/hooks/useComments";
import { useAgentStatus } from "@/hooks/useAgentStatus";
import { timeAgo } from "@/utils/timeAgo";

export function Sidebar() {
  const pathname = usePathname();
  const { comments } = useComments();
  const agentRun = useAgentStatus();

  const flagCount = comments.filter((c) => c.status === "flagged").length;

  const statusColor = agentRun
    ? agentRun.status === "success"
      ? "bg-[#7ab87a]"
      : agentRun.status === "running"
        ? "bg-[#d4a843]"
        : "bg-[#b87a7a]"
    : "bg-content-xfaint";

  const statusLabel = agentRun
    ? agentRun.status === "running"
      ? "Agent running"
      : agentRun.status === "success"
        ? "Agent active"
        : "Agent error"
    : "Agent idle";

  const lastRunText = agentRun?.completed_at
    ? `Last run ${timeAgo(agentRun.completed_at)}`
    : agentRun?.status === "running"
      ? "Running now..."
      : "No runs yet";

  return (
    <div className="w-[220px] bg-surface-sidebar border-r border-border flex flex-col sticky top-0 h-screen shrink-0">
      {/* Wordmark */}
      <div className="px-6 pt-8 pb-7 border-b border-border-light">
        <div className="text-[15px] font-semibold tracking-[-0.03em] text-content">
          EngageAI
        </div>
        <div className="text-[11px] text-content-xfaint mt-[3px]">
          by Promptpreneur
        </div>
      </div>

      {/* Nav links */}
      <nav className="px-3 py-4 flex-1">
        {NAV_ITEMS.map(({ id, icon, href, alert }) => {
          const active = pathname === href;
          return (
            <Link
              key={id}
              href={href}
              className={`w-full flex items-center justify-between px-3 py-[9px] rounded-[7px] text-[13px] mb-0.5 transition-colors duration-[120ms] no-underline ${
                active
                  ? "bg-surface font-medium text-content"
                  : "bg-transparent font-normal text-content-faint"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xs opacity-50">{icon}</span>
                {id}
              </div>
              {alert && flagCount > 0 && (
                <span className="text-[10px] bg-content text-white rounded-full px-[7px] py-[1px] font-semibold">
                  {flagCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Agent status */}
      <div className="px-6 py-5 border-t border-border-light">
        <div className="flex items-center gap-[7px] mb-[5px]">
          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusColor}`} />
          <span className="text-[11px] text-content-faint">{statusLabel}</span>
        </div>
        <div className="text-[11px] text-content-xfaint leading-[1.8]">
          {lastRunText}
          <br />
          Instagram · Threads · X
        </div>
      </div>
    </div>
  );
}
