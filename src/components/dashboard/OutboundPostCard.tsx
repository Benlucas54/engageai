"use client";

import { useState } from "react";
import { P_LABEL } from "@/lib/constants";
import { Tag } from "@/components/ui/Tag";
import { Btn } from "@/components/ui/Btn";
import { Card } from "@/components/ui/Card";
import { ProfileBadge } from "@/components/ui/ProfileBadge";
import type { OutboundPost } from "@/lib/types";

interface OutboundPostCardProps {
  post: OutboundPost;
  isSelected: boolean;
  profileBadge?: { name: string; color: string } | null;
  onSelect: () => void;
  onUpdate: (post?: OutboundPost) => void;
  onDismiss: (post?: OutboundPost) => void;
}

export function OutboundPostCard({
  post,
  isSelected,
  profileBadge,
  onSelect,
  onUpdate,
  onDismiss,
}: OutboundPostCardProps) {
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editedComment, setEditedComment] = useState<string | null>(null);

  const displayComment = editedComment ?? post.generated_comment ?? "";

  async function generate() {
    setGenerating(true);
    try {
      const res = await fetch("/api/generate-engagement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platform: post.platform,
          postAuthor: post.post_author || "",
          postCaption: post.post_caption || "",
          postUrl: post.post_url,
          existingComments: post.existing_comments || [],
          mediaType: post.media_type || null,
          hashtags: post.hashtags || [],
        }),
      });
      const data = await res.json();
      if (data.comment_text) {
        setEditedComment(data.comment_text);
        // Save to DB
        const patchRes = await fetch("/api/outbound-posts", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: post.id,
            generated_comment: data.comment_text,
            generated_at: new Date().toISOString(),
            status: "generated",
          }),
        });
        if (patchRes.ok) {
          const updated = await patchRes.json();
          onUpdate(updated);
        }
      }
    } catch {
      // User can retry
    } finally {
      setGenerating(false);
    }
  }

  async function copyText() {
    const text = displayComment;
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    // Update status
    const res = await fetch("/api/outbound-posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: post.id, status: "copied" }),
    });
    if (res.ok) {
      const updated = await res.json();
      onUpdate(updated);
    }
  }

  async function dismiss() {
    const res = await fetch("/api/outbound-posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: post.id, status: "dismissed" }),
    });
    if (res.ok) {
      const updated = await res.json();
      onDismiss(updated);
    }
  }

  async function saveEdit() {
    if (editedComment === null || editedComment === post.generated_comment) return;
    await fetch("/api/outbound-posts", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: post.id, generated_comment: editedComment }),
    });
  }

  return (
    <Card
      className={isSelected ? "ring-1 ring-content/20" : ""}
      onClick={onSelect}
    >
      <div className="flex justify-between items-center mb-3.5">
        <div className="flex gap-1.5 items-center">
          {post.post_author && (
            <span className="text-[13px] font-medium text-content">
              @{post.post_author}
            </span>
          )}
          <Tag type={post.platform}>{P_LABEL[post.platform]}</Tag>
          <Tag type={post.source}>{post.source === "extension" ? "Extension" : "Manual"}</Tag>
          {profileBadge && (
            <ProfileBadge name={profileBadge.name} color={profileBadge.color} />
          )}
        </div>
        {post.status === "generated" && <Tag type="generated">Generated</Tag>}
      </div>

      {post.post_caption && (
        <p className="mb-0 text-sm text-content leading-[1.65]">
          {post.post_caption.length > 200
            ? post.post_caption.slice(0, 200) + "..."
            : post.post_caption}
        </p>
      )}

      {displayComment && (
        <textarea
          className="mt-2.5 w-full text-[13px] text-content-sub leading-[1.65] pl-3 border-l-2 border-border bg-transparent resize-none outline-none"
          rows={3}
          value={displayComment}
          onChange={(e) => setEditedComment(e.target.value)}
          onBlur={saveEdit}
        />
      )}

      <div className="flex gap-1.5 items-center mt-3">
        {displayComment ? (
          <>
            <Btn size="sm" onClick={copyText}>
              {copied ? "Copied!" : "Copy"}
            </Btn>
            <Btn
              size="sm"
              variant="secondary"
              onClick={generate}
              disabled={generating}
            >
              {generating ? "Regenerating..." : "Regenerate"}
            </Btn>
          </>
        ) : (
          <Btn size="sm" onClick={generate} disabled={generating}>
            {generating ? "Generating..." : "Generate"}
          </Btn>
        )}
        <Btn size="sm" variant="secondary" onClick={dismiss}>
          Dismiss
        </Btn>
      </div>
    </Card>
  );
}
