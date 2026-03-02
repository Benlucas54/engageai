import { supabase } from "../lib/supabase";
import {
  generateReply,
  getVoiceContext,
  detectFlagCondition,
  harvestLearnedExamples,
} from "../lib/claude";
import {
  getQueue,
  addToQueue,
  updateQueueItem,
  removeFromQueue,
  getSettings,
  updateBadge,
} from "../lib/storage";
import {
  upsertProfileCounters,
  getCommenterProfile,
  updateProfileSummaries,
} from "../lib/profiles";
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
  if (url.includes("threads.net") || url.includes("threads.com")) return "threads";
  if (url.includes("x.com")) return "x";
  if (url.includes("linkedin.com")) return "linkedin";
  if (url.includes("tiktok.com")) return "tiktok";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  return null;
}

async function deduplicateComments(
  comments: ScrapedComment[]
): Promise<ScrapedComment[]> {
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: existing, error: dedupErr } = await supabase
    .from("comments")
    .select("platform, username, comment_text")
    .gte("synced_at", sevenDaysAgo);

  console.log(`[EngageAI] Dedup: ${existing?.length ?? 0} existing comments in DB, error:`, dedupErr?.message);

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
  // Look up owner username from linked_accounts
  let ownerUsername = "";
  const { data: account } = await supabase
    .from("linked_accounts")
    .select("username")
    .eq("platform", platform === "threads" ? "threads" : platform)
    .limit(1)
    .single();
  if (account?.username) {
    ownerUsername = account.username.replace(/^@/, "");
  }
  // Fallback: for threads, try instagram account
  if (!ownerUsername && platform === "threads") {
    const { data: igAccount } = await supabase
      .from("linked_accounts")
      .select("username")
      .eq("platform", "instagram")
      .limit(1)
      .single();
    if (igAccount?.username) {
      ownerUsername = igAccount.username.replace(/^@/, "");
    }
  }

  // Send scrape message to content script, with retries if not ready
  let response: { success?: boolean; comments?: ScrapedComment[]; engagedComments?: { username: string; comment_text: string }[] } | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      response = await chrome.tabs.sendMessage(tabId, {
        action: "SCRAPE",
        ownerUsername,
      });
      break;
    } catch {
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 2000));
      } else {
        console.log(`[EngageAI] Content script not available on tab ${tabId}, skipping`);
        return [];
      }
    }
  }
  if (!response) return [];

  // Mark engaged comments (liked/replied externally) as "replied" in Supabase
  if (response?.engagedComments?.length) {
    console.log(`[EngageAI] ${response.engagedComments.length} engaged comments to reconcile`);
    for (const ec of response.engagedComments) {
      const { data: match } = await supabase
        .from("comments")
        .select("id, status")
        .eq("platform", platform)
        .eq("username", ec.username)
        .eq("comment_text", ec.comment_text)
        .in("status", ["pending", "flagged"])
        .limit(1)
        .single();
      if (match) {
        await supabase
          .from("comments")
          .update({ status: "replied" })
          .eq("id", match.id);
        console.log(`[EngageAI] Marked @${ec.username} comment as replied (engaged externally)`);
      }
    }
  }

  if (!response?.success || !response.comments?.length) {
    return [];
  }

  const scraped: ScrapedComment[] = response.comments;
  console.log(`[EngageAI] Scraped ${scraped.length} comments from content script`);

  // Deduplicate against Supabase
  const newComments = await deduplicateComments(scraped);
  console.log(`[EngageAI] After dedup: ${newComments.length} new comments`);

  // Upsert profile counters (fast, no AI)
  if (newComments.length > 0) {
    await upsertProfileCounters(newComments);
  }

  if (newComments.length === 0) {
    // All comments already in DB — surface only ones from THIS scan that need attention
    const scrapedKeys = new Set(
      scraped.map((c) => `${c.username}:${c.comment_text}`)
    );

    const { data: existing, error: existingErr } = await supabase
      .from("comments")
      .select("*")
      .eq("platform", platform)
      .in("status", ["pending", "flagged"])
      .order("created_at", { ascending: false })
      .limit(100);

    console.log(`[EngageAI] Pending/flagged in DB:`, existing?.length ?? 0, "error:", existingErr?.message);

    console.log(`[EngageAI] Pending/flagged to surface:`, (existing || []).length);

    const results: ScanResult[] = [];
    for (const comment of (existing || [])) {
      const { data: reply } = await supabase
        .from("replies")
        .select("*")
        .eq("comment_id", comment.id)
        .limit(1)
        .single();
      results.push({
        comment,
        reply: reply || undefined,
        status: comment.status === "flagged" ? "flagged" : "auto-approved",
      });
    }
    return results;
  }

  // Get voice settings, documents, and examples for reply generation
  const { voice, docContext, examples } = await getVoiceContext();
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

    if (error || !inserted) {
      console.error(`[EngageAI] Insert failed for @${comment.username}:`, error?.message);
      continue;
    }
    console.log(`[EngageAI] Inserted comment ${inserted.id} from @${comment.username}`);

    // Generate reply
    try {
      const profile = await getCommenterProfile(comment.platform, comment.username);
      const replyText = await generateReply(comment, voice, docContext, examples, profile);
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
          auto_sent: !shouldFlag,
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

  // Fire-and-forget: update profile summaries in the background
  updateProfileSummaries(newComments).catch((err) =>
    console.error("[EngageAI] Profile summary update failed:", err)
  );

  return results;
}

