import { supabase } from "../lib/supabase";

// Open side panel when toolbar icon is clicked (instead of popup)
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err: unknown) => console.error("[EngageAI] setPanelBehavior failed:", err));
import {
  generateReply,
  harvestLearnedExamples,
  tagComments,
} from "../lib/claude";
import {
  getSettings,
  updateSettings,
} from "../lib/storage";
import {
  upsertProfileCounters,
  getCommenterProfile,
  updateProfileSummaries,
} from "../lib/profiles";
import type {
  Platform,
  ScrapedComment,
  Comment,
  ScanResult,
  SmartTag,
  SidePanelItem,
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

function normalizeDedup(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, " ");
}

async function deduplicateComments(
  comments: ScrapedComment[]
): Promise<ScrapedComment[]> {
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();
  const { data: existing, error: dedupErr } = await supabase
    .from("comments")
    .select("platform, username, comment_text, comment_external_id")
    .in("status", ["pending", "flagged", "replied"])
    .gte("synced_at", thirtyDaysAgo);

  console.log(`[EngageAI] Dedup: ${existing?.length ?? 0} existing comments in DB, error:`, dedupErr?.message);

  // If dedup query failed (e.g. auth expired), skip all inserts to avoid duplicates
  if (dedupErr) {
    console.error(`[EngageAI] Dedup query failed, skipping inserts to prevent duplicates`);
    return [];
  }

  const existingKeys = new Set<string>();
  const existingExtIds = new Set<string>();
  for (const c of (existing || []) as { platform: string; username: string; comment_text: string; comment_external_id?: string }[]) {
    existingKeys.add(`${normalizeDedup(c.platform)}:${normalizeDedup(c.username)}:${normalizeDedup(c.comment_text)}`);
    if (c.comment_external_id) existingExtIds.add(c.comment_external_id);
  }

  const seen = new Set<string>();
  const seenExtIds = new Set<string>();
  return comments.filter((c) => {
    const key = `${normalizeDedup(c.platform)}:${normalizeDedup(c.username)}:${normalizeDedup(c.comment_text)}`;
    if (existingKeys.has(key) || seen.has(key)) return false;
    if (c.comment_external_id && (existingExtIds.has(c.comment_external_id) || seenExtIds.has(c.comment_external_id))) return false;
    seen.add(key);
    if (c.comment_external_id) seenExtIds.add(c.comment_external_id);
    return true;
  });
}

// --- Message handlers ---

