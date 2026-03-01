import { supabase } from "../lib/supabase";
import {
  generateReply,
  getVoiceWithDocuments,
  detectFlagCondition,
} from "../lib/claude";
import {
  getQueue,
  addToQueue,
  updateQueueItem,
  removeFromQueue,
  getSettings,
  updateBadge,
} from "../lib/storage";
import type {
  Platform,
  ScrapedComment,
  QueuedReply,
  ScanResult,
} from "../lib/types";

const SPAM_KEYWORDS = [
  "follow4follow", "f4f", "follow me", "check out my page", "free followers",
  "dm for collab", "gain followers", "follow back", "followback", "s4s",
  "shoutout for shoutout", "like for like", "l4l", "check my profile",
  "click the link", "earn money", "make money fast", "crypto airdrop",
];

function isSpam(text: string): boolean {
  const lower = text.toLowerCase();
  return SPAM_KEYWORDS.some((kw) => lower.includes(kw));
}

function detectPlatform(url: string): Platform | null {
  if (url.includes("instagram.com")) return "instagram";
  if (url.includes("threads.net")) return "threads";
  if (url.includes("x.com")) return "x";
  if (url.includes("linkedin.com")) return "linkedin";
  return null;
}

async function deduplicateComments(
  comments: ScrapedComment[]
): Promise<ScrapedComment[]> {
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: existing } = await supabase
    .from("comments")
    .select("platform, username, comment_text")
    .gte("synced_at", sevenDaysAgo);

  const existingKeys = new Set(
    (existing || []).map(
      (c: { platform: string; username: string; comment_text: string }) =>
        `${c.platform}:${c.username}:${c.comment_text}`
    )
  );

  const seen = new Set<string>();
  return comments.filter((c) => {
    const key = `${c.platform}:${c.username}:${c.comment_text}`;
    if (existingKeys.has(key) || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getNextBatchTime(batchTimes: string[], jitterMinutes: number): number {
  const now = new Date();
  const today = now.toISOString().split("T")[0];

  const futureTimes = batchTimes
    .map((t) => new Date(`${today}T${t}:00`).getTime())
    .filter((t) => t > now.getTime());

  let baseTime: number;
  if (futureTimes.length > 0) {
    baseTime = Math.min(...futureTimes);
  } else {
    // Next day's first batch time
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];
    baseTime = new Date(`${tomorrowStr}T${batchTimes[0]}:00`).getTime();
  }

  const jitterMs = Math.random() * jitterMinutes * 60 * 1000;
  return baseTime + jitterMs;
}

// --- Message handlers ---

async function handleScrape(
  tabId: number,
  platform: Platform
): Promise<ScanResult[]> {
  // Send scrape message to content script
  const response = await chrome.tabs.sendMessage(tabId, { action: "SCRAPE" });
  if (!response?.success || !response.comments?.length) {
    return [];
  }

  const scraped: ScrapedComment[] = response.comments;

  // Deduplicate against Supabase
  const newComments = await deduplicateComments(scraped);
  if (newComments.length === 0) return [];

  // Get voice settings for reply generation
  const { voice, docContext } = await getVoiceWithDocuments();
  const settings = await getSettings();
  const results: ScanResult[] = [];

  for (const comment of newComments) {
    // Skip spam
    if (isSpam(comment.comment_text)) {
      await supabase.from("comments").insert({
        ...comment,
        status: "hidden",
        synced_at: new Date().toISOString(),
      });
      continue;
    }

    // X comments are force-flagged (monitor only)
    const forceFlag = platform === "x";

    // Insert comment
    const { data: inserted, error } = await supabase
      .from("comments")
      .insert({
        ...comment,
        status: forceFlag ? "flagged" : "pending",
        synced_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !inserted) continue;

    // Generate reply
    try {
      const replyText = await generateReply(comment, voice, docContext);
      const shouldFlag =
        forceFlag ||
        detectFlagCondition(comment.comment_text, voice.auto_threshold);

      const { data: reply } = await supabase
        .from("replies")
        .insert({
          comment_id: inserted.id,
          reply_text: replyText,
          draft_text: replyText,
          approved: !shouldFlag,
        })
        .select()
        .single();

      if (shouldFlag) {
        await supabase
          .from("comments")
          .update({ status: "flagged" })
          .eq("id", inserted.id);
        results.push({
          comment: { ...inserted, status: "flagged" },
          reply,
          status: "flagged",
        });
      } else {
        // Auto-approved — add to queue
        const scheduledFor = getNextBatchTime(
          settings.batch_times,
          settings.jitter_minutes
        );
        await addToQueue({
          comment_id: inserted.id,
          comment_external_id: comment.comment_external_id,
          reply_id: reply.id,
          reply_text: replyText,
          platform: comment.platform,
          post_url: comment.post_url,
          username: comment.username,
          comment_text: comment.comment_text,
          scheduled_for: scheduledFor,
          status: "queued",
        });
        results.push({
          comment: inserted,
          reply,
          status: "auto-approved",
        });
      }

      // Delay between API calls
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.error("Error generating reply:", err);
      await supabase
        .from("comments")
        .update({ status: "flagged" })
        .eq("id", inserted.id);
      results.push({ comment: inserted, status: "error" });
    }
  }

  return results;
}

async function handleApprove(
  commentId: string,
  replyId: string,
  replyText: string,
  comment: {
    comment_external_id: string;
    platform: Platform;
    post_url: string;
    username: string;
    comment_text: string;
  }
): Promise<void> {
  await supabase
    .from("replies")
    .update({ approved: true, reply_text: replyText })
    .eq("id", replyId);

  const settings = await getSettings();
  const scheduledFor = getNextBatchTime(
    settings.batch_times,
    settings.jitter_minutes
  );

  await addToQueue({
    comment_id: commentId,
    comment_external_id: comment.comment_external_id,
    reply_id: replyId,
    reply_text: replyText,
    platform: comment.platform,
    post_url: comment.post_url,
    username: comment.username,
    comment_text: comment.comment_text,
    scheduled_for: scheduledFor,
    status: "queued",
  });
}

async function runBatch(): Promise<void> {
  const queue = await getQueue();
  const now = Date.now();
  const due = queue.filter(
    (r) => r.scheduled_for <= now && r.status === "queued"
  );

  for (const item of due) {
    try {
      await updateQueueItem(item.comment_id, { status: "sending" });

      // Open a background tab to the post
      const tab = await chrome.tabs.create({
        url: item.post_url,
        active: false,
      });

      // Wait for tab to load
      await new Promise<void>((resolve) => {
        const listener = (
          tabId: number,
          info: chrome.tabs.TabChangeInfo
        ) => {
          if (tabId === tab.id && info.status === "complete") {
            chrome.tabs.onUpdated.removeListener(listener);
            resolve();
          }
        };
        chrome.tabs.onUpdated.addListener(listener);
      });

      // Wait a bit for content script to inject
      await new Promise((r) => setTimeout(r, 3000));

      // Send post reply message to content script
      const response = await chrome.tabs.sendMessage(tab.id!, {
        action: "POST_REPLY",
        payload: item,
      });

      if (response?.success) {
        await supabase
          .from("replies")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", item.reply_id);
        await supabase
          .from("comments")
          .update({ status: "replied" })
          .eq("id", item.comment_id);
        await updateQueueItem(item.comment_id, { status: "sent" });
      } else {
        await updateQueueItem(item.comment_id, { status: "failed" });
      }

      // Close the tab
      if (tab.id) await chrome.tabs.remove(tab.id);

      // Humanised delay between replies (8-20 seconds)
      await new Promise((r) =>
        setTimeout(r, 8000 + Math.random() * 12000)
      );
    } catch (err) {
      console.error("Error in batch send:", err);
      await updateQueueItem(item.comment_id, { status: "failed" });
    }
  }

  // Remove sent items from queue
  const updatedQueue = await getQueue();
  await chrome.storage.local.set({
    queue: updatedQueue.filter((r) => r.status !== "sent"),
  });
  await updateBadge();
}

function scheduleBatchAlarms(): void {
  chrome.alarms.clearAll();
  getSettings().then((settings) => {
    for (const time of settings.batch_times) {
      const [hours, minutes] = time.split(":").map(Number);
      const now = new Date();
      const alarmTime = new Date();
      alarmTime.setHours(hours, minutes, 0, 0);

      if (alarmTime.getTime() <= now.getTime()) {
        alarmTime.setDate(alarmTime.getDate() + 1);
      }

      const jitterMs = Math.random() * settings.jitter_minutes * 60 * 1000;
      const delayMs = alarmTime.getTime() - now.getTime() + jitterMs;

      chrome.alarms.create(`batch_${time}`, {
        delayInMinutes: delayMs / 60000,
        periodInMinutes: 24 * 60,
      });
    }
  });
}

// --- Event listeners ---

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    settings: {
      batch_times: ["11:00", "16:00"],
      auto_threshold: "simple",
      active_platforms: ["instagram", "threads"],
      jitter_minutes: 15,
    },
    queue: [],
  });
  scheduleBatchAlarms();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name.startsWith("batch_")) {
    runBatch();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "SCRAPE_CURRENT") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab?.id || !tab.url) {
        sendResponse({ success: false, error: "No active tab" });
        return;
      }
      const platform = detectPlatform(tab.url);
      if (!platform) {
        sendResponse({ success: false, error: "Unsupported platform" });
        return;
      }
      try {
        const results = await handleScrape(tab.id, platform);
        sendResponse({ success: true, results, platform });
      } catch (err) {
        sendResponse({
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    });
    return true; // async response
  }

  if (message.action === "APPROVE_REPLY") {
    handleApprove(
      message.commentId,
      message.replyId,
      message.replyText,
      message.comment
    ).then(() => sendResponse({ success: true }));
    return true;
  }

  if (message.action === "SEND_NOW") {
    const item = message.item as QueuedReply;
    updateQueueItem(item.comment_id, {
      scheduled_for: Date.now(),
      status: "queued",
    }).then(() => {
      runBatch().then(() => sendResponse({ success: true }));
    });
    return true;
  }

  if (message.action === "REMOVE_FROM_QUEUE") {
    removeFromQueue(message.commentId).then(() =>
      sendResponse({ success: true })
    );
    return true;
  }

  if (message.action === "UPDATE_SETTINGS") {
    updateSettings(message.settings).then(() => {
      scheduleBatchAlarms();
      sendResponse({ success: true });
    });
    return true;
  }
});
