"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useOutboundPosts } from "@/hooks/useOutboundPosts";
import { useProfiles } from "@/hooks/useProfiles";
import { buildPlatformProfileMap } from "@/lib/profileLookup";
import { P_LABEL, ACTIVE_PLATFORMS } from "@/lib/constants";
import { Tag } from "@/components/ui/Tag";
import { Btn } from "@/components/ui/Btn";
import { Card } from "@/components/ui/Card";
import { MiniLabel } from "@/components/ui/MiniLabel";
import { Divider } from "@/components/ui/Divider";
import { OutboundPostCard } from "./OutboundPostCard";
import type { OutboundPost } from "@/lib/types";

function detectPlatform(url: string): OutboundPost["platform"] | null {
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("threads.net") || url.includes("threads.com")) return "threads";
  if (url.includes("x.com") || url.includes("twitter.com")) return "x";
  if (url.includes("linkedin.com")) return "linkedin";
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  return null;
}

type PlatformFilter = "all" | OutboundPost["platform"];

export function OutboundView() {
  const { posts, refetch } = useOutboundPosts();
  const { profiles } = useProfiles();
  const profileMap = useMemo(() => buildPlatformProfileMap(profiles), [profiles]);
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>("all");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [done, setDone] = useState<OutboundPost[]>([]);

  // URL paste form state
  const [showForm, setShowForm] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [captionInput, setCaptionInput] = useState("");
  const [authorInput, setAuthorInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [detectedPlatform, setDetectedPlatform] = useState<OutboundPost["platform"] | null>(null);

  function handleUrlChange(url: string) {
    setUrlInput(url);
    const p = detectPlatform(url);
    setDetectedPlatform(p);
    if (p && !showForm) setShowForm(true);
  }

  async function handleAdd() {
    if (!detectedPlatform || !urlInput.trim()) return;
    setSubmitting(true);
    try {
      await fetch("/api/outbound-posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: detectedPlatform,
          post_url: urlInput.trim(),
          post_author: authorInput.trim() || null,
          post_caption: captionInput.trim() || null,
          source: "manual",
        }),
      });
      setUrlInput("");
      setCaptionInput("");
      setAuthorInput("");
      setShowForm(false);
      setDetectedPlatform(null);
      refetch();
    } finally {
      setSubmitting(false);
    }
  }

  const active = useMemo(() => {
    const doneIds = new Set(done.map((d) => d.id));
    return posts
      .filter((p) => p.status !== "dismissed" && p.status !== "copied" && !doneIds.has(p.id))
      .filter((p) => platformFilter === "all" || p.platform === platformFilter);
  }, [posts, platformFilter, done]);

  // Keep selectedIdx in bounds
  useEffect(() => {
    if (selectedIdx >= active.length) setSelectedIdx(Math.max(0, active.length - 1));
  }, [active.length, selectedIdx]);

  const handleUpdate = useCallback((updated: OutboundPost) => {
    refetch();
  }, [refetch]);

  const handleDismiss = useCallback((updated: OutboundPost) => {
    refetch();
  }, [refetch]);

  const handleCopied = useCallback((updated: OutboundPost) => {
    setDone((p) => [...p, updated]);
    refetch();
  }, [refetch]);

  // Platform tabs
  const platformTabs: { key: PlatformFilter; label: string }[] = [
    { key: "all", label: "All" },
    ...Array.from(ACTIVE_PLATFORMS).map((p) => ({
      key: p as PlatformFilter,
      label: P_LABEL[p] || p,
    })),
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* URL paste bar */}
      <Card>
        <div className="flex gap-2 items-center">
          <input
            type="url"
            placeholder="Paste a post URL..."
            value={urlInput}
            onChange={(e) => handleUrlChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && detectedPlatform) {
                if (showForm && captionInput.trim()) handleAdd();
                else if (!showForm && detectedPlatform) setShowForm(true);
              }
            }}
            className="flex-1 bg-transparent text-sm text-content placeholder:text-content-faint outline-none"
          />
          {detectedPlatform && (
            <Tag type={detectedPlatform}>{P_LABEL[detectedPlatform]}</Tag>
          )}
        </div>
        {showForm && detectedPlatform && (
          <div className="mt-3 flex flex-col gap-2">
            <input
              type="text"
              placeholder="Post author (e.g. @username)"
              value={authorInput}
              onChange={(e) => setAuthorInput(e.target.value)}
              className="bg-surface rounded-md px-3 py-2 text-sm text-content placeholder:text-content-faint outline-none"
            />
            <textarea
              placeholder="Post caption / content (paste or type the text of the post)"
              value={captionInput}
              onChange={(e) => setCaptionInput(e.target.value)}
              rows={3}
              className="bg-surface rounded-md px-3 py-2 text-sm text-content placeholder:text-content-faint outline-none resize-none"
            />
            <div className="flex gap-2">
              <Btn size="sm" onClick={handleAdd} disabled={submitting}>
                {submitting ? "Adding..." : "Add post"}
              </Btn>
              <Btn
                size="sm"
                variant="secondary"
                onClick={() => {
                  setShowForm(false);
                  setUrlInput("");
                  setCaptionInput("");
                  setAuthorInput("");
                  setDetectedPlatform(null);
                }}
              >
                Cancel
              </Btn>
            </div>
          </div>
        )}
      </Card>

      {/* Platform filter tabs */}
      <div className="flex gap-1">
        {platformTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setPlatformFilter(tab.key)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium cursor-pointer transition-colors ${
              platformFilter === tab.key
                ? "bg-content text-white"
                : "bg-surface text-content-faint hover:text-content"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Empty state */}
      {active.length === 0 && done.length === 0 && (
        <Card className="text-center py-[60px] px-6">
          <div className="text-[13px] text-content-faint">
            No outbound posts yet. Paste a URL above or use the extension overlay to capture posts.
          </div>
        </Card>
      )}

      {/* Post list */}
      {active.map((post, idx) => (
        <OutboundPostCard
          key={post.id}
          post={post}
          isSelected={idx === selectedIdx}
          profileBadge={profileMap?.get(post.platform) ?? null}
          onSelect={() => setSelectedIdx(idx)}
          onUpdate={(updated) => {
            if (updated.status === "copied") {
              handleCopied(updated);
            } else {
              handleUpdate(updated);
            }
          }}
          onDismiss={handleDismiss}
        />
      ))}

      {/* Done this session */}
      {done.length > 0 && (
        <Card>
          <MiniLabel>Done this session</MiniLabel>
          <div className="mt-4">
            {done.map((p, i) => (
              <div key={p.id}>
                <div className="flex justify-between items-center py-3">
                  <div className="flex gap-2 items-center">
                    <span className="text-[13px] text-content-sub">
                      {p.post_author ? `@${p.post_author}` : p.post_url}
                    </span>
                    <Tag type={p.platform}>{P_LABEL[p.platform]}</Tag>
                  </div>
                  <Tag type="copied">Copied</Tag>
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
