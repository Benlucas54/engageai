import { useState, useEffect, useCallback, useRef } from "react";
import type { Platform, ScanResult } from "../lib/types";

const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  instagram: { bg: "#fdf0f8", text: "#8c3a6e", border: "#f0cee5" },
  threads: { bg: "#f0f0fd", text: "#3a3a8c", border: "#ceceee" },
  x: { bg: "#f2f2f2", text: "#555555", border: "#dddddd" },
  linkedin: { bg: "#f0f4fd", text: "#3a5e8c", border: "#c5d5f0" },
  tiktok: { bg: "#f0f0f0", text: "#1a1a1a", border: "#d0d0d0" },
  flagged: { bg: "#fdf6ec", text: "#92600a", border: "#f0ddb8" },
  replied: { bg: "#f0f7ee", text: "#4a7c59", border: "#cfe5c9" },
};

function Tag({ label, color }: { label: string; color: string }) {
  const c = TAG_COLORS[color] || TAG_COLORS.flagged;
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

type FilterMode = "all" | "suggestions" | "dismissed";

export default function InboxTab() {
  const [scanning, setScanning] = useState(false);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterMode>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dismissed, setDismissed] = useState<ScanResult[]>([]);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  const hasCacheRef = useRef(false);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    try {
      const response = await chrome.runtime.sendMessage({ action: "SCRAPE_CURRENT" });
      if (response.success) {
        setResults(response.results || []);
        setPlatform(response.platform);
      } else if (!hasCacheRef.current) {
        setError(response.error || "Scan failed");
      }
    } catch (err) {
      if (!hasCacheRef.current) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    }
    setScanning(false);
  }, []);

  // Two-phase load: cached data first, then background scrape
  useEffect(() => {
    chrome.runtime.sendMessage({ action: "LOAD_CACHED" }, (response) => {
      if (response?.success) {
        if (response.results?.length > 0) {
          setResults(response.results);
          setPlatform(response.platform);
          hasCacheRef.current = true;
        }
        setDismissed(response.dismissed || []);
      }
      setLoading(false);
      handleScan();
    });
  }, [handleScan]);

  const suggestionsReady = results.filter(
    (r) => r.comment.status === "flagged" && r.reply?.draft_text && !r.reply.sent_at
  ).length;
  const totalComments = results.length;

  const filtered = filter === "dismissed"
    ? dismissed
    : results.filter((r) => {
        if (filter === "suggestions") return r.reply?.draft_text && !r.reply.sent_at;
        return true;
      });

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  const handleDismiss = (id: string) => {
    const item = results.find((r) => r.comment.id === id);
    chrome.runtime.sendMessage({ action: "DISMISS_COMMENT", commentId: id }, (response) => {
      if (response?.success) {
        setResults((prev) => prev.filter((r) => r.comment.id !== id));
        if (item) setDismissed((prev) => [{ ...item, comment: { ...item.comment, status: "dismissed" } }, ...prev]);
      }
    });
  };

  const handleRestore = (id: string) => {
    const item = dismissed.find((r) => r.comment.id === id);
    chrome.runtime.sendMessage({ action: "RESTORE_COMMENT", commentId: id }, (response) => {
      if (response?.success) {
        setDismissed((prev) => prev.filter((r) => r.comment.id !== id));
        if (item) setResults((prev) => [{ ...item, comment: { ...item.comment, status: "flagged" } }, ...prev]);
      }
    });
  };

  const handleGenerate = async (commentExternalId: string) => {
    setGeneratingId(commentExternalId);
    setGenerateError(null);
    try {
      const response = await chrome.runtime.sendMessage({
        action: "GENERATE_SUGGESTION_FOR_COMMENT",
        commentExternalId,
      });
      if (response?.success && response.draftText) {
        setResults((prev) =>
          prev.map((r) =>
            r.comment.comment_external_id === commentExternalId
              ? { ...r, reply: { ...r.reply, draft_text: response.draftText } as any }
              : r
          )
        );
      } else {
        const msg = response?.error || "Generation failed";
        setGenerateError(msg);
        setGeneratingId("failed:" + commentExternalId);
        setTimeout(() => { setGeneratingId(null); setGenerateError(null); }, 4000);
        return;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Generation failed";
      setGenerateError(msg);
      setGeneratingId("failed:" + commentExternalId);
      setTimeout(() => { setGeneratingId(null); setGenerateError(null); }, 4000);
      return;
    }
    setGeneratingId(null);
  };

  return (
    <div style={{ padding: "16px" }}>
      {/* Platform badge */}
      <div style={{ fontSize: "12px", color: "#78746e", marginBottom: "12px" }}>
        {platform ? (
          <>Browsing <Tag label={platform} color={platform} /></>
        ) : (
          "Navigate to a social platform to get started"
        )}
      </div>

      {/* Stats row */}
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
            {suggestionsReady}
          </div>
          <div style={{ fontSize: "10px", color: "#92600a", opacity: 0.7 }}>
            Suggestions
          </div>
        </div>
        <div style={{
          flex: 1,
          backgroundColor: "#f0f7fd",
          border: "1px solid #c5dff0",
          borderRadius: "8px",
          padding: "10px 12px",
          textAlign: "center",
        }}>
          <div style={{ fontSize: "20px", fontWeight: 600, color: "#3a6e8c" }}>
            {totalComments}
          </div>
          <div style={{ fontSize: "10px", color: "#3a6e8c", opacity: 0.7 }}>
            Comments
          </div>
        </div>
      </div>

      {/* Scan button */}
      <button
        onClick={handleScan}
        disabled={scanning}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: "8px",
          border: "none",
          backgroundColor: "#1c1917",
          color: "#fff",
          fontSize: "13px",
          fontWeight: 600,
          cursor: scanning ? "not-allowed" : "pointer",
          opacity: scanning ? 0.6 : 1,
          fontFamily: "inherit",
          marginBottom: "12px",
        }}
      >
        {scanning ? "Scanning..." : "Scan Now"}
      </button>

      {/* Error banner */}
      {error && (
        <div style={{
          color: "#8c3a3a",
          backgroundColor: "#fdf0f0",
          border: "1px solid #f0cece",
          borderRadius: "6px",
          padding: "10px 12px",
          fontSize: "12px",
          marginBottom: "12px",
        }}>
          {error}
        </div>
      )}

      {/* Filter bar */}
      <div style={{
        display: "flex",
        gap: "0",
        backgroundColor: "#f0eeeb",
        borderRadius: "6px",
        padding: "2px",
        marginBottom: "12px",
      }}>
        {(["all", "suggestions", "dismissed"] as FilterMode[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              flex: 1,
              padding: "5px 10px",
              borderRadius: "4px",
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: "11px",
              fontWeight: filter === f ? 600 : 500,
              backgroundColor: filter === f ? "#ffffff" : "transparent",
              color: filter === f ? "#1c1917" : "#78746e",
              boxShadow: filter === f ? "0 1px 2px rgba(0,0,0,0.08)" : "none",
            }}
          >
            {f === "all" ? "All" : f === "suggestions" ? "Suggestions" : "Dismissed"}
          </button>
        ))}
      </div>

      {/* Loading state */}
      {loading && results.length === 0 && (
        <div style={{ color: "#78746e", fontSize: "12px", textAlign: "center", padding: "24px 0" }}>
          Loading...
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div style={{
          color: "#78746e",
          fontSize: "12px",
          textAlign: "center",
          padding: "24px 0",
        }}>
          {filter === "dismissed" ? "No dismissed comments" : "No comments to show"}
        </div>
      )}

      {/* Comment cards */}
      {filtered.map((result) => {
        const hasSuggestion = !!result.reply?.draft_text;
        const isSent = !!result.reply?.sent_at;

        return (
          <div
            key={result.comment.id}
            style={{
              backgroundColor: "#ffffff",
              border: "1px solid #e9e6e0",
              borderRadius: "10px",
              padding: "12px",
              marginBottom: "10px",
              opacity: isSent ? 0.6 : 1,
            }}
          >
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "6px",
            }}>
              <span style={{ fontWeight: 600, fontSize: "12px", color: "#1c1917" }}>
                @{result.comment.username}
              </span>
              <div style={{ display: "flex", gap: "4px" }}>
                <Tag label={result.comment.platform} color={result.comment.platform} />
                {isSent && <Tag label="replied" color="replied" />}
                {!isSent && hasSuggestion && <Tag label="suggestion" color="flagged" />}
              </div>
            </div>

            <p style={{
              fontSize: "12px",
              color: "#1c1917",
              marginBottom: "8px",
              lineHeight: "1.4",
            }}>
              {result.comment.comment_text}
            </p>

            {result.reply && (
              <div style={{
                backgroundColor: "#f7f6f3",
                borderRadius: "7px",
                padding: "8px 10px",
                marginBottom: "8px",
              }}>
                <p style={{
                  fontSize: "11px",
                  color: "#78746e",
                  marginBottom: "4px",
                  fontWeight: 500,
                }}>
                  {isSent ? "Sent:" : "AI suggestion:"}
                </p>
                <p style={{ fontSize: "12px", color: "#1c1917", lineHeight: "1.4" }}>
                  {result.reply.draft_text || result.reply.reply_text}
                </p>
              </div>
            )}

            {result.comment.status === "dismissed" ? (
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => handleRestore(result.comment.id)}
                  style={{
                    padding: "5px 14px",
                    borderRadius: "6px",
                    border: "1px solid #e9e6e0",
                    backgroundColor: "#fff",
                    color: "#555",
                    fontSize: "11px",
                    fontWeight: 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  Restore
                </button>
              </div>
            ) : !isSent && (
              <div style={{ display: "flex", gap: "6px" }}>
                {hasSuggestion ? (
                  <button
                    onClick={() => handleCopy(result.comment.id, result.reply!.draft_text || result.reply!.reply_text)}
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
                    {copiedId === result.comment.id ? "Copied!" : "Copy reply"}
                  </button>
                ) : (
                  <>
                    <button
                      onClick={() => handleGenerate(result.comment.comment_external_id)}
                      disabled={generatingId === result.comment.comment_external_id}
                      style={{
                        padding: "5px 14px",
                        borderRadius: "6px",
                        border: "none",
                        backgroundColor: "#1c1917",
                        color: "#fff",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: generatingId === result.comment.comment_external_id ? "not-allowed" : "pointer",
                        opacity: generatingId === result.comment.comment_external_id ? 0.6 : 1,
                        fontFamily: "inherit",
                      }}
                    >
                      {generatingId === result.comment.comment_external_id
                        ? "Generating..."
                        : generatingId === "failed:" + result.comment.comment_external_id
                          ? "Failed"
                          : "Generate"}
                    </button>
                    {generatingId === "failed:" + result.comment.comment_external_id && generateError && (
                      <span style={{ color: "#c53030", fontSize: "10px" }}>
                        {generateError}
                      </span>
                    )}
                  </>
                )}
                {result.comment.post_url && (
                  <button
                    onClick={() => {
                      chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
                        if (tabs[0]?.id) {
                          chrome.tabs.update(tabs[0].id, { url: result.comment.post_url });
                        } else {
                          chrome.tabs.create({ url: result.comment.post_url });
                        }
                      });
                    }}
                    style={{
                      padding: "5px 14px",
                      borderRadius: "6px",
                      border: "1px solid #e9e6e0",
                      backgroundColor: "#fff",
                      color: "#555",
                      fontSize: "11px",
                      fontWeight: 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                    }}
                  >
                    View
                  </button>
                )}
                <button
                  onClick={() => handleDismiss(result.comment.id)}
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
            )}
          </div>
        );
      })}
    </div>
  );
}
