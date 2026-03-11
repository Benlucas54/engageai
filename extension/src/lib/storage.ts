import type { ExtensionSettings } from "./types";

const DEFAULT_SETTINGS: ExtensionSettings = {
  active_platforms: ["instagram", "threads"],
  scan_interval_minutes: 5,
};

export async function getSettings(): Promise<ExtensionSettings> {
  const { settings } = await chrome.storage.local.get("settings");
  return settings || DEFAULT_SETTINGS;
}

export async function updateSettings(
  updates: Partial<ExtensionSettings>
): Promise<void> {
  const current = await getSettings();
  await chrome.storage.local.set({ settings: { ...current, ...updates } });
}

export async function getActiveProfileId(): Promise<string | null> {
  const { activeProfileId } = await chrome.storage.local.get("activeProfileId");
  return activeProfileId || null;
}

export async function saveActiveProfileId(id: string): Promise<void> {
  await chrome.storage.local.set({ activeProfileId: id });
}

export async function updateBadge(): Promise<void> {
  // Show pending suggestions count from Supabase (set externally)
  // For now just clear the badge
  chrome.action.setBadgeText({ text: "" });
  chrome.action.setBadgeBackgroundColor({ color: "#1c1917" });
}
