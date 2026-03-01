import { useState, useEffect, useCallback } from "react";
import { supabase } from "../lib/supabase";
import type {
  Platform,
  QueuedReply,
  ExtensionSettings,
  ScanResult,
  VoiceSettings,
} from "../lib/types";

// --- Inline UI components ---

const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> =
  {
    instagram: {
      bg: "#fdf0f8",
      text: "#8c3a6e",
      border: "#f0cee5",
    },
    threads: {
      bg: "#f0f0fd",
      text: "#3a3a8c",
      border: "#ceceee",
    },
    x: {
      bg: "#f2f2f2",
      text: "#555555",
      border: "#dddddd",
    },
    linkedin: {
      bg: "#f0f4fd",
      text: "#3a5e8c",
      border: "#c5d5f0",
    },
    pending: {
      bg: "#f0f7fd",
      text: "#3a6e8c",
      border: "#c5dff0",
    },
    flagged: {
      bg: "#fdf6ec",
      text: "#92600a",
      border: "#f0ddb8",
    },
    replied: {
      bg: "#f0f7ee",
      text: "#4a7c59",
      border: "#cfe5c9",
    },
    queued: {
      bg: "#f0f7fd",
      text: "#3a6e8c",
      border: "#c5dff0",
    },
    sent: {
      bg: "#f0f7ee",
      text: "#4a7c59",
      border: "#cfe5c9",
    },
    failed: {
      bg: "#fdf0f0",
      text: "#8c3a3a",
      border: "#f0cece",
    },
  };

