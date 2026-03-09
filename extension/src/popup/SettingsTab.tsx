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

const COMING_SOON = new Set(["x", "linkedin", "youtube"]);

const P_LABEL: Record<string, string> = {
  instagram: "Instagram",
  threads: "Threads",
  x: "X",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
};

interface LinkedAccount {
  id: string;
  platform: Platform;
  username: string;
  enabled: boolean;
  profile_id: string;
}

interface Profile {
  id: string;
  name: string;
  color: string;
  linked_accounts: LinkedAccount[];
}

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
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(true);

  useEffect(() => {
    chrome.storage.local.get(
      ["settings", "side_panel_enabled"],
      (result) => {
        if (result.settings) setSettings(result.settings);
        if (result.side_panel_enabled !== undefined) setSidePanelEnabled(result.side_panel_enabled);
      }
    );

    // Fetch profiles with linked accounts
    async function fetchProfiles() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoadingProfiles(false); return; }

      const { data } = await supabase
        .from("profiles")
        .select("id, name, color, linked_accounts(id, platform, username, enabled, profile_id)")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });

      if (data) setProfiles(data as Profile[]);
      setLoadingProfiles(false);
    }

    fetchProfiles();
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

  const toggleAccountEnabled = async (accountId: string, currentEnabled: boolean) => {
    await supabase
      .from("linked_accounts")
      .update({ enabled: !currentEnabled })
      .eq("id", accountId);

    setProfiles((prev) =>
      prev.map((p) => ({
        ...p,
        linked_accounts: p.linked_accounts.map((a) =>
          a.id === accountId ? { ...a, enabled: !a.enabled } : a
        ),
      }))
    );
  };

  if (!settings) {
    return (
      <div style={{ padding: "16px", color: "#78746e", fontSize: "12px" }}>
        Loading...
      </div>
    );
  }

  const activePlatforms: Platform[] = ["instagram", "threads", "tiktok"];
  const comingSoonPlatforms: Platform[] = ["x", "linkedin", "youtube"];

  return (
    <div style={{ padding: "16px" }}>
      {/* Profiles & Linked Accounts */}
      <div style={{ marginBottom: "20px" }}>
        <label style={sectionLabel}>Profiles & Accounts</label>
        {loadingProfiles ? (
          <div style={{ fontSize: "12px", color: "#78746e" }}>Loading...</div>
        ) : profiles.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#78746e" }}>
            No profiles found. Set up profiles in the dashboard.
          </div>
        ) : (
          profiles.map((profile) => {
            const activeAccounts = profile.linked_accounts.filter(
              (a) => !COMING_SOON.has(a.platform)
            );
            return (
              <div
                key={profile.id}
                style={{
                  border: "1px solid #e9e6e0",
                  borderRadius: "8px",
                  padding: "10px 12px",
                  marginBottom: "8px",
                  backgroundColor: "#ffffff",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: activeAccounts.length > 0 ? "8px" : "0" }}>
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: profile.color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#1c1917" }}>
                    {profile.name}
                  </span>
                  <span style={{ fontSize: "10px", color: "#78746e", marginLeft: "auto" }}>
                    {activeAccounts.filter((a) => a.enabled && a.username).length} active
                  </span>
                </div>
                {activeAccounts.map((account) => (
                  <div
                    key={account.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 0",
                      borderTop: "1px solid #f4f2ef",
                    }}
                  >
                    <button
                      onClick={() => toggleAccountEnabled(account.id, account.enabled)}
                      style={{
                        position: "relative",
                        width: "28px",
                        height: "16px",
                        borderRadius: "9999px",
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: account.enabled && account.username ? "#1c1917" : "#e9e6e0",
                        transition: "background-color 0.15s",
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: "2px",
                          left: account.enabled && account.username ? "14px" : "2px",
                          width: "12px",
                          height: "12px",
                          borderRadius: "50%",
                          backgroundColor: "#ffffff",
                          transition: "left 0.15s",
                        }}
                      />
                    </button>
                    <Tag label={P_LABEL[account.platform] || account.platform} color={account.platform} />
                    {account.username ? (
                      <span style={{ fontSize: "11px", color: "#78746e" }}>
                        @{account.username}
                      </span>
                    ) : (
                      <span style={{ fontSize: "11px", color: "#a1a1aa", fontStyle: "italic" }}>
                        Not linked
                      </span>
                    )}
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>

      {/* Coming soon platforms */}
      <div style={{ marginBottom: "20px" }}>
        <label style={sectionLabel}>Coming Soon</label>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {comingSoonPlatforms.map((p) => (
            <span key={p} style={{ opacity: 0.4 }}>
              <Tag label={P_LABEL[p]} color={p} />
            </span>
          ))}
        </div>
      </div>

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
      </div>

      {/* Pricing */}
      <button
        onClick={() => chrome.tabs.create({ url: "http://localhost:3000/pricing" })}
        style={primaryBtn}
      >
        Pricing
      </button>

      {/* Open dashboard */}
      <button
        onClick={() => chrome.tabs.create({ url: "http://localhost:3000" })}
        style={secondaryBtn}
      >
        Open Dashboard
      </button>

      {/* Sign out */}
      <button
        onClick={async () => {
          await supabase.auth.signOut();
          chrome.runtime.sendMessage({ action: "AUTH_SESSION_CHANGED" });
        }}
        style={ghostBtn}
      >
        Sign Out
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

const primaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "10px",
  borderRadius: "8px",
  border: "1px solid #1c1917",
  backgroundColor: "#1c1917",
  color: "#ffffff",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const secondaryBtn: React.CSSProperties = {
  width: "100%",
  padding: "10px",
  marginTop: "8px",
  borderRadius: "8px",
  border: "1px solid #e9e6e0",
  backgroundColor: "#ffffff",
  color: "#1c1917",
  fontSize: "12px",
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
};

const ghostBtn: React.CSSProperties = {
  width: "100%",
  padding: "10px",
  marginTop: "8px",
  borderRadius: "8px",
  border: "1px solid #e9e6e0",
  backgroundColor: "transparent",
  color: "#78746e",
  fontSize: "12px",
  fontWeight: 500,
  cursor: "pointer",
  fontFamily: "inherit",
};
