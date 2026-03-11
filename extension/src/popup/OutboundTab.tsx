import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";

const P_LABEL: Record<string, string> = {
  instagram: "Instagram",
  threads: "Threads",
  x: "X",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
};

const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  instagram: { bg: "#fdf0f8", text: "#8c3a6e", border: "#f0cee5" },
  threads: { bg: "#f0f0fd", text: "#3a3a8c", border: "#ceceee" },
  x: { bg: "#f2f2f2", text: "#555555", border: "#dddddd" },
  linkedin: { bg: "#f0f4fd", text: "#3a5e8c", border: "#c5d5f0" },
  tiktok: { bg: "#f0f0f0", text: "#1a1a1a", border: "#d0d0d0" },
  pending: { bg: "#f0f7fd", text: "#3a6e8c", border: "#c5dff0" },
  generated: { bg: "#f0f7ee", text: "#4a7c59", border: "#cfe5c9" },
  copied: { bg: "#f0f7ee", text: "#4a7c59", border: "#cfe5c9" },
  manual: { bg: "#fdf6ec", text: "#92600a", border: "#f0ddb8" },
  extension: { bg: "#f0f0fd", text: "#3a3a8c", border: "#ceceee" },
};

function Tag({ label, color }: { label: string; color: string }) {
  const c = TAG_COLORS[color] || TAG_COLORS.pending;
  return (
    <span
      style={{
        backgroundColor: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        padding: "3px 10px",
        borderRadius: "9999px",
        fontSize: "11px",
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

interface OutboundPost {
  id: string;
  platform: string;
  post_url: string;
  post_author: string | null;
  post_caption: string | null;
  source: "manual" | "extension";
  status: "pending" | "generated" | "copied" | "dismissed";
  generated_comment: string | null;
  generated_at: string | null;
  created_at: string;
}

export default function OutboundTab() {
  const [posts, setPosts] = useState<OutboundPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedCaptions, setExpandedCaptions] = useState<Set<string>>(new Set());

  function toggleCaption(id: string) {
    setExpandedCaptions((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function fetchPosts() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("outbound_posts")
      .select("*")
      .eq("user_id", user.id)
      .not("status", "eq", "dismissed")
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) setPosts(data as OutboundPost[]);
    setLoading(false);
  }

  useEffect(() => {
    fetchPosts();

    // Realtime subscription
    const channel = supabase
      .channel("outbound-ext")
      .on("postgres_changes", { event: "*", schema: "public", table: "outbound_posts" }, () => {
        fetchPosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function handleGenerate(post: OutboundPost) {
    setGeneratingId(post.id);
    try {
      const result = await chrome.runtime.sendMessage({
        action: "GENERATE_OUTBOUND_COMMENT",
        platform: post.platform,
        postAuthor: post.post_author || "",
        postCaption: post.post_caption || "Post",
        postUrl: post.post_url,
      });

      if (result?.commentText) {
        fetchPosts();
      }
    } catch {
      // User can retry
    }
    setGeneratingId(null);
  }

  async function handleCopy(post: OutboundPost) {
    const text = post.generated_comment || "";
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(post.id);
    setTimeout(() => setCopiedId(null), 1500);

    // Open the post URL
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      if (tabs[0]?.id) {
        chrome.tabs.update(tabs[0].id, { url: post.post_url });
      } else {
        chrome.tabs.create({ url: post.post_url });
      }
    });

    // Mark as copied
    await supabase
      .from("outbound_posts")
      .update({ status: "copied", updated_at: new Date().toISOString() })
      .eq("id", post.id);

    fetchPosts();
  }

  async function handleDismiss(post: OutboundPost) {
    await supabase
      .from("outbound_posts")
      .update({ status: "dismissed", updated_at: new Date().toISOString() })
      .eq("id", post.id);

    setPosts((prev) => prev.filter((p) => p.id !== post.id));
  }

  const pending = posts.filter((p) => p.status === "pending" || p.status === "generated");
  const done = posts.filter((p) => p.status === "copied");

  return (
    <div style={{ padding: "16px" }}>
      {/* Stats */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
        <div style={{
          flex: 1,
          backgroundColor: "#fdf6ec",
          border: "1px solid #f0ddb8",
          borderRadius: "8px",
          padding: "10px 12px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "20px", fontWeight: 600, color: "#92600a" }}>
            {pending.length}
          </div>
          <div style={{ fontSize: "10px", color: "#92600a", opacity: 0.7 }}>
            Pending
          </div>
        </div>
        <div style={{
          flex: 1,
          backgroundColor: "#f0f7ee",
          border: "1px solid #cfe5c9",
          borderRadius: "8px",
          padding: "10px 12px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "20px", fontWeight: 600, color: "#4a7c59" }}>
            {done.length}
          </div>
          <div style={{ fontSize: "10px", color: "#4a7c59", opacity: 0.7 }}>
            Commented
          </div>
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ color: "#78746e", fontSize: "12px", textAlign: "center", padding: "24px 0" }}>
          Loading...
        </div>
      )}

      {/* Empty state */}
      {!loading && posts.length === 0 && (
        <div style={{
          color: "#78746e",
          fontSize: "12px",
          textAlign: "center",
          padding: "24px 0",
          lineHeight: "1.5",
        }}>
          No outbound posts yet.
          <br />
          Use the EngageAI button on a post to get started.
        </div>
      )}

      {/* Post cards */}
      {pending.map((post) => {
        const cleanAuthor = post.post_author
          ? post.post_author.split("\n")[0].trim()
          : "Unknown author";
        const caption = (post.post_caption || "").trim();
        const isLongCaption = caption.length > 150;
        const isExpanded = expandedCaptions.has(post.id);

        return (
        <div
          key={post.id}
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e9e6e0",
            borderRadius: "10px",
            padding: "12px",
            marginBottom: "10px",
          }}
        >
          {/* Row 1: author + tags */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: caption ? "4px" : "8px",
          }}>
            <span style={{
              fontWeight: 600,
              fontSize: "12px",
              color: "#1c1917",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              marginRight: "8px",
            }}>
              @{cleanAuthor}
            </span>
            <div style={{ display: "flex", gap: "4px", flexShrink: 0 }}>
              <Tag label={P_LABEL[post.platform] || post.platform} color={post.platform} />
            </div>
          </div>

          {/* Post caption */}
          {caption && (
            <div style={{ marginBottom: "8px" }}>
              <p style={{
                fontSize: "12px",
                color: "#1c1917",
                lineHeight: "1.45",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                margin: 0,
                ...(!isExpanded ? {
                  display: "-webkit-box",
                  WebkitLineClamp: 4,
                  WebkitBoxOrient: "vertical" as const,
                  overflow: "hidden",
                } : {}),
              }}>
                {caption}
              </p>
              {isLongCaption && (
                <button
                  onClick={() => toggleCaption(post.id)}
                  style={{
                    background: "none",
                    border: "none",
                    padding: "2px 0 0",
                    fontSize: "11px",
                    color: "#78746e",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  {isExpanded ? "Show less" : "Show more"}
                </button>
              )}
            </div>
          )}

          {post.generated_comment && (
            <div style={{
              borderLeft: "2px solid #d4d0ca",
              paddingLeft: "10px",
              marginBottom: "8px",
            }}>
              <p style={{
                fontSize: "10px",
                color: "#78746e",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: "3px",
                fontWeight: 500,
              }}>
                AI suggestion
              </p>
              <p style={{ fontSize: "12px", color: "#555", lineHeight: "1.45", margin: 0 }}>
                {post.generated_comment}
              </p>
            </div>
          )}

          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {post.generated_comment ? (
              <button
                onClick={() => handleCopy(post)}
                style={{
                  padding: "5px 14px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "#1c1917",
                  color: "#fff",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {copiedId === post.id ? "Copied!" : "Copy & open"}
              </button>
            ) : null}

            <button
              onClick={() => handleGenerate(post)}
              disabled={generatingId === post.id}
              style={{
                padding: "5px 14px",
                borderRadius: "6px",
                border: post.generated_comment ? "1px solid #e9e6e0" : "none",
                backgroundColor: post.generated_comment ? "#fff" : "#1c1917",
                color: post.generated_comment ? "#555" : "#fff",
                fontSize: "11px",
                fontWeight: post.generated_comment ? 500 : 600,
                cursor: generatingId === post.id ? "not-allowed" : "pointer",
                opacity: generatingId === post.id ? 0.6 : 1,
                fontFamily: "inherit",
              }}
            >
              {generatingId === post.id
                ? "Generating..."
                : post.generated_comment
                  ? "Regenerate"
                  : "Generate"}
            </button>

            <button
              onClick={() => handleDismiss(post)}
              style={{
                padding: "5px 14px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "transparent",
                color: "#78746e",
                fontSize: "11px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
        );
      })}

      {/* Done section */}
      {done.length > 0 && (
        <>
          <div style={{
            fontSize: "10px",
            fontWeight: 600,
            color: "#78746e",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            marginTop: "16px",
            marginBottom: "8px",
          }}>
            Commented
          </div>
          {done.map((post) => (
            <div
              key={post.id}
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e9e6e0",
                borderRadius: "10px",
                padding: "10px 12px",
                marginBottom: "8px",
                opacity: 0.7,
              }}
            >
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}>
                <span style={{ fontSize: "12px", color: "#555", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {post.post_author ? `@${post.post_author.split("\n")[0].trim()}` : post.post_url}
                </span>
                <div style={{ display: "flex", gap: "4px" }}>
                  <Tag label={P_LABEL[post.platform] || post.platform} color={post.platform} />
                  <Tag label="Copied" color="copied" />
                </div>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
