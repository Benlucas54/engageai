"use client";

import { useState, useEffect } from "react";
import { useComments } from "@/hooks/useComments";
import { useLinkedAccounts } from "@/hooks/useLinkedAccounts";
import { useLayout } from "@/contexts/LayoutContext";
import { P_LABEL } from "@/lib/constants";
import { Tag } from "@/components/ui/Tag";
import { CommentCard } from "@/components/dashboard/CommentCard";

type View = "list" | "columns";

export function FeedView() {
  const { comments } = useComments();
  const { accounts } = useLinkedAccounts();
  const { setWide } = useLayout();

  const [filter, setFilter] = useState("all");
  const [view, setView] = useState<View>("list");
  const [visiblePlatforms, setVisiblePlatforms] = useState<Set<string>>(
    new Set()
  );

  // Initialize visible platforms from linked accounts
  useEffect(() => {
    if (accounts.length > 0 && visiblePlatforms.size === 0) {
      setVisiblePlatforms(
        new Set(accounts.filter((a) => a.enabled).map((a) => a.platform))
      );
    }
  }, [accounts, visiblePlatforms.size]);

  // Toggle wide mode when switching views
  useEffect(() => {
    setWide(view === "columns");
    return () => setWide(false);
  }, [view, setWide]);

  const filtered =
    filter === "all" ? comments : comments.filter((c) => c.status === filter);

  const togglePlatform = (p: string) => {
    setVisiblePlatforms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  };

  // All platforms that have comments
  const allPlatforms = Array.from(new Set(comments.map((c) => c.platform)));

  return (
    <div>
      {/* Status filters + view toggle */}
      <div className="flex items-center gap-1.5 mb-5 flex-wrap">
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

        <div className="ml-auto flex items-center gap-2">
          {view === "columns" && (
            <div className="flex gap-1.5 flex-wrap">
              {allPlatforms.map((p) => (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`px-3 py-1.5 rounded-full border text-[11px] font-medium cursor-pointer font-sans capitalize tracking-[0.02em] transition-colors ${
                    visiblePlatforms.has(p)
                      ? "border-content bg-content text-white"
                      : "border-border bg-surface-card text-content-sub"
                  }`}
                >
                  {P_LABEL[p] || p}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-0.5 border border-border rounded-lg p-0.5">
            <button
              onClick={() => setView("list")}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer font-sans transition-colors ${
                view === "list"
                  ? "bg-content text-white"
                  : "text-content-sub hover:text-content"
              }`}
              title="List view"
            >
              &#x2261;
            </button>
            <button
              onClick={() => setView("columns")}
              className={`px-2.5 py-1.5 rounded-md text-xs font-medium cursor-pointer font-sans transition-colors ${
                view === "columns"
                  ? "bg-content text-white"
                  : "text-content-sub hover:text-content"
              }`}
              title="Column view"
            >
              &#x25A5;
            </button>
          </div>
        </div>
      </div>

      {/* List view */}
      {view === "list" && (
        <div className="flex flex-col gap-2.5">
          {filtered.map((c) => (
            <CommentCard key={c.id} comment={c} />
          ))}
        </div>
      )}

      {/* Column view */}
      {view === "columns" && (
        <div className="flex gap-3">
          {allPlatforms
            .filter((p) => visiblePlatforms.has(p))
            .map((p) => {
              const colComments = filtered.filter((c) => c.platform === p);
              return (
                <div key={p} className="flex-1 min-w-[260px] flex flex-col">
                  <div className="sticky top-0 z-10 bg-surface pb-2 flex items-center gap-2">
                    <Tag type={p}>{P_LABEL[p] || p}</Tag>
                    <span className="text-[11px] text-content-faint">
                      {colComments.length}
                    </span>
                  </div>
                  <div
                    className="flex flex-col gap-2 overflow-y-auto pr-1"
                    style={{ maxHeight: "calc(100vh - 200px)" }}
                  >
                    {colComments.map((c) => (
                      <CommentCard key={c.id} comment={c} compact />
                    ))}
                    {colComments.length === 0 && (
                      <p className="text-[12px] text-content-faint py-4 text-center">
                        No comments
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      )}
    </div>
  );
}