function Tag({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  const c = TAG_COLORS[color] || TAG_COLORS.pending;
  return (
    <span
      style={{
        backgroundColor: c.bg,
        color: c.text,
        border: `1px solid ${c.border}`,
        padding: "2px 8px",
        borderRadius: "4px",
        fontSize: "11px",
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function Btn({
  children,
  variant = "primary",
  size = "sm",
  onClick,
  disabled,
  style,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  onClick?: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const base: React.CSSProperties = {
    border: "1px solid",
    borderRadius: "6px",
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    fontFamily: "inherit",
    letterSpacing: "0.02em",
    whiteSpace: "nowrap",
    opacity: disabled ? 0.5 : 1,
    ...(size === "sm"
      ? { padding: "5px 14px", fontSize: "11px" }
      : { padding: "8px 18px", fontSize: "12px" }),
  };

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      backgroundColor: "#1c1917",
      color: "#ffffff",
      borderColor: "#1c1917",
    },
    secondary: {
      backgroundColor: "#ffffff",
      color: "#1c1917",
      borderColor: "#e9e6e0",
    },
    ghost: {
      backgroundColor: "transparent",
      color: "#78746e",
      borderColor: "transparent",
    },
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
    >
      {children}
    </button>
  );
}

// --- Tabs ---

type TabId = "scan" | "queue" | "settings";

function ScanTab() {
  const [scanning, setScanning] = useState(false);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editText, setEditText] = useState("");
  const [hasScanned, setHasScanned] = useState(false);

  const handleScan = useCallback(async () => {
    setScanning(true);
    setError(null);
    setResults([]);
    try {
      const response = await chrome.runtime.sendMessage({
        action: "SCRAPE_CURRENT",
      });
      if (response.success) {
        setResults(response.results || []);
        setPlatform(response.platform);
      } else {
        setError(response.error || "Scan failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
    setScanning(false);
    setHasScanned(true);
  }, []);

  // Auto-scan when popup opens
  useEffect(() => {
    handleScan();
  }, [handleScan]);

  const handleApprove = async (result: ScanResult, text?: string) => {
    if (!result.reply) return;
    await chrome.runtime.sendMessage({
      action: "APPROVE_REPLY",
      commentId: result.comment.id,
      replyId: result.reply.id,
      replyText: text || result.reply.reply_text,
      comment: {
        comment_external_id: result.comment.comment_external_id,
        platform: result.comment.platform,
        post_url: result.comment.post_url,
        username: result.comment.username,
        comment_text: result.comment.comment_text,
      },
    });
    setResults((prev) =>
      prev.filter((r) => r.comment.id !== result.comment.id)
    );
    setEditingIdx(null);
  };

  const handleSkip = (result: ScanResult) => {
    setResults((prev) =>
      prev.filter((r) => r.comment.id !== result.comment.id)
    );
  };

  return (
    <div style={{ padding: "16px" }}>
      {platform && (
        <div style={{ marginBottom: "12px" }}>
          <Tag label={platform} color={platform} />
        </div>
      )}

      <Btn
        variant="primary"
        size="md"
        onClick={handleScan}
        disabled={scanning}
        style={{ width: "100%", marginBottom: "16px" }}
      >
        {scanning ? "Scanning..." : "Scan this page"}
      </Btn>

      {error && (
        <div
          style={{
            color: "#8c3a3a",
            backgroundColor: "#fdf0f0",
            border: "1px solid #f0cece",
            borderRadius: "6px",
            padding: "10px 12px",
            fontSize: "12px",
            marginBottom: "12px",
          }}
        >
          {error}
        </div>
      )}

      {results.length === 0 && !scanning && !error && (
        <div
          style={{
            color: "#78746e",
            fontSize: "12px",
            textAlign: "center",
            padding: "24px 0",
          }}
        >
          {hasScanned
            ? "No new comments found"
            : 'Navigate to a social media post and click "Scan this page"'}
        </div>
      )}

      {results.map((result, idx) => (
        <div
          key={result.comment.id}
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e9e6e0",
            borderRadius: "8px",
            padding: "12px",
            marginBottom: "10px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "8px",
            }}
          >
            <span
              style={{
                fontWeight: 600,
                fontSize: "12px",
                color: "#1c1917",
              }}
            >
              @{result.comment.username}
            </span>
            <Tag label={result.status} color={result.status === "auto-approved" ? "replied" : result.status} />
          </div>

          <p
            style={{
              fontSize: "12px",
              color: "#1c1917",
              marginBottom: "8px",
              lineHeight: "1.4",
            }}
          >
            {result.comment.comment_text}
          </p>

          {result.reply && (
            <div
              style={{
                backgroundColor: "#f7f6f3",
                borderRadius: "6px",
                padding: "8px 10px",
                marginBottom: "8px",
              }}
            >
              <p
                style={{
                  fontSize: "11px",
                  color: "#78746e",
                  marginBottom: "4px",
                  fontWeight: 500,
                }}
              >
                Draft reply:
              </p>
              {editingIdx === idx ? (
                <textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  style={{
                    width: "100%",
                    fontSize: "12px",
                    border: "1px solid #e9e6e0",
                    borderRadius: "4px",
                    padding: "6px",
                    resize: "vertical",
                    minHeight: "50px",
                    fontFamily: "inherit",
                  }}
                />
              ) : (
                <p style={{ fontSize: "12px", color: "#1c1917", lineHeight: "1.4" }}>
                  {result.reply.reply_text}
                </p>
              )}
            </div>
          )}

          {result.status === "flagged" && result.reply && (
            <div
              style={{
                display: "flex",
                gap: "6px",
              }}
            >
              {editingIdx === idx ? (
                <>
                  <Btn
                    variant="primary"
                    size="sm"
                    onClick={() => handleApprove(result, editText)}
                  >
                    Save & Approve
                  </Btn>
                  <Btn
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingIdx(null)}
                  >
                    Cancel
                  </Btn>
                </>
              ) : (
                <>
                  <Btn
                    variant="primary"
                    size="sm"
                    onClick={() => handleApprove(result)}
                  >
                    Approve
                  </Btn>
                  <Btn
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditingIdx(idx);
                      setEditText(result.reply!.reply_text);
                    }}
                  >
                    Edit
                  </Btn>
                  <Btn
                    variant="ghost"
                    size="sm"
                    onClick={() => handleSkip(result)}
                  >
                    Skip
                  </Btn>
                </>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function QueueTab() {
  const [queue, setQueue] = useState<QueuedReply[]>([]);

  useEffect(() => {
    chrome.storage.local.get("queue", ({ queue: q }) => setQueue(q || []));
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string
    ) => {
      if (area === "local" && changes.queue) {
        setQueue(changes.queue.newValue || []);
      }
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  const queued = queue.filter((r) => r.status === "queued");
  const sent = queue.filter((r) => r.status === "sent");

  const handleSendNow = async (item: QueuedReply) => {
    await chrome.runtime.sendMessage({ action: "SEND_NOW", item });
  };

  const handleRemove = async (commentId: string) => {
    await chrome.runtime.sendMessage({
      action: "REMOVE_FROM_QUEUE",
      commentId,
    });
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <div style={{ padding: "16px" }}>
      {queued.length === 0 && sent.length === 0 && (
        <div
          style={{
            color: "#78746e",
            fontSize: "12px",
            textAlign: "center",
            padding: "24px 0",
          }}
        >
          No replies in the queue
        </div>
      )}

      {queued.length > 0 && (
        <>
          <h3
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "#78746e",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "10px",
            }}
          >
            Queued ({queued.length})
          </h3>
          {queued.map((item) => (
            <div
              key={item.comment_id}
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e9e6e0",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "10px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "6px",
                }}
              >
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <Tag label={item.platform} color={item.platform} />
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#1c1917" }}>
                    @{item.username}
                  </span>
                </div>
                <span style={{ fontSize: "11px", color: "#78746e" }}>
                  {formatTime(item.scheduled_for)}
                </span>
              </div>
              <p style={{ fontSize: "12px", color: "#1c1917", marginBottom: "8px", lineHeight: "1.4" }}>
                {item.reply_text}
              </p>
              <div style={{ display: "flex", gap: "6px" }}>
                <Btn variant="primary" size="sm" onClick={() => handleSendNow(item)}>
                  Send now
                </Btn>
                <Btn variant="ghost" size="sm" onClick={() => handleRemove(item.comment_id)}>
                  Remove
                </Btn>
              </div>
            </div>
          ))}
        </>
      )}

      {sent.length > 0 && (
        <>
          <h3
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "#78746e",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "10px",
              marginTop: queued.length > 0 ? "16px" : 0,
            }}
          >
            Recently Sent
          </h3>
          {sent.map((item) => (
            <div
              key={item.comment_id}
              style={{
                backgroundColor: "#ffffff",
                border: "1px solid #e9e6e0",
                borderRadius: "8px",
                padding: "12px",
                marginBottom: "10px",
                opacity: 0.7,
              }}
            >
              <div style={{ display: "flex", gap: "6px", alignItems: "center", marginBottom: "4px" }}>
                <Tag label={item.platform} color={item.platform} />
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#1c1917" }}>
                  @{item.username}
                </span>
                <span style={{ color: "#4a7c59", fontSize: "12px" }}>&#10003;</span>
              </div>
              <p style={{ fontSize: "12px", color: "#78746e", lineHeight: "1.4" }}>
                {item.reply_text}
              </p>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function SettingsTab() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [threshold, setThreshold] = useState<string>("");

  useEffect(() => {
    chrome.storage.local.get("settings", ({ settings: s }) => {
      if (s) setSettings(s);
    });
    supabase
      .from("voice_settings")
      .select("auto_threshold")
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) setThreshold(data.auto_threshold);
      });
  }, []);

  const updateSetting = (key: keyof ExtensionSettings, value: unknown) => {
    if (!settings) return;
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    chrome.runtime.sendMessage({
      action: "UPDATE_SETTINGS",
      settings: { [key]: value },
    });
  };

  const togglePlatform = (p: Platform) => {
    if (!settings) return;
    const platforms = settings.active_platforms.includes(p)
      ? settings.active_platforms.filter((x) => x !== p)
      : [...settings.active_platforms, p];
    updateSetting("active_platforms", platforms);
  };

  if (!settings) {
    return (
      <div style={{ padding: "16px", color: "#78746e", fontSize: "12px" }}>
        Loading...
      </div>
    );
  }

  const allPlatforms: Platform[] = ["instagram", "threads", "x", "linkedin"];

  return (
    <div style={{ padding: "16px" }}>
      {/* Auto-threshold (read-only from Supabase) */}
      <div style={{ marginBottom: "20px" }}>
        <label
          style={{
            display: "block",
            fontSize: "11px",
            fontWeight: 600,
            color: "#78746e",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "6px",
          }}
        >
          Auto-Approval Threshold
        </label>
        <div
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #e9e6e0",
            borderRadius: "6px",
            padding: "10px 12px",
            fontSize: "12px",
            color: "#1c1917",
          }}
        >
          {threshold || "—"}
          <span style={{ color: "#b5b0a8", marginLeft: "8px", fontSize: "11px" }}>
            (managed in dashboard)
          </span>
        </div>
      </div>

      {/* Batch times */}
      <div style={{ marginBottom: "20px" }}>
        <label
          style={{
            display: "block",
            fontSize: "11px",
            fontWeight: 600,
            color: "#78746e",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "6px",
          }}
        >
          Batch Times
        </label>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {settings.batch_times.map((time, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <input
                type="time"
                value={time}
                onChange={(e) => {
                  const times = [...settings.batch_times];
                  times[i] = e.target.value;
                  updateSetting("batch_times", times);
                }}
                style={{
                  border: "1px solid #e9e6e0",
                  borderRadius: "4px",
                  padding: "6px 8px",
                  fontSize: "12px",
                  fontFamily: "inherit",
                }}
              />
              {settings.batch_times.length > 1 && (
                <button
                  onClick={() => {
                    const times = settings.batch_times.filter((_, j) => j !== i);
                    updateSetting("batch_times", times);
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#b5b0a8",
                    cursor: "pointer",
                    fontSize: "14px",
                    padding: "2px",
                  }}
                >
                  &times;
                </button>
              )}
            </div>
          ))}
          <Btn
            variant="ghost"
            size="sm"
            onClick={() =>
              updateSetting("batch_times", [...settings.batch_times, "09:00"])
            }
          >
            + Add
          </Btn>
        </div>
      </div>

      {/* Jitter slider */}
      <div style={{ marginBottom: "20px" }}>
        <label
          style={{
            display: "block",
            fontSize: "11px",
            fontWeight: 600,
            color: "#78746e",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "6px",
          }}
        >
          Jitter: {settings.jitter_minutes} min
        </label>
        <input
          type="range"
          min="0"
          max="30"
          value={settings.jitter_minutes}
          onChange={(e) =>
            updateSetting("jitter_minutes", Number(e.target.value))
          }
          style={{ width: "100%", accentColor: "#1c1917" }}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "10px",
            color: "#b5b0a8",
          }}
        >
          <span>0 min</span>
          <span>30 min</span>
        </div>
      </div>

      {/* Platform toggles */}
      <div style={{ marginBottom: "20px" }}>
        <label
          style={{
            display: "block",
            fontSize: "11px",
            fontWeight: 600,
            color: "#78746e",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            marginBottom: "8px",
          }}
        >
          Active Platforms
        </label>
        {allPlatforms.map((p) => (
          <label
            key={p}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              marginBottom: "8px",
              fontSize: "12px",
              color: "#1c1917",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={settings.active_platforms.includes(p)}
              onChange={() => togglePlatform(p)}
              style={{ accentColor: "#1c1917" }}
            />
            <Tag label={p} color={p} />
          </label>
        ))}
      </div>

      {/* Open dashboard link */}
      <Btn
        variant="secondary"
        size="md"
        style={{ width: "100%" }}
        onClick={() => chrome.tabs.create({ url: "http://localhost:3000" })}
      >
        Open Dashboard
      </Btn>
    </div>
  );
}

// --- Main App ---

export default function App() {
  const [tab, setTab] = useState<TabId>("scan");

  const tabs: { id: TabId; label: string }[] = [
    { id: "scan", label: "Scan" },
    { id: "queue", label: "Queue" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div
      style={{
        backgroundColor: "#f7f6f3",
        minHeight: "500px",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        color: "#1c1917",
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: "#1c1917",
          color: "#ffffff",
          padding: "12px 16px",
          fontSize: "14px",
          fontWeight: 600,
          letterSpacing: "0.02em",
        }}
      >
        EngageAI
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid #e9e6e0",
          backgroundColor: "#ffffff",
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex: 1,
              padding: "10px",
              fontSize: "12px",
              fontWeight: tab === t.id ? 600 : 400,
              color: tab === t.id ? "#1c1917" : "#78746e",
              backgroundColor: "transparent",
              border: "none",
              borderBottom:
                tab === t.id ? "2px solid #1c1917" : "2px solid transparent",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content — use display:none to preserve state across tab switches */}
      <div style={{ display: tab === "scan" ? "block" : "none" }}><ScanTab /></div>
      <div style={{ display: tab === "queue" ? "block" : "none" }}><QueueTab /></div>
      <div style={{ display: tab === "settings" ? "block" : "none" }}><SettingsTab /></div>
    </div>
  );
}
