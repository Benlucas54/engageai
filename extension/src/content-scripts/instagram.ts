import type { ScrapedComment, ScrapedFollower, CommentMark, ContentScriptMessage, ContentScriptResponse } from "../lib/types";

function scrape(ownerUsername: string): ScrapedComment[] {
  const url = window.location.href;
  if (!url.match(/instagram\.com\/(p|reels)\//)) return [];

  const postUrl = url.split("?")[0];

  // Get post caption for title
  const captionEl = document.querySelector(
    "h1, span[class*='caption'], div[class*='Caption'] span"
  );
  const postTitle = captionEl?.textContent?.trim().slice(0, 50) || "Post";

  // Find comment elements
  const commentEls = document.querySelectorAll(
    "ul ul li, div[class*='comment']"
  );

  const comments: ScrapedComment[] = [];
  for (const el of commentEls) {
    const usernameEl = el.querySelector(
      "a[href*='/'] span, a[class*='username']"
    );
    const textEl = el.querySelector(
      "span:not([class*='username']):not(:first-child)"
    );
    const username = usernameEl?.textContent?.trim();
    const text = textEl?.textContent?.trim();

    if (!username || !text) continue;

    // Skip owner's own comments
    if (ownerUsername && username.toLowerCase() === ownerUsername.toLowerCase()) continue;

    // Extract timestamp — Instagram uses <time datetime="...">
    const timeEl = el.querySelector("time[datetime]");
    const created_at = timeEl?.getAttribute("datetime") || new Date().toISOString();

    comments.push({
      platform: "instagram",
      username,
      comment_text: text,
      post_title: postTitle,
      post_url: postUrl,
      comment_external_id: `ig:${username}:${[...text].slice(0, 30).join("")}`,
      created_at,
    });
  }

  return comments;
}

async function setStatus(step: string, username: string) {
  await chrome.storage.local.set({
    send_status: { step, username, platform: "instagram", ts: Date.now() },
  });
}

async function postReply(
  payload: ContentScriptMessage["payload"]
): Promise<ContentScriptResponse> {
  if (!payload) return { success: false, error: "No payload" };

  // Find the comment by matching username + text
  await setStatus("finding", payload.username);
  const commentEls = document.querySelectorAll(
    "ul ul li, div[class*='comment']"
  );
  let targetEl: Element | null = null;

  for (const el of commentEls) {
    const text = el.textContent || "";
    if (
      text.includes(payload.username) &&
      text.includes(payload.comment_text.slice(0, 20))
    ) {
      targetEl = el;
      break;
    }
  }

  if (!targetEl) {
    await setStatus("error", payload.username);
    return { success: false, error: "Comment not found" };
  }

  // Scroll into view
  targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
  await delay(1000);

  // Like the comment (click heart if not already liked)
  await setStatus("liking", payload.username);
  const likeBtns = targetEl.querySelectorAll('button, span[role="button"]');
  for (const btn of likeBtns) {
    const svg = btn.querySelector("svg");
    const label = (svg?.getAttribute("aria-label") || "").toLowerCase();
    if (label === "like" || label === "love") {
      (btn as HTMLElement).click();
      console.log("[EngageAI] Liked comment");
      await delay(800 + Math.random() * 400);
      break;
    }
  }

  // Click Reply button
  const replyBtn = targetEl.querySelector(
    "button"
  );
  const replyBtns = targetEl.querySelectorAll("button");
  let clicked = false;
  for (const btn of replyBtns) {
    if (btn.textContent?.toLowerCase().includes("reply")) {
      btn.click();
      clicked = true;
      break;
    }
  }
  if (!clicked && replyBtn) replyBtn.click();
  await delay(1500);

  // Find reply textarea
  const textarea = document.querySelector(
    'textarea[aria-label*="comment" i], textarea[placeholder*="reply" i], textarea'
  ) as HTMLTextAreaElement | null;

  if (!textarea) {
    await setStatus("error", payload.username);
    return { success: false, error: "Reply textarea not found" };
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await setStatus("retrying", payload.username);
      console.log(`[EngageAI] Reply attempt ${attempt + 1}/3`);
      await delay(2000);
    }

    textarea.focus();
    await delay(300);

    // Clear and retype
    const nativeSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype, "value"
    )?.set;
    nativeSetter?.call(textarea, "");
    textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await delay(200);

    await setStatus("typing", payload.username);
    for (const char of payload.reply_text) {
      nativeSetter?.call(textarea, textarea.value + char);
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
      await delay(80 + Math.random() * 60);
    }

    await delay(500);

    // Verify typed text matches expected reply before posting
    const typed = textarea.value.trim();
    const expected = payload.reply_text.trim();
    if (typed !== expected) {
      console.log(`[EngageAI] Text mismatch — fixing`);
      nativeSetter?.call(textarea, expected);
      textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
      await delay(300);
    }

    await delay(400 + Math.random() * 400);

    // Click Post button
    await setStatus("posting", payload.username);
    let clicked = false;
    const buttons = document.querySelectorAll("button");
    for (const btn of buttons) {
      if (btn.textContent?.trim().toLowerCase() === "post" && !btn.disabled) {
        btn.click();
        clicked = true;
        break;
      }
    }
    if (!clicked) continue;

    // Verify reply appeared
    await setStatus("verifying", payload.username);
    await delay(3000);
    const snippet = payload.reply_text.slice(0, 30);
    if (document.body.innerText.includes(snippet)) {
      await setStatus("done", payload.username);
      return { success: true, comment_external_id: payload.comment_external_id };
    }
    console.log(`[EngageAI] Reply not verified, attempt ${attempt + 1}/3`);
  }

  await setStatus("error", payload.username);
  return { success: false, error: "Reply not confirmed after 3 attempts" };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Notification scraping for follow detection ---

function scrapeNotifications(): ScrapedFollower[] {
  // Only works on instagram.com/accounts/activity/ or /notifications/
  const url = window.location.href;
  if (!url.includes("/accounts/activity") && !url.includes("/notifications")) return [];

  const followers: ScrapedFollower[] = [];
  const seen = new Set<string>();

  // Find notification items that contain "started following you"
  const allElements = document.querySelectorAll(
    'div[role="listitem"], div[class*="notification"], article, li'
  );

  for (const el of allElements) {
    const text = el.textContent || "";
    if (!text.toLowerCase().includes("started following you") &&
        !text.toLowerCase().includes("follow")) continue;

    // Look for username links
    const links = el.querySelectorAll('a[href^="/"]');
    for (const link of links) {
      const href = link.getAttribute("href") || "";
      const match = href.match(/^\/([\w.]+)\/?$/);
      if (!match) continue;
      const username = match[1];
      if (username === "accounts" || username === "explore" || username === "direct" || username === "p" || username === "reels") continue;
      if (seen.has(username)) continue;

      // Check if this notification is specifically about following
      const parentText = (el.textContent || "").toLowerCase();
      if (!parentText.includes("started following you") && !parentText.includes("followed you")) continue;

      seen.add(username);
      const displayName = link.textContent?.trim() || username;
      followers.push({
        platform: "instagram",
        username,
        display_name: displayName !== username ? displayName : undefined,
      });
    }
  }

  return followers;
}

async function scrapeFollowerProfile(username: string): Promise<{
  bio: string | null;
  follower_count: number | null;
  following_count: number | null;
  post_count: number | null;
  has_recent_posts: boolean | null;
  display_name: string | null;
  profile_pic_url: string | null;
}> {
  // Navigate to profile page and extract data
  const profileUrl = `https://www.instagram.com/${username}/`;

  // Try fetching the profile page's meta/JSON data
  try {
    const res = await fetch(profileUrl, { credentials: "include" });
    const html = await res.text();

    // Parse counts from meta tags or page content
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // Try meta description: "X Followers, Y Following, Z Posts - ..."
    const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute("content") || "";
    const countsMatch = metaDesc.match(/([\d,.]+[KkMm]?)\s*Followers.*?([\d,.]+[KkMm]?)\s*Following.*?([\d,.]+[KkMm]?)\s*Posts/i);

    let follower_count: number | null = null;
    let following_count: number | null = null;
    let post_count: number | null = null;

    if (countsMatch) {
      follower_count = parseCount(countsMatch[1]);
      following_count = parseCount(countsMatch[2]);
      post_count = parseCount(countsMatch[3]);
    }

    // Try to get bio from meta
    const bioMatch = metaDesc.match(/Posts\s*[-–—]\s*(.+)/i);
    const bio = bioMatch ? bioMatch[1].trim() : null;

    // Try to get display name from title
    const title = doc.querySelector("title")?.textContent || "";
    const nameMatch = title.match(/^(.+?)\s*\(/);
    const display_name = nameMatch ? nameMatch[1].trim() : null;

    // Get profile pic from og:image
    const profile_pic_url = doc.querySelector('meta[property="og:image"]')?.getAttribute("content") || null;

    return {
      bio,
      follower_count,
      following_count,
      post_count,
      has_recent_posts: post_count != null ? post_count > 0 : null,
      display_name,
      profile_pic_url,
    };
  } catch {
    return {
      bio: null,
      follower_count: null,
      following_count: null,
      post_count: null,
      has_recent_posts: null,
      display_name: null,
      profile_pic_url: null,
    };
  }
}

function parseCount(str: string): number {
  const cleaned = str.replace(/,/g, "").trim();
  const num = parseFloat(cleaned);
  if (cleaned.toLowerCase().endsWith("k")) return Math.round(num * 1000);
  if (cleaned.toLowerCase().endsWith("m")) return Math.round(num * 1000000);
  return Math.round(num);
}

// --- Comment indicators ---

const MARKER_CLASS = "engageai-marker";

function clearMarkers(): void {
  document.querySelectorAll(`.${MARKER_CLASS}`).forEach((el) => el.remove());
}

function injectMarkers(marks: CommentMark[]): void {
  clearMarkers();
  const commentEls = document.querySelectorAll(
    "ul ul li, div[class*='comment']"
  );
  for (const mark of marks) {
    for (const el of commentEls) {
      const text = el.textContent || "";
      if (text.includes(mark.username) && text.includes(mark.comment_text_prefix)) {
        const usernameEl = el.querySelector(
          "a[href*='/'] span, a[class*='username']"
        );
        if (usernameEl) {
          const dot = document.createElement("span");
          dot.className = MARKER_CLASS;
          const isPending = mark.status === "pending";
          Object.assign(dot.style, {
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            backgroundColor: isPending ? "#3a6e8c" : "#92600a",
            boxShadow: `0 0 0 2px ${isPending ? "#c5dff0" : "#f0ddb8"}`,
            marginLeft: "6px",
            position: "relative",
            zIndex: "9999",
            pointerEvents: "none",
          });
          dot.title = isPending ? "EngageAI: Pending review" : "EngageAI: Needs attention";
          usernameEl.parentElement?.insertBefore(dot, usernameEl.nextSibling);
        }
        break;
      }
    }
  }
}

// Clear markers on SPA navigation
let _lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== _lastUrl) {
    _lastUrl = location.href;
    clearMarkers();
  }
}).observe(document.body, { childList: true, subtree: true });

