import { useState, useEffect } from "react";
import InboxTab from "./InboxTab";
import SettingsTab from "./SettingsTab";

type TabId = "inbox" | "settings";

export default function App() {
  const [tab, setTab] = useState<TabId>("inbox");
  const [activeTabKey, setActiveTabKey] = useState(0);

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
    { id: "settings", label: "Settings" },
  ];

  return (
    <div
      style={{
        backgroundColor: "#f7f6f3",
        minHeight: "500px",
        fontFamily: "'DM Sans', sans-serif",
        color: "#1c1917",
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderBottom: "1px solid #e9e6e0",
          padding: "12px 16px",
        }}
      >
        <div style={{ fontSize: "15px", fontWeight: 600, color: "#1c1917", letterSpacing: "0.02em" }}>
          EngageAI
        </div>
        <div style={{ fontSize: "11px", color: "#d4d0ca" }}>
          AI-powered reply assistant
        </div>
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
      <div style={{ display: tab === "inbox" ? "block" : "none" }}><InboxTab key={activeTabKey} /></div>
      <div style={{ display: tab === "settings" ? "block" : "none" }}><SettingsTab /></div>
    </div>
  );
}
