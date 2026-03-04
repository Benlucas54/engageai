import type { QueuedReply, ExtensionSettings } from "./types";

const DEFAULT_SETTINGS: ExtensionSettings = {
  batch_times: ["11:00", "16:00"],
  auto_threshold: "simple",
  active_platforms: ["instagram", "threads"],
  jitter_minutes: 15,
  scan_interval_minutes: 5,
};

export async function getQueue(): Promise<QueuedReply[]> {
  const { queue = [] } = await chrome.storage.local.get("queue");
  return queue;
}

export async function addToQueue(reply: QueuedReply): Promise<void> {
  const queue = await getQueue();
  queue.push(reply);
  await chrome.storage.local.set({ queue });
  await updateBadge();
}

export async function removeFromQueue(commentId: string): Promise<void> {
  const queue = await getQueue();
  await chrome.storage.local.set({
    queue: queue.filter((r) => r.comment_id !== commentId),
  });
  await updateBadge();
}

export async function updateQueueItem(
  commentId: string,
  updates: Partial<QueuedReply>
): Promise<void> {
  const queue = await getQueue();
  const idx = queue.findIndex((r) => r.comment_id === commentId);
  if (idx !== -1) {
    queue[idx] = { ...queue[idx], ...updates };
    await chrome.storage.local.set({ queue });
    await updateBadge();
  }
}

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

export async function updateBadge(): Promise<void> {
  const queue = await getQueue();
  const count = queue.filter((r) => r.status === "queued").length;
  chrome.action.setBadgeText({ text: count > 0 ? String(count) : "" });
  chrome.action.setBadgeBackgroundColor({ color: "#1c1917" });
}