// Listen for messages from service worker
chrome.runtime.onMessage.addListener(
  (
    message: ContentScriptMessage,
    _sender,
    sendResponse: (response: ContentScriptResponse) => void
  ) => {
    if (message.action === "SCRAPE") {
      const comments = scrape(message.ownerUsername || "");
      sendResponse({ success: true, comments });
    }

    if (message.action === "POST_REPLY") {
      postReply(message.payload).then(sendResponse);
      return true; // async response
    }

    if (message.action === "MARK_COMMENTS") {
      injectMarkers(message.marks || []);
      sendResponse({ success: true });
    }

    if (message.action === "CLEAR_MARKS") {
      clearMarkers();
      sendResponse({ success: true });
    }

    if (message.action === "SCRAPE_NOTIFICATIONS") {
      const followers = scrapeNotifications();
      sendResponse({ success: true, followers });
    }

    if (message.action === "SCRAPE_FOLLOWER_PROFILE") {
      if (!message.username) {
        sendResponse({ success: false, error: "No username" });
        return;
      }
      scrapeFollowerProfile(message.username).then((profile) => {
        sendResponse({ success: true, ...profile });
      });
      return true; // async response
    }

    if (message.action === "SEND_DM") {
      if (!message.username || !message.messageText) {
        sendResponse({ success: false, error: "Missing username or messageText" });
        return;
      }
      sendDM(message.username, message.messageText).then(sendResponse);
      return true;
    }

    if (message.action === "COMMENT_ON_POST") {
      if (!message.username || !message.messageText) {
        sendResponse({ success: false, error: "Missing username or messageText" });
        return;
      }
      commentOnPost(message.username, message.messageText, message.postUrl).then(sendResponse);
      return true;
    }
  }
);