async function openMinimizedTab(url: string): Promise<{ tabId: number; windowId: number }> {
  // Create an unfocused window so the page fully renders
  // (minimized windows don't render interactive elements like reply modals)
  const win = await chrome.windows.create({
    url,
    focused: false,
    width: 1280,
    height: 900,
  });
  const tabId = win.tabs?.[0]?.id;
  if (!tabId || !win.id) throw new Error("Failed to create window");

  // Wait for tab to finish loading
  await new Promise<void>((resolve) => {
    const listener = (tid: number, info: chrome.tabs.TabChangeInfo) => {
      if (tid === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });

  // Wait for content script to inject
  await new Promise((r) => setTimeout(r, 3000));
  return { tabId, windowId: win.id };
}

async function scanTab(
  url: string,
  platform: Platform
): Promise<ScanResult[]> {
  const { tabId, windowId } = await openMinimizedTab(url);
  try {
    return await handleScrape(tabId, platform);
  } finally {
    await chrome.windows.remove(windowId).catch(() => {});
  }
}

async function pollScanRequests(): Promise<void> {
  // Check for agent_runs with status "running" started in the last 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: runs } = await supabase
    .from("agent_runs")
    .select("id, started_at")
    .eq("status", "running")
    .gte("started_at", fiveMinutesAgo)
    .order("started_at", { ascending: false })
    .limit(1);

  if (!runs?.length) return;

  const run = runs[0];
  const { last_handled_run_id } = await chrome.storage.local.get(
    "last_handled_run_id"
  );
  if (last_handled_run_id === run.id) return;

  // Claim this run so we don't re-process it
  await chrome.storage.local.set({ last_handled_run_id: run.id });
  console.log(`[EngageAI] Handling scan request: run ${run.id}`);

  let commentsFound = 0;
  let repliesSent = 0;
  let flaggedCount = 0;

  try {
    // Get enabled linked accounts
    const { data: accounts } = await supabase
      .from("linked_accounts")
      .select("platform, enabled")
      .eq("enabled", true);

    const enabledPlatforms = new Set(
      (accounts || []).map((a: { platform: string }) => a.platform)
    );

    // Threads: open activity page in a background tab
    if (enabledPlatforms.has("threads")) {
      console.log("[EngageAI] Scanning Threads activity page...");
      try {
        const results = await scanTab(
          "https://www.threads.net/activity",
          "threads"
        );
        for (const r of results) {
          commentsFound++;
          if (r.status === "flagged") flaggedCount++;
          if (r.status === "auto-approved") repliesSent++;
        }
      } catch (err) {
        console.error("[EngageAI] Threads scan error:", err);
      }
    }

    // Other platforms: scan already-open tabs
    const platformUrlPatterns: [Platform, string][] = [
      ["instagram", "instagram.com"],
      ["x", "x.com"],
      ["linkedin", "linkedin.com"],
    ];

    for (const [platform, urlPattern] of platformUrlPatterns) {
      if (!enabledPlatforms.has(platform)) continue;

      const tabs = await chrome.tabs.query({ url: `*://*.${urlPattern}/*` });
      for (const tab of tabs) {
        if (!tab.id || !tab.url) continue;
        console.log(`[EngageAI] Scanning open ${platform} tab: ${tab.url}`);
        try {
          const results = await handleScrape(tab.id, platform);
          for (const r of results) {
            commentsFound++;
            if (r.status === "flagged") flaggedCount++;
            if (r.status === "auto-approved") repliesSent++;
          }
        } catch (err) {
          console.error(`[EngageAI] ${platform} scan error:`, err);
        }
      }
    }

    // Update agent_runs with results
    await supabase
      .from("agent_runs")
      .update({
        status: "success",
        completed_at: new Date().toISOString(),
        comments_found: commentsFound,
        replies_sent: repliesSent,
        flagged_count: flaggedCount,
      })
      .eq("id", run.id);

    console.log(
      `[EngageAI] Scan complete: ${commentsFound} comments, ${repliesSent} auto-approved, ${flaggedCount} flagged`
    );
  } catch (err) {
    console.error("[EngageAI] Scan request failed:", err);
    await supabase
      .from("agent_runs")
      .update({
        status: "error",
        completed_at: new Date().toISOString(),
        error_message: err instanceof Error ? err.message : "Unknown error",
      })
      .eq("id", run.id);
  }
}

async function autoScan(): Promise<void> {
  // Harvest learned examples from recently sent replies
  await harvestLearnedExamples().catch((err) =>
    console.error("[EngageAI] Harvest learned examples failed:", err)
  );

  // Skip if a manual run is currently active
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: activeRuns } = await supabase
    .from("agent_runs")
    .select("id")
    .eq("status", "running")
    .gte("started_at", fiveMinutesAgo)
    .limit(1);
  if (activeRuns?.length) return;

  console.log("[EngageAI] Auto-scan starting...");

  const { data: accounts } = await supabase
    .from("linked_accounts")
    .select("platform, enabled")
    .eq("enabled", true);
  const enabledPlatforms = new Set(
    (accounts || []).map((a: { platform: string }) => a.platform)
  );
  if (enabledPlatforms.size === 0) return;

  let commentsFound = 0;

  // Threads: open activity page
  if (enabledPlatforms.has("threads")) {
    try {
      const results = await scanTab("https://www.threads.net/activity", "threads");
      commentsFound += results.length;
    } catch (err) {
      console.log("[EngageAI] Auto-scan Threads error:", err);
    }
  }

  // Other platforms: scan open tabs
  const platformUrlPatterns: [Platform, string][] = [
    ["instagram", "instagram.com"],
    ["x", "x.com"],
    ["linkedin", "linkedin.com"],
  ];
  for (const [platform, urlPattern] of platformUrlPatterns) {
    if (!enabledPlatforms.has(platform)) continue;
    const tabs = await chrome.tabs.query({ url: `*://*.${urlPattern}/*` });
    for (const tab of tabs) {
      if (!tab.id || !tab.url) continue;
      try {
        const results = await handleScrape(tab.id, platform);
        commentsFound += results.length;
      } catch {
        // Silently skip tabs where content script isn't ready
      }
    }
  }

  if (commentsFound > 0) {
    console.log(`[EngageAI] Auto-scan found ${commentsFound} new comments`);
  }
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
    .update({ approved: true, reply_text: replyText, draft_text: replyText })
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
    let windowId: number | undefined;
    try {
      await updateQueueItem(item.comment_id, { status: "sending" });

      // Store current reply_id so the storage listener can sync steps to Supabase
      await chrome.storage.local.set({
        send_reply_id: item.reply_id,
        send_status: { step: "opening", username: item.username, platform: item.platform, ts: Date.now() },
      });
      await supabase.from("replies").update({ send_step: "opening" }).eq("id", item.reply_id);

      // Open post in a background window
      const opened = await openMinimizedTab(item.post_url);
      windowId = opened.windowId;
      const tabId = opened.tabId;

      // Send post reply message to content script, retrying until it connects
      let response: { success?: boolean } | undefined;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          response = await chrome.tabs.sendMessage(tabId, {
            action: "POST_REPLY",
            payload: item,
          });
          break;
        } catch {
          console.log(`[EngageAI] POST_REPLY attempt ${attempt + 1}/5 — content script not ready`);
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
      if (!response) throw new Error("Content script never connected");

      if (response?.success) {
        await supabase
          .from("replies")
          .update({ sent_at: new Date().toISOString(), send_step: "done" })
          .eq("id", item.reply_id);
        await supabase
          .from("comments")
          .update({ status: "replied" })
          .eq("id", item.comment_id);
        await updateQueueItem(item.comment_id, { status: "sent" });
      } else {
        await supabase
          .from("replies")
          .update({ send_step: "error" })
          .eq("id", item.reply_id);
        await updateQueueItem(item.comment_id, { status: "failed" });
      }

      // Humanised delay between replies (8-20 seconds)
      await new Promise((r) =>
        setTimeout(r, 8000 + Math.random() * 12000)
      );
    } catch (err) {
      console.error("Error in batch send:", err);
      await updateQueueItem(item.comment_id, { status: "failed" });
    } finally {
      // Always close the window, even on error
      if (windowId) {
        await chrome.windows.remove(windowId).catch(() => {});
      }
    }
  }

  // Remove sent items from queue
  const updatedQueue = await getQueue();
  await chrome.storage.local.set({
    queue: updatedQueue.filter((r) => r.status !== "sent"),
  });
  await updateBadge();
}

