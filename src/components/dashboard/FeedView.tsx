"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useComments } from "@/hooks/useComments";
import { useLinkedAccounts } from "@/hooks/useLinkedAccounts";
import { useProfiles } from "@/hooks/useProfiles";
import { useLayout } from "@/contexts/LayoutContext";
import { buildPlatformProfileMap, buildProfileIdMap, resolveProfileBadge } from "@/lib/profileLookup";
import { P_LABEL } from "@/lib/constants";
import { Tag } from "@/components/ui/Tag";
import { CommentCard } from "@/components/dashboard/CommentCard";

type View = "list" | "columns";

export function FeedView() {
  const { comments, refetch: refetchComments } = useComments();
  const { accounts } = useLinkedAccounts();
  const { profiles } = useProfiles();
  const { setWide } = useLayout();

  const profileMap = useMemo(() => buildPlatformProfileMap(profiles), [profiles]);
  const profileIdMap = useMemo(() => buildProfileIdMap(profiles), [profiles]);

  const [filter, setFilter] = useState("inbox");
  const [view, setView] = useState<View>("list");
  const [visiblePlatforms, setVisiblePlatforms] = useState<Set<string>>(
    new Set()
  );
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [restoredIds, setRestoredIds] = useState<Set<string>>(new Set());
  const dismissedAtRef = useRef<Map<string, number>>(new Map());

  const handleDismiss = useCallback((id: string) => {
    dismissedAtRef.current.set(id, Date.now());
    setDismissedIds((prev) => new Set(prev).add(id));
    setRestoredIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }, []);

  const handleUndoDismiss = useCallback((id: string) => {
    dismissedAtRef.current.delete(id);
    setDismissedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }, []);

  const handleRestore = useCallback((id: string) => {
    setRestoredIds((prev) => new Set(prev).add(id));
    setDismissedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  }, []);

  // Clear optimistic dismiss state once server confirms and 3s countdown expires
  useEffect(() => {
    if (dismissedIds.size === 0) return;
    const now = Date.now();
    const ready = new Set<string>();
    let earliestDelay = Infinity;
    for (const id of dismissedIds) {
      const c = comments.find((c) => c.id === id);
      if (!c || c.status !== "hidden") continue;
      const elapsed = now - (dismissedAtRef.current.get(id) ?? 0);
      if (elapsed >= 3000) {
        ready.add(id);
      } else {
        earliestDelay = Math.min(earliestDelay, 3000 - elapsed);
      }
    }
    if (ready.size > 0) {
      setDismissedIds((prev) => {
        const next = new Set(prev);
        for (const id of ready) {
          next.delete(id);
          dismissedAtRef.current.delete(id);
        }
        return next;
      });
    }
    if (earliestDelay < Infinity) {
      const timer = setTimeout(() => {
        setDismissedIds((prev) => new Set(prev)); // trigger re-run
      }, earliestDelay);
      return () => clearTimeout(timer);
    }
  }, [comments, dismissedIds]);

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

  // Effective status accounts for optimistic dismiss/restore
  const effectiveStatus = (c: (typeof comments)[number]) => {
    if (dismissedIds.has(c.id)) return "hidden";
    if (restoredIds.has(c.id)) return "flagged";
    return c.status;
  };

  const filtered =
    filter === "all"
      ? comments
      : filter === "inbox"
        ? comments.filter((c) => {
            if (dismissedIds.has(c.id)) return true;
            const s = effectiveStatus(c);
            if (s !== "flagged" && s !== "pending") return false;
            if (c.replies?.some((r) => r.sent_at)) return false;
            if (c.replies?.some((r) => r.approved)) return false;
            return true;
          })
        : comments.filter((c) => effectiveStatus(c) === filter);

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
        {["inbox", "replied", "hidden", "all"].map((f) => {
          const label =
            f === "all"
              ? `All \u00B7 ${comments.length}`
              : f === "inbox"
                ? "Inbox"
                : f === "hidden"
                  ? "Dismissed"
                  : f;
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-full border text-xs font-medium cursor-pointer font-sans capitalize tracking-[0.02em] ${
                filter === f
                  ? "border-content bg-content text-white"
                  : "border-border bg-surface-card text-content-sub"
              }`}
            >
              {label}
            </button>
          );
        })}

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
            <CommentCard key={c.id} comment={c} isDismissed={dismissedIds.has(c.id)} profileBadge={resolveProfileBadge(c, profileIdMap, profileMap)} onDismiss={handleDismiss} onUndoDismiss={handleUndoDismiss} onRestore={handleRestore} onRefetch={refetchComments} />
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
                      <CommentCard key={c.id} comment={c} compact isDismissed={dismissedIds.has(c.id)} profileBadge={resolveProfileBadge(c, profileIdMap, profileMap)} onDismiss={handleDismiss} onUndoDismiss={handleUndoDismiss} onRestore={handleRestore} onRefetch={refetchComments} />
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