// --- DM sending ---

async function sendDM(
  username: string,
  messageText: string
): Promise<ContentScriptResponse> {
  await setStatus("opening_dm", username);

  // Navigate to DM new message page
  window.location.href = "https://www.instagram.com/direct/new/";
  await delay(3000);

  // Search for user
  await setStatus("searching", username);
  const searchInput = document.querySelector(
    'input[placeholder*="Search" i], input[name="queryBox"]'
  ) as HTMLInputElement | null;

  if (!searchInput) {
    await setStatus("error", username);
    return { success: false, error: "DM search input not found" };
  }

  searchInput.focus();
  await delay(500);

  // Type username
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype, "value"
  )?.set;
  for (const char of username) {
    nativeSetter?.call(searchInput, searchInput.value + char);
    searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await delay(80 + Math.random() * 60);
  }
  await delay(2000);

  // Click the matching user result
  await setStatus("selecting", username);
  const results = document.querySelectorAll('div[role="listbox"] div[role="option"], div[class*="result"], button');
  let found = false;
  for (const result of results) {
    if ((result.textContent || "").toLowerCase().includes(username.toLowerCase())) {
      (result as HTMLElement).click();
      found = true;
      break;
    }
  }
  if (!found) {
    await setStatus("error", username);
    return { success: false, error: "User not found in search results" };
  }
  await delay(1000);

  // Click "Chat" or "Next" button
  const chatBtn = Array.from(document.querySelectorAll("button")).find(
    (b) => /^(chat|next)$/i.test(b.textContent?.trim() || "")
  );
  if (chatBtn) {
    chatBtn.click();
    await delay(2000);
  }

  // Find message textarea
  await setStatus("typing", username);
  const msgInput = document.querySelector(
    'textarea[placeholder*="Message" i], div[contenteditable="true"][role="textbox"]'
  ) as HTMLTextAreaElement | HTMLElement | null;

  if (!msgInput) {
    await setStatus("error", username);
    return { success: false, error: "Message input not found" };
  }

  msgInput.focus();
  await delay(300);

  // Type message character-by-character
  if (msgInput instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    for (const char of messageText) {
      setter?.call(msgInput, msgInput.value + char);
      msgInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
      await delay(80 + Math.random() * 120);
    }
  } else {
    for (const char of messageText) {
      document.execCommand("insertText", false, char);
      msgInput.dispatchEvent(new InputEvent("input", { bubbles: true, data: char }));
      await delay(80 + Math.random() * 120);
    }
  }

  await delay(500);

  // Click Send
  await setStatus("sending", username);
  const sendBtn = Array.from(document.querySelectorAll("button")).find(
    (b) => b.textContent?.trim().toLowerCase() === "send"
  );
  if (sendBtn) {
    sendBtn.click();
  } else {
    // Try pressing Enter
    msgInput.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  }

  await delay(2000);
  await setStatus("done", username);
  return { success: true };
}

