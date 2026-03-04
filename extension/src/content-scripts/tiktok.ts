import type { ScrapedComment, ScrapedFollower, CommentMark, ContentScriptMessage, ContentScriptResponse } from "../lib/types";

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function setStatus(step: string, username: string) {
  await chrome.storage.local.set({
    send_status: { step, username, platform: "tiktok", ts: Date.now() },
  });
}

function parseCount(str: string): number {
  const cleaned = str.replace(/,/g, "").trim();
  const num = parseFloat(cleaned);
  if (cleaned.toLowerCase().endsWith("k")) return Math.round(num * 1000);
  if (cleaned.toLowerCase().endsWith("m")) return Math.round(num * 1000000);
  if (cleaned.toLowerCase().endsWith("b")) return Math.round(num * 1000000000);
  return Math.round(num);
}

// --- Comment scraping (for post pages) ---

function scrape(ownerUsername: string): ScrapedComment[] {
  const url = window.location.href;
  // TikTok video URLs: tiktok.com/@user/video/1234
  if (!url.includes("/video/")) return [];

  const postUrl = url.split("?")[0];
  const postTitle = document.querySelector(
    'h1, span[data-e2e="browse-video-desc"], div[class*="DivVideoInfoContainer"] span'
  )?.textContent?.trim().slice(0, 50) || "Video";

  const commentEls = document.querySelectorAll(
    'div[class*="DivCommentItemContainer"], div[class*="comment-item"], div[data-e2e="comment-item"]'
  );

  const comments: ScrapedComment[] = [];
  for (const el of commentEls) {
    const usernameEl = el.querySelector(
      'a[data-e2e="comment-username-1"], span[class*="SpanUserNameText"], a[href*="/@"]'
    );
    const textEl = el.querySelector(
      'p[data-e2e="comment-level-1"], span[class*="SpanCommentText"], p[class*="comment-text"]'
    );

    const username = usernameEl?.textContent?.trim().replace("@", "") || "";
    const text = textEl?.textContent?.trim() || "";

    if (!username || !text) continue;
    if (ownerUsername && username.toLowerCase() === ownerUsername.toLowerCase()) continue;

    const timeEl = el.querySelector('span[data-e2e="comment-time-1"], span[class*="SpanCreatedTime"]');
    const created_at = timeEl?.textContent?.trim() || new Date().toISOString();

    comments.push({
      platform: "tiktok",
      username,
      comment_text: text,
      post_title: postTitle,
      post_url: postUrl,
      comment_external_id: `tt:${username}:${[...text].slice(0, 30).join("")}`,
      created_at,
    });
  }

  return comments;
}

// --- Notification scraping for follow detection ---