async function handleScrape(
  tabId: number,
  platform: Platform,
  activeProfileId?: string | null
): Promise<ScanResult[]> {
  // Ensure auth session is active before any DB queries
  await restoreSession();

  // Look up owner username and profile_id from linked_accounts
  // If activeProfileId is provided, filter by it to pick the right account
  let ownerUsername = "";
  let profileId: string | null = null;

  let accountQuery = supabase
    .from("linked_accounts")
    .select("username, profile_id")
    .eq("platform", platform === "threads" ? "threads" : platform);
  if (activeProfileId) {
    accountQuery = accountQuery.eq("profile_id", activeProfileId);
  }
  const { data: account } = await accountQuery.limit(1).single();

  if (account?.username) {
    ownerUsername = account.username.replace(/^@/, "");
    profileId = account.profile_id ?? null;
  }
  // Fallback: for threads, try instagram account
  if (!ownerUsername && platform === "threads") {
    let igQuery = supabase
      .from("linked_accounts")
      .select("username, profile_id")
      .eq("platform", "instagram");
    if (activeProfileId) {
      igQuery = igQuery.eq("profile_id", activeProfileId);
    }
    const { data: igAccount } = await igQuery.limit(1).single();
    if (igAccount?.username) {
      ownerUsername = igAccount.username.replace(/^@/, "");
      profileId = igAccount.profile_id ?? null;
    }
  }

  // Cache owner username for engagement detection
  if (ownerUsername) {
    const { owner_usernames = {} } = await chrome.storage.local.get("owner_usernames");
    owner_usernames[platform] = ownerUsername;
    await chrome.storage.local.set({ owner_usernames });
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
    let existQuery = supabase
      .from("comments")
      .select("*, replies(*)")
      .eq("platform", platform)
      .in("status", ["pending", "flagged"])
      .order("created_at", { ascending: false })
      .limit(100);
    if (profileId) existQuery = existQuery.eq("profile_id", profileId);
    const { data: existing, error: existingErr } = await existQuery;

    console.log(`[EngageAI] Pending/flagged in DB:`, existing?.length ?? 0, "error:", existingErr?.message);

    const results: ScanResult[] = (existing || []).map((row: any) => {
      const { replies: r, ...comment } = row;
      return {
        comment,
        reply: r?.[0] || undefined,
        status: comment.status === "flagged" ? "flagged" : "auto-approved",
      };
    });
    return results;
  }

  const results: ScanResult[] = [];

  // Phase 1: Insert all non-spam comments
  const insertedComments: { inserted: Comment; original: ScrapedComment }[] = [];

  for (const comment of newComments) {
    // Skip spam
    if (isSpam(comment.comment_text)) {
      await supabase.from("comments").insert({
        ...comment,
        profile_id: profileId,
        status: "hidden",
        synced_at: new Date().toISOString(),
      });
      continue;
    }

    // Insert comment as flagged (suggestion pending)
    const { data: inserted, error } = await supabase
      .from("comments")
      .insert({
        ...comment,
        profile_id: profileId,
        status: "flagged",
        synced_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !inserted) {
      console.error(`[EngageAI] Insert failed for @${comment.username}:`, error?.message);
      continue;
    }
    console.log(`[EngageAI] Inserted comment ${inserted.id} from @${comment.username}`);
    insertedComments.push({ inserted: inserted as Comment, original: comment });
  }

  // Phase 2: Batch-tag all inserted comments via /api/tag-comments
  const tagMap: Record<string, SmartTag> = insertedComments.length > 0
    ? await tagComments(
        insertedComments.map(({ inserted, original }) => ({
          id: inserted.id,
          comment_text: original.comment_text,
          post_title: original.post_title,
          platform: original.platform,
        }))
      )
    : {};

  console.log(`[EngageAI] Tagged ${Object.keys(tagMap).length} comments`);

  // Phase 2.5: Write tags back to the comments table
  for (const [commentId, tag] of Object.entries(tagMap)) {
    await supabase
      .from("comments")
      .update({ smart_tag: tag })
      .eq("id", commentId);
  }

  // Add inserted comments to results (replies generated on-demand by user)
  for (const { inserted } of insertedComments) {
    results.push({
      comment: { ...inserted, status: "flagged" },
      reply: undefined,
      status: "flagged",
    });
  }

  // Fire-and-forget: update profile summaries in the background
  updateProfileSummaries(newComments).catch((err) =>
    console.error("[EngageAI] Profile summary update failed:", err)
  );

  // Send side panel update to the tab
  sendSidePanelUpdate(tabId, platform);

  return results;
}

async function sendSidePanelUpdate(tabId: number, platform: Platform): Promise<void> {
  try {
    const { data: comments } = await supabase
      .from("comments")
      .select("id, comment_external_id, username, comment_text, smart_tag, status, platform, post_url, replies(draft_text)")
      .eq("platform", platform)
      .in("status", ["pending", "flagged"])
      .order("created_at", { ascending: false })
      .limit(50);

    if (!comments?.length) return;

    // Fetch smart tag definitions for label + color lookup
    const { data: tagDefs } = await supabase
      .from("smart_tags")
      .select("key, label, color_bg, color_text, color_border")
      .eq("enabled", true);

    const tagMap = new Map<string, { label: string; color_bg: string; color_text: string; color_border: string }>();
    for (const t of tagDefs || []) {
      tagMap.set(t.key, t);
    }

    const items: SidePanelItem[] = comments.map((c: any) => {
      const tagDef = c.smart_tag ? tagMap.get(c.smart_tag) : undefined;
      return {
        commentId: c.id,
        commentExternalId: c.comment_external_id,
        username: c.username,
        commentText: c.comment_text,
        smartTag: c.smart_tag,
        smartTagLabel: tagDef?.label ?? null,
        smartTagBg: tagDef?.color_bg ?? null,
        smartTagText: tagDef?.color_text ?? null,
        smartTagBorder: tagDef?.color_border ?? null,
        draftText: c.replies?.[0]?.draft_text || null,
        platform: c.platform,
        postUrl: c.post_url,
        status: c.status as "pending" | "flagged",
      };
    });

    chrome.tabs.sendMessage(tabId, {
      action: "UPDATE_SIDE_PANEL",
      sidePanelItems: items,
    }).catch(() => {});
  } catch (err) {
    console.error("[EngageAI] Side panel update failed:", err);
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

    // Scan already-open tabs for each enabled platform
    const platformUrlPatterns: [Platform, string][] = [
      ["instagram", "instagram.com"],
      ["threads", "threads.net"],
      ["x", "x.com"],
      ["linkedin", "linkedin.com"],
      ["tiktok", "tiktok.com"],
    ];

    const platformsWithNoTabs: string[] = [];

    for (const [platform, urlPattern] of platformUrlPatterns) {
      if (!enabledPlatforms.has(platform)) continue;

      const tabs = await chrome.tabs.query({ url: `*://*.${urlPattern}/*` });
      if (tabs.length === 0) {
        platformsWithNoTabs.push(platform);
        continue;
      }
      for (const tab of tabs) {
        if (!tab.id || !tab.url) continue;
        console.log(`[EngageAI] Scanning open ${platform} tab: ${tab.url}`);
        try {
          const results = await handleScrape(tab.id, platform);
          for (const r of results) {
            commentsFound++;
            if (r.status === "flagged") flaggedCount++;
          }
        } catch (err) {
          console.error(`[EngageAI] ${platform} scan error:`, err);
        }
      }
    }

    // Build error message if some/all platforms had no open tabs
    const noTabsMessage = platformsWithNoTabs.length > 0
      ? `No open tabs found for: ${platformsWithNoTabs.join(", ")}`
      : undefined;

    // Update agent_runs with results
    await supabase
      .from("agent_runs")
      .update({
        status: "success",
        completed_at: new Date().toISOString(),
        comments_found: commentsFound,
        replies_sent: 0,
        flagged_count: flaggedCount,
        ...(noTabsMessage ? { error_message: noTabsMessage } : {}),
      })
      .eq("id", run.id);

    console.log(
      `[EngageAI] Scan complete: ${commentsFound} comments, ${flaggedCount} suggestions generated`
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

  // Scan open tabs for each enabled platform
  const platformUrlPatterns: [Platform, string][] = [
    ["instagram", "instagram.com"],
    ["threads", "threads.net"],
    ["x", "x.com"],
    ["linkedin", "linkedin.com"],
    ["tiktok", "tiktok.com"],
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

function scheduleScanAlarms(): void {
  chrome.alarms.clearAll();
  // Poll for "Run Now" scan requests every 15 seconds
  chrome.alarms.create("poll_scan", { periodInMinutes: 0.25 });
  // Auto-scan for new comments (interval from settings)
  getSettings().then((s) => {
    const interval = s.scan_interval_minutes || 5;
    if (interval > 0) {
      chrome.alarms.create("auto_scan", { periodInMinutes: interval });
    }
  });
}

// --- Session restore ---
// When the service worker starts (or restarts after Chrome kills it),
// restore the Supabase auth session from chrome.storage.local so that
// RLS-protected queries and API calls work immediately.
async function restoreSession(): Promise<void> {
  try {
    const items = await chrome.storage.local.get();
    for (const [key, value] of Object.entries(items)) {
      if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
        const stored = typeof value === "string" ? JSON.parse(value) : value;
        if (stored?.access_token && stored?.refresh_token) {
          const { error } = await supabase.auth.setSession({
            access_token: stored.access_token,
            refresh_token: stored.refresh_token,
          });
          if (error) {
            console.warn("[EngageAI] Session restore failed:", error.message);
          } else {
            console.log("[EngageAI] Session restored from storage");
          }
        }
        break;
      }
    }
  } catch (err) {
    console.warn("[EngageAI] Session restore error:", err);
  }
}

// Restore session eagerly on service worker start
restoreSession();

// --- Event listeners ---

chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.set({
    settings: {
      active_platforms: ["instagram", "threads", "linkedin"],
      scan_interval_minutes: 5,
    },
    side_panel_enabled: true,
    side_panel_collapsed: true,
  });
  scheduleScanAlarms();
  // Cache owner usernames for engagement detection
  cacheOwnerUsernames();
});

async function cacheOwnerUsernames(): Promise<void> {
  try {
    const { data: accounts } = await supabase
      .from("linked_accounts")
      .select("platform, username")
      .eq("enabled", true);
    if (!accounts?.length) return;
    const owner_usernames: Record<string, string> = {};
    for (const a of accounts) {
      owner_usernames[a.platform] = (a.username || "").replace(/^@/, "");
    }
    await chrome.storage.local.set({ owner_usernames });
  } catch (err) {
    console.error("[EngageAI] Failed to cache owner usernames:", err);
  }
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "poll_scan") {
    pollScanRequests();
  } else if (alarm.name === "auto_scan") {
    autoScan();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.action === "AUTH_SESSION_CHANGED") {
    (async () => {
      try {
        const items = await chrome.storage.local.get();
        for (const [key, value] of Object.entries(items)) {
          if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
            const session = typeof value === "string" ? JSON.parse(value) : value;
            if (session?.access_token && session?.refresh_token) {
              await supabase.auth.setSession({
                access_token: session.access_token,
                refresh_token: session.refresh_token,
              });
            }
            break;
          }
        }
      } catch (err) {
        console.error("[EngageAI] Session sync failed:", err);
      }
      sendResponse({ success: true });
    })();
    return true;
  }

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
        const newResults = await handleScrape(tab.id, platform, message.profileId);

        // Fetch existing comments for this platform (filtered by profile if provided)
        let existingQuery = supabase
          .from("comments")
          .select("*, replies(*)")
          .eq("platform", platform);
        if (message.profileId) {
          existingQuery = existingQuery.eq("profile_id", message.profileId);
        }
        const { data: existing } = await existingQuery
          .order("created_at", { ascending: false })
          .limit(50);

        // Merge: new results + existing items (deduped)
        const newIds = new Set(newResults.map((r) => r.comment.id));
        const allResults = [...newResults];
        for (const row of (existing || [])) {
          if (newIds.has(row.id)) continue;
          const { replies: r, ...comment } = row as any;
          allResults.push({
            comment,
            reply: r?.[0] || undefined,
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

  if (message.action === "LOAD_CACHED") {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, async (tabs) => {
      const tab = tabs[0];
      const platform = tab?.url ? detectPlatform(tab.url) : null;
      try {
        // Ensure auth session is active before any DB queries
        await restoreSession();
        // Fetch active comments (pending/flagged), filtered by profile if provided
        let query = supabase
          .from("comments")
          .select("*, replies(*)")
          .in("status", ["pending", "flagged"])
          .order("created_at", { ascending: false })
          .limit(50);
        if (platform) query = query.eq("platform", platform);
        if (message.profileId) query = query.eq("profile_id", message.profileId);

        const { data: comments, error } = await query;
        if (error) { sendResponse({ success: false, error: error.message }); return; }

        // Fetch dismissed comments
        let dismissedQuery = supabase
          .from("comments")
          .select("*, replies(*)")
          .eq("status", "dismissed")
          .order("created_at", { ascending: false })
          .limit(30);
        if (platform) dismissedQuery = dismissedQuery.eq("platform", platform);
        if (message.profileId) dismissedQuery = dismissedQuery.eq("profile_id", message.profileId);

        const { data: dismissedComments } = await dismissedQuery;

        const results: ScanResult[] = [];

        for (const row of (comments || [])) {
          const { replies: r, ...comment } = row as any;
          const reply = r?.[0] || undefined;
          results.push({
            comment,
            reply,
            status: comment.status === "flagged" ? "flagged" : "auto-approved",
          });
        }

        // Build dismissed results
        const dismissed: ScanResult[] = (dismissedComments || []).map((row: any) => {
          const { replies: r, ...comment } = row;
          return {
            comment,
            reply: r?.[0] || undefined,
            status: "flagged" as const,
          };
        });

        sendResponse({ success: true, results, dismissed, platform });
      } catch (err) {
        sendResponse({ success: false, error: err instanceof Error ? err.message : "Unknown error" });
      }
    });
    return true;
  }

  if (message.action === "DISMISS_COMMENT") {
    (async () => {
      try {
        const { commentId } = message;
        if (!commentId) { sendResponse({ success: false, error: "No comment ID" }); return; }
        const { error } = await supabase
          .from("comments")
          .update({ status: "dismissed" })
          .eq("id", commentId);
        sendResponse({ success: !error, error: error?.message });
      } catch (err) {
        sendResponse({ success: false, error: err instanceof Error ? err.message : "Unknown error" });
      }
    })();
    return true;
  }

  if (message.action === "RESTORE_COMMENT") {
    (async () => {
      try {
        const { commentId } = message;
        if (!commentId) { sendResponse({ success: false, error: "No comment ID" }); return; }
        const { error } = await supabase
          .from("comments")
          .update({ status: "flagged" })
          .eq("id", commentId);
        sendResponse({ success: !error, error: error?.message });
      } catch (err) {
        sendResponse({ success: false, error: err instanceof Error ? err.message : "Unknown error" });
      }
    })();
    return true;
  }

  if (message.action === "UPDATE_SETTINGS") {
    updateSettings(message.settings).then(() => {
      scheduleScanAlarms();
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.action === "CAPTURE_OUTBOUND_POST") {
    (async () => {
      try {
        await restoreSession();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          sendResponse({ success: false, error: "Not authenticated" });
          return;
        }
        const { error } = await supabase
          .from("outbound_posts")
          .upsert(
            {
              user_id: user.id,
              platform: message.platform,
              post_url: message.postUrl,
              post_author: message.postAuthor || null,
              post_caption: message.postCaption || null,
              existing_comments: message.existingComments || [],
              media_type: message.mediaType || null,
              hashtags: message.hashtags || [],
              source: "extension",
              status: "pending",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,post_url" }
          );
        if (error) {
          console.error("[EngageAI] Outbound capture failed:", error.message);
          sendResponse({ success: false, error: error.message });
        } else {
          console.log(`[EngageAI] Captured outbound post: ${message.postUrl}`);
          sendResponse({ success: true });
        }
      } catch (err) {
        sendResponse({ success: false, error: err instanceof Error ? err.message : "Unknown error" });
      }
    })();
    return true;
  }

  if (message.action === "GENERATE_OUTBOUND_COMMENT") {
    (async () => {
      try {
        await restoreSession();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          sendResponse({ success: false, error: "Not authenticated" });
          return;
        }

        // Get access token for API call
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) {
          sendResponse({ success: false, error: "No session" });
          return;
        }

        // Step 1: Capture/upsert the outbound post
        await supabase
          .from("outbound_posts")
          .upsert(
            {
              user_id: user.id,
              platform: message.platform,
              post_url: message.postUrl,
              post_author: message.postAuthor || null,
              post_caption: message.postCaption || null,
              existing_comments: message.existingComments || [],
              media_type: message.mediaType || null,
              hashtags: message.hashtags || [],
              source: "extension",
              status: "pending",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,post_url" }
          );

        // Step 2: Generate comment via API (service worker is not subject to CORS)
        const apiUrl = import.meta.env.VITE_API_URL || "https://engageai-coral.vercel.app";
        const res = await fetch(`${apiUrl}/api/generate-engagement`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            platform: message.platform,
            postAuthor: message.postAuthor || "",
            postCaption: message.postCaption || "Post",
            postUrl: message.postUrl,
            existingComments: message.existingComments || [],
            mediaType: message.mediaType || null,
            hashtags: message.hashtags || [],
          }),
        });

        const result = await res.json();
        if (!result.comment_text) {
          sendResponse({ success: false, error: result.error || "Generation failed" });
          return;
        }

        // Step 3: Update the outbound post with generated comment
        await supabase
          .from("outbound_posts")
          .update({
            generated_comment: result.comment_text,
            generation_analysis: result.analysis || null,
            generated_at: new Date().toISOString(),
            status: "generated",
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", user.id)
          .eq("post_url", message.postUrl);

        console.log(`[EngageAI] Generated outbound comment for: ${message.postUrl}`);
        sendResponse({ success: true, commentText: result.comment_text });
      } catch (err) {
        console.error("[EngageAI] Outbound generation failed:", err);
        sendResponse({ success: false, error: err instanceof Error ? err.message : "Unknown error" });
      }
    })();
    return true;
  }

  if (message.action === "GENERATE_SUGGESTION_FOR_COMMENT") {
    (async () => {
      try {
        const { commentExternalId, forceRegenerate } = message;
        if (!commentExternalId) {
          sendResponse({ success: false, error: "No comment external ID" });
          return;
        }
        // Ensure session is restored before querying
        await restoreSession();
        // Find the comment in Supabase
        const { data: comment, error: commentErr } = await supabase
          .from("comments")
          .select("*")
          .eq("comment_external_id", commentExternalId)
          .limit(1)
          .single();
        if (!comment) {
          const errMsg = commentErr ? `DB error: ${commentErr.message}` : "Comment not found in database";
          console.error(`[EngageAI] GENERATE_SUGGESTION failed: ${errMsg} (externalId: ${commentExternalId})`);
          sendResponse({ success: false, error: errMsg });
          return;
        }
        // Check if reply already exists (unless force regenerate)
        if (!forceRegenerate) {
          const { data: existingReply } = await supabase
            .from("replies")
            .select("*")
            .eq("comment_id", comment.id)
            .limit(1)
            .single();
          if (existingReply?.draft_text) {
            sendResponse({ success: true, draftText: existingReply.draft_text, commentId: comment.id });
            return;
          }
        }
        // Generate a new reply via the API
        const profile = await getCommenterProfile(comment.platform, comment.username);
        const replyText = await generateReply(comment, profile);
        // Save the reply (upsert for regenerate)
        if (forceRegenerate) {
          await supabase
            .from("replies")
            .update({ reply_text: replyText, draft_text: replyText })
            .eq("comment_id", comment.id);
          sendResponse({ success: true, draftText: replyText, commentId: comment.id });
        } else {
          const { data: reply } = await supabase
            .from("replies")
            .insert({
              comment_id: comment.id,
              reply_text: replyText,
              draft_text: replyText,
              approved: false,
              auto_sent: false,
            })
            .select()
            .single();
          sendResponse({ success: true, draftText: replyText, commentId: comment.id, replyId: reply?.id });
        }
      } catch (err) {
        sendResponse({ success: false, error: err instanceof Error ? err.message : "Unknown error" });
      }
    })();
    return true;
  }

});