// --- Comment on post ---

async function commentOnPost(
  username: string,
  messageText: string,
  postUrl?: string
): Promise<ContentScriptResponse> {
  await setStatus("navigating", username);

  if (postUrl) {
    window.location.href = postUrl;
  } else {
    // Navigate to user's profile to find latest post
    window.location.href = `https://www.instagram.com/${username}/`;
    await delay(3000);

    // Click first post
    const postLink = document.querySelector('a[href*="/p/"], a[href*="/reel/"]') as HTMLAnchorElement | null;
    if (!postLink) {
      await setStatus("error", username);
      return { success: false, error: "No posts found on profile" };
    }
    postLink.click();
  }

  await delay(3000);

  // Find comment textarea
  await setStatus("typing", username);
  const textarea = document.querySelector(
    'textarea[aria-label*="comment" i], textarea[placeholder*="comment" i], textarea'
  ) as HTMLTextAreaElement | null;

  if (!textarea) {
    await setStatus("error", username);
    return { success: false, error: "Comment textarea not found" };
  }

  textarea.focus();
  await delay(300);

  // Type comment character-by-character
  const nativeSetter = Object.getOwnPropertyDescriptor(
    HTMLTextAreaElement.prototype, "value"
  )?.set;
  for (const char of messageText) {
    nativeSetter?.call(textarea, textarea.value + char);
    textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await delay(80 + Math.random() * 60);
  }

  await delay(500);

  // Click Post
  await setStatus("posting", username);
  const postBtn = Array.from(document.querySelectorAll("button")).find(
    (b) => b.textContent?.trim().toLowerCase() === "post" && !b.disabled
  );
  if (!postBtn) {
    await setStatus("error", username);
    return { success: false, error: "Post button not found" };
  }
  postBtn.click();

  await delay(3000);

  // Verify
  await setStatus("verifying", username);
  const snippet = messageText.slice(0, 30);
  if (document.body.innerText.includes(snippet)) {
    await setStatus("done", username);
    return { success: true };
  }

  await setStatus("error", username);
  return { success: false, error: "Comment not confirmed" };
}
