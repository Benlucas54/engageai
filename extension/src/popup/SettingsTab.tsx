import { useState, useEffect } from "react";
import { supabase } from "../lib/supabase";
import type { Platform, ExtensionSettings } from "../lib/types";

const TAG_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  instagram: { bg: "#fdf0f8", text: "#8c3a6e", border: "#f0cee5" },
  threads: { bg: "#f0f0fd", text: "#3a3a8c", border: "#ceceee" },
  x: { bg: "#f2f2f2", text: "#555555", border: "#dddddd" },
  linkedin: { bg: "#f0f4fd", text: "#3a5e8c", border: "#c5d5f0" },
  tiktok: { bg: "#f0f0f0", text: "#1a1a1a", border: "#d0d0d0" },
  youtube: { bg: "#fdf0f0", text: "#8c2020", border: "#f0c5c5" },
};

function Tag({ label, color }: { label: string; color: string }) {
  const c = TAG_COLORS[color] || TAG_COLORS.instagram;
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

export default function SettingsTab() {
  const [settings, setSettings] = useState<ExtensionSettings | null>(null);
  const [sidePanelEnabled, setSidePanelEnabled] = useState(true);
  const [inlineHelperEnabled, setInlineHelperEnabled] = useState(true);

  useEffect(() => {
    chrome.storage.local.get(
      ["settings", "side_panel_enabled", "inline_helper_enabled"],
      (result) => {
        if (result.settings) setSettings(result.settings);
        if (result.side_panel_enabled !== undefined) setSidePanelEnabled(result.side_panel_enabled);
        if (result.inline_helper_enabled !== undefined) setInlineHelperEnabled(result.inline_helper_enabled);
      }
    );
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

  const allPlatforms: Platform[] = ["instagram", "threads", "x", "linkedin", "tiktok", "youtube"];

  return (
    <div style={{ padding: "16px" }}>
      {/* Auto-scan frequency */}
      <div style={{ marginBottom: "20px" }}>
        <label style={sectionLabel}>Auto-Scan Frequency</label>
        <select
          value={settings.scan_interval_minutes || 5}
          onChange={(e) => updateSetting("scan_interval_minutes", Number(e.target.value))}
          style={selectStyle}
        >
          <option value={0}>Off</option>
          <option value={1}>Every 1 minute</option>
          <option value={2}>Every 2 minutes</option>
          <option value={5}>Every 5 minutes</option>
          <option value={10}>Every 10 minutes</option>
          <option value={15}>Every 15 minutes</option>
          <option value={30}>Every 30 minutes</option>
          <option value={60}>Every hour</option>
        </select>
      </div>

      {/* AI features */}
      <div style={{ marginBottom: "20px" }}>
        <label style={sectionLabel}>AI Features</label>
        <label style={checkboxRow}>
          <input
            type="checkbox"
            checked={sidePanelEnabled}
            onChange={(e) => {
              setSidePanelEnabled(e.target.checked);
              chrome.storage.local.set({ side_panel_enabled: e.target.checked });
            }}
            style={{ accentColor: "#1c1917" }}
          />
          Side panel assistant
        </label>
        <label style={checkboxRow}>
          <input
            type="checkbox"
            checked={inlineHelperEnabled}
            onChange={(e) => {
              setInlineHelperEnabled(e.target.checked);
              chrome.storage.local.set({ inline_helper_enabled: e.target.checked });
            }}
            style={{ accentColor: "#1c1917" }}
          />
          Inline reply suggestions
        </label>
      </div>

      {/* Platform toggles */}
      <div style={{ marginBottom: "20px" }}>
        <label style={sectionLabel}>Active Platforms</label>
        {allPlatforms.map((p) => (
          <label key={p} style={checkboxRow}>
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

      {/* Open dashboard */}
      <button
        onClick={() => chrome.tabs.create({ url: "http://localhost:3000" })}
        style={{
          width: "100%",
          padding: "10px",
          borderRadius: "8px",
          border: "1px solid #e9e6e0",
          backgroundColor: "#ffffff",
          color: "#1c1917",
          fontSize: "12px",
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
        }}
      >
        Open Dashboard
      </button>
    </div>
  );
}

const sectionLabel: React.CSSProperties = {
  display: "block",
  fontSize: "11px",
  fontWeight: 600,
  color: "#78746e",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: "8px",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  border: "1px solid #e9e6e0",
  borderRadius: "7px",
  padding: "10px 12px",
  fontSize: "12px",
  fontFamily: "inherit",
  color: "#1c1917",
  backgroundColor: "#ffffff",
  cursor: "pointer",
  appearance: "auto",
};

const checkboxRow: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginBottom: "8px",
  fontSize: "12px",
  color: "#1c1917",
  cursor: "pointer",
};
