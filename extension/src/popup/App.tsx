import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { getActiveProfileId, saveActiveProfileId } from "../lib/storage";
import InboxTab from "./InboxTab";
import OutboundTab from "./OutboundTab";
import SettingsTab from "./SettingsTab";
import LoginScreen from "./LoginScreen";

type TabId = "inbox" | "outbound" | "settings";

interface Profile {
  id: string;
  name: string;
  color: string;
  is_default: boolean;
}

export default function App() {
  const [tab, setTab] = useState<TabId>("inbox");
  const [activeTabKey, setActiveTabKey] = useState(0);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Check session on mount + listen for auth changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Fetch profiles when authed
  useEffect(() => {
    if (!authed) return;

    async function fetchProfiles() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("id, name, color, is_default")
        .eq("user_id", user.id)
        .order("is_default", { ascending: false });

      if (data && data.length > 0) {
        setProfiles(data as Profile[]);

        const storedId = await getActiveProfileId();
        const match = data.find((p) => p.id === storedId);
        if (match) {
          setActiveProfileId(match.id);
        } else {
          const defaultProfile = data.find((p) => p.is_default) || data[0];
          setActiveProfileId(defaultProfile.id);
          saveActiveProfileId(defaultProfile.id);
        }
      }
    }

    fetchProfiles();
  }, [authed]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!profileDropdownOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [profileDropdownOpen]);

  // Refresh child tabs when user switches browser tabs or navigates
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout>;
    const handleTabChange = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => setActiveTabKey((k) => k + 1), 300);
    };
    chrome.tabs.onActivated.addListener(handleTabChange);
    const onUpdated = (_id: number, info: chrome.tabs.TabChangeInfo) => {
      if (info.url) handleTabChange();
    };
    chrome.tabs.onUpdated.addListener(onUpdated);
    return () => {
      clearTimeout(debounceTimer);
      chrome.tabs.onActivated.removeListener(handleTabChange);
      chrome.tabs.onUpdated.removeListener(onUpdated);
    };
  }, []);

  const tabs: { id: TabId; label: string }[] = [
    { id: "inbox", label: "Inbox" },
    { id: "outbound", label: "Outbound" },
    { id: "settings", label: "Settings" },
  ];

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || null;

  const handleSwitchProfile = (id: string) => {
    setActiveProfileId(id);
    saveActiveProfileId(id);
    setProfileDropdownOpen(false);
  };

  // Loading state while checking session
  if (authed === null) {
    return (
      <div
        style={{
          backgroundColor: "#f7f6f3",
          minHeight: "500px",
          fontFamily: "'DM Sans', sans-serif",
          color: "#78746e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: "12px",
        }}
      >
        Loading...
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "#f7f6f3",
        minHeight: "500px",
        fontFamily: "'DM Sans', sans-serif",
        color: "#1c1917",
      }}
    >
      {!authed ? (
        <LoginScreen onLogin={() => {
          setAuthed(true);
          chrome.runtime.sendMessage({ action: "AUTH_SESSION_CHANGED" });
        }} />
      ) : (
        <>
          {/* Header */}
          <div
            style={{
              backgroundColor: "#ffffff",
              borderBottom: "1px solid #e9e6e0",
              padding: "12px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              position: "relative",
            }}
          >
            <div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: "#1c1917", letterSpacing: "0.02em" }}>
                EngageAI
              </div>
              <div style={{ fontSize: "11px", color: "#d4d0ca" }}>
                AI-powered reply assistant
              </div>
            </div>

            {activeProfile && (
              <div ref={dropdownRef} style={{ position: "relative" }}>
                <button
                  onClick={() => setProfileDropdownOpen((o) => !o)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: "50%",
                    backgroundColor: activeProfile.color,
                    border: "2px solid #e9e6e0",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0,
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#ffffff",
                    fontFamily: "inherit",
                  }}
                  title={activeProfile.name}
                >
                  {activeProfile.name.charAt(0).toUpperCase()}
                </button>

                {profileDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      right: 0,
                      width: 200,
                      backgroundColor: "#ffffff",
                      border: "1px solid #e9e6e0",
                      borderRadius: 8,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      zIndex: 100,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "10px 12px 6px",
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "#78746e",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      Switch Profile
                    </div>
                    {profiles.map((p) => {
                      const isActive = p.id === activeProfileId;
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleSwitchProfile(p.id)}
                          style={{
                            width: "100%",
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "8px 12px",
                            border: "none",
                            backgroundColor: isActive ? "#f7f6f3" : "transparent",
                            cursor: "pointer",
                            fontFamily: "inherit",
                            fontSize: "13px",
                            fontWeight: isActive ? 600 : 400,
                            color: "#1c1917",
                            textAlign: "left",
                          }}
                        >
                          <span
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: "50%",
                              backgroundColor: p.color,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: "10px",
                              fontWeight: 600,
                              color: "#ffffff",
                              flexShrink: 0,
                            }}
                          >
                            {p.name.charAt(0).toUpperCase()}
                          </span>
                          <span style={{ flex: 1 }}>{p.name}</span>
                          {isActive && (
                            <span
                              style={{
                                fontSize: "10px",
                                color: "#78746e",
                                fontWeight: 500,
                              }}
                            >
                              Active
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
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

          {/* Tab content */}
          <div style={{ display: tab === "inbox" ? "block" : "none" }}><InboxTab key={activeTabKey} profileId={activeProfileId} /></div>
          <div style={{ display: tab === "outbound" ? "block" : "none" }}><OutboundTab /></div>
          <div style={{ display: tab === "settings" ? "block" : "none" }}><SettingsTab /></div>
        </>
      )}
    </div>
  );
}