async function pollDashboardApprovals(): Promise<void> {
  // Check Supabase for replies approved via dashboard but not yet sent
  const { data: pendingReplies } = await supabase
    .from("replies")
    .select("*, comments(*)")
    .eq("approved", true)
    .is("sent_at", null)
    .limit(20);

  if (!pendingReplies?.length) return;

  const queue = await getQueue();
  const queuedIds = new Set(queue.map((q) => q.comment_id));

  for (const reply of pendingReplies) {
    const comment = reply.comments;
    if (!comment || comment.status === "replied" || comment.status === "hidden") continue;
    if (queuedIds.has(comment.id)) continue;

    await addToQueue({
      comment_id: comment.id,
      comment_external_id: comment.comment_external_id || "",
      reply_id: reply.id,
      reply_text: reply.reply_text,
      platform: comment.platform,
      post_url: comment.post_url || "",
      username: comment.username,
      comment_text: comment.comment_text,
      scheduled_for: Date.now(),
      status: "queued",
    });
    console.log(`[EngageAI] Queued dashboard-approved reply for @${comment.username}`);
  }

  await runBatch();
}

function scheduleBatchAlarms(): void {
  chrome.alarms.clearAll();
  // Poll for dashboard-approved replies every minute
  chrome.alarms.create("poll_approvals", { periodInMinutes: 1 });
  // Poll for "Run Now" scan requests every 15 seconds
  chrome.alarms.create("poll_scan", { periodInMinutes: 0.25 });
  // Auto-scan for new comments (interval from settings)
  getSettings().then((s) => {
    const interval = s.scan_interval_minutes || 5;
    if (interval > 0) {
      chrome.alarms.create("auto_scan", { periodInMinutes: interval });
    }
  });

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

// --- Sync send_status from content scripts to Supabase ---

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local" || !changes.send_status) return;
  const status = changes.send_status.newValue;
  if (!status?.step) return;

  // Mirror the step to the reply record in Supabase
  chrome.storage.local.get("send_reply_id", ({ send_reply_id }) => {
    if (!send_reply_id) return;
    supabase
      .from("replies")
      .update({ send_step: status.step })
      .eq("id", send_reply_id)
      .then(() => {
        console.log(`[EngageAI] Synced send_step "${status.step}" to Supabase`);
      });
  });
});