function scrapeNotifications(): ScrapedFollower[] {
  const url = window.location.href;
  // TikTok notifications page
  if (!url.includes("/notifications") && !url.includes("/inbox")) return [];

  const followers: ScrapedFollower[] = [];
  const seen = new Set<string>();

  // Find notification items about new followers
  const notificationEls = document.querySelectorAll(
    'div[class*="DivNotificationItemContainer"], div[class*="notification-item"], div[role="listitem"], li'
  );

  for (const el of notificationEls) {
    const text = (el.textContent || "").toLowerCase();
    if (!text.includes("started following") && !text.includes("followed you") && !text.includes("follow")) continue;

    // Find username links
    const links = el.querySelectorAll('a[href*="/@"]');
    for (const link of links) {
      const href = link.getAttribute("href") || "";
      const match = href.match(/@([\w.]+)/);
      if (!match) continue;
      const username = match[1];
      if (seen.has(username)) continue;

      // Verify this is a follow notification
      const parentText = (el.textContent || "").toLowerCase();
      if (!parentText.includes("started following") && !parentText.includes("followed you")) continue;

      seen.add(username);
      const displayName = link.textContent?.trim().replace("@", "") || username;
      followers.push({
        platform: "tiktok",
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
  try {
    const res = await fetch(`https://www.tiktok.com/@${username}`, { credentials: "include" });
    const html = await res.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const metaDesc = doc.querySelector('meta[name="description"]')?.getAttribute("content") || "";

    // Parse counts: "X Followers, Y Likes. Bio text..."
    const followersMatch = metaDesc.match(/([\d,.]+[KkMm]?)\s*Followers/i);
    const likesMatch = metaDesc.match(/([\d,.]+[KkMm]?)\s*Likes/i);
    const followingMatch = metaDesc.match(/([\d,.]+[KkMm]?)\s*Following/i);

    const follower_count = followersMatch ? parseCount(followersMatch[1]) : null;
    const following_count = followingMatch ? parseCount(followingMatch[1]) : null;

    // Extract bio (text after the counts section)
    const bioMatch = metaDesc.match(/(?:Likes|Videos)\.\s*(.+)/i);
    const bio = bioMatch ? bioMatch[1].trim() : null;

    const title = doc.querySelector("title")?.textContent || "";
    const nameMatch = title.match(/^(.+?)\s*\(/);
    const display_name = nameMatch ? nameMatch[1].trim() : null;

    const profile_pic_url = doc.querySelector('meta[property="og:image"]')?.getAttribute("content") || null;

    return {
      bio,
      follower_count,
      following_count,
      post_count: null,
      has_recent_posts: null,
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

// --- DM sending ---

async function sendDM(
  username: string,
  messageText: string
): Promise<ContentScriptResponse> {
  await setStatus("opening_dm", username);

  window.location.href = "https://www.tiktok.com/messages";
  await delay(3000);

  // Click new message / compose
  const newMsgBtn = Array.from(document.querySelectorAll('button, div[role="button"]')).find(
    (b) => /new message|compose|send message/i.test((b as HTMLElement).textContent?.trim() || "")
  ) as HTMLElement | null;
  if (newMsgBtn) {
    newMsgBtn.click();
    await delay(2000);
  }

  // Search for user
  await setStatus("searching", username);
  const searchInput = document.querySelector(
    'input[placeholder*="Search" i], input[type="text"]'
  ) as HTMLInputElement | null;

  if (!searchInput) {
    await setStatus("error", username);
    return { success: false, error: "DM search input not found" };
  }

  searchInput.focus();
  await delay(500);

  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  for (const char of username) {
    nativeSetter?.call(searchInput, searchInput.value + char);
    searchInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await delay(80 + Math.random() * 60);
  }
  await delay(2000);

  // Click matching result
  await setStatus("selecting", username);
  const results = document.querySelectorAll('div[role="option"], div[class*="UserSearchItem"], li');
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
    return { success: false, error: "User not found in DM search" };
  }
  await delay(2000);

  // Type message
  await setStatus("typing", username);
  const msgInput = document.querySelector(
    'div[contenteditable="true"][role="textbox"], div[contenteditable="true"], textarea'
  ) as HTMLElement | null;

  if (!msgInput) {
    await setStatus("error", username);
    return { success: false, error: "Message input not found" };
  }

  msgInput.focus();
  await delay(300);

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

  // Send
  await setStatus("sending", username);
  const sendBtn = Array.from(document.querySelectorAll('button, div[role="button"]')).find(
    (b) => (b as HTMLElement).getAttribute("data-e2e") === "send-message" || b.textContent?.trim().toLowerCase() === "send"
  ) as HTMLElement | null;
  if (sendBtn) {
    sendBtn.click();
  } else {
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
    window.location.href = `https://www.tiktok.com/@${username}`;
    await delay(3000);

    // Click first video
    const videoLink = document.querySelector(
      'a[href*="/video/"], div[data-e2e="user-post-item"]'
    ) as HTMLElement | null;
    if (!videoLink) {
      await setStatus("error", username);
      return { success: false, error: "No videos found on profile" };
    }
    videoLink.click();
  }

  await delay(3000);

  // Find comment input
  await setStatus("typing", username);
  const commentInput = document.querySelector(
    'div[data-e2e="comment-input"] div[contenteditable="true"], div[class*="DivInputEditorContainer"] div[contenteditable="true"], textarea'
  ) as HTMLElement | null;

  if (!commentInput) {
    await setStatus("error", username);
    return { success: false, error: "Comment input not found" };
  }

  commentInput.click();
  commentInput.focus();
  await delay(500);

  if (commentInput instanceof HTMLTextAreaElement) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    for (const char of messageText) {
      setter?.call(commentInput, commentInput.value + char);
      commentInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
      await delay(80 + Math.random() * 60);
    }
  } else {
    for (const char of messageText) {
      document.execCommand("insertText", false, char);
      commentInput.dispatchEvent(new InputEvent("input", { bubbles: true, data: char }));
      await delay(80 + Math.random() * 60);
    }
  }

  await delay(500);

  // Click Post
  await setStatus("posting", username);
  const postBtn = document.querySelector(
    'div[data-e2e="comment-post"], button[data-e2e="comment-post"]'
  ) as HTMLElement | null;
  if (postBtn) {
    postBtn.click();
  } else {
    // Fallback: find Post button by text
    const btn = Array.from(document.querySelectorAll('button, div[role="button"]')).find(
      (b) => b.textContent?.trim().toLowerCase() === "post"
    ) as HTMLElement | null;
    if (btn) btn.click();
  }

  await delay(3000);

  await setStatus("done", username);
  return { success: true };
}

// --- Comment markers ---

const MARKER_CLASS = "engageai-marker";

function clearMarkers(): void {
  document.querySelectorAll(`.${MARKER_CLASS}`).forEach((el) => el.remove());
}

function injectMarkers(marks: CommentMark[]): void {
  clearMarkers();
  const commentEls = document.querySelectorAll(
    'div[class*="DivCommentItemContainer"], div[data-e2e="comment-item"]'
  );
  for (const mark of marks) {
    for (const el of commentEls) {
      const text = el.textContent || "";
      if (text.includes(mark.username) && text.includes(mark.comment_text_prefix)) {
        const usernameEl = el.querySelector('a[href*="/@"], span[class*="UserName"]');
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

// --- Message listener ---

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
      // TikTok comment replies follow same pattern as commentOnPost
      if (!message.payload) {
        sendResponse({ success: false, error: "No payload" });
        return;
      }
      // For TikTok, POST_REPLY works on the current video page
      const { payload } = message;
      const commentInput = document.querySelector(
        'div[data-e2e="comment-input"] div[contenteditable="true"], textarea'
      ) as HTMLElement | null;
      if (!commentInput) {
        sendResponse({ success: false, error: "Comment input not found" });
        return;
      }
      (async () => {
        commentInput.click();
        commentInput.focus();
        await delay(500);
        for (const char of payload.reply_text) {
          document.execCommand("insertText", false, char);
          commentInput.dispatchEvent(new InputEvent("input", { bubbles: true }));
          await delay(80 + Math.random() * 60);
        }
        await delay(500);
        const postBtn = document.querySelector('div[data-e2e="comment-post"], button[data-e2e="comment-post"]') as HTMLElement | null;
        if (postBtn) postBtn.click();
        await delay(3000);
        sendResponse({ success: true, comment_external_id: payload.comment_external_id });
      })();
      return true;
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
      return true;
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