// --- Event listeners ---

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    settings: {
      batch_times: ["11:00", "16:00"],
      auto_threshold: "simple",
      active_platforms: ["instagram", "threads"],
      jitter_minutes: 15,
      scan_interval_minutes: 5,
    },
    queue: [],
  });
  scheduleBatchAlarms();
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "poll_approvals") {
    pollDashboardApprovals();
  } else if (alarm.name === "poll_scan") {
    pollScanRequests();
  } else if (alarm.name === "auto_scan") {
    autoScan();
  } else if (alarm.name.startsWith("batch_")) {
    runBatch();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "SCRAPE_CURRENT") {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, async (tabs) => {
      const tab = tabs[0];
      if (!tab?.id || !tab.url) {
        sendResponse({ success: false, error: "No active tab" });
        return;
      }
      const platform = detectPlatform(tab.url);
      if (!platform) {
        sendResponse({ success: false, error: `Unsupported platform: ${tab.url}` });
        return;
      }
      console.log(`[EngageAI] Manual scan: ${platform} tab ${tab.id} — ${tab.url}`);
      try {
        const newResults = await handleScrape(tab.id, platform);

        // Fetch existing comments for this platform
        const { data: existing } = await supabase
          .from("comments")
          .select("*")
          .eq("platform", platform)
          .order("created_at", { ascending: false })
          .limit(50);

        // Merge: new results + existing items (deduped)
        const newIds = new Set(newResults.map((r) => r.comment.id));
        const allResults = [...newResults];
        for (const comment of (existing || [])) {
          if (newIds.has(comment.id)) continue;
          const { data: reply } = await supabase
            .from("replies")
            .select("*")
            .eq("comment_id", comment.id)
            .limit(1)
            .single();
          allResults.push({
            comment,
            reply: reply || undefined,
            status: comment.status === "flagged" ? "flagged" : "auto-approved",
          });
        }

        console.log(`[EngageAI] Manual scan: ${newResults.length} new, ${allResults.length} total`);
        sendResponse({ success: true, results: allResults, platform });
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
