import type { ScrapedComment, ContentScriptMessage, ContentScriptResponse } from "../lib/types";

function scrape(): ScrapedComment[] {
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

// Listen for messages from service worker
chrome.runtime.onMessage.addListener(
  (
    message: ContentScriptMessage,
    _sender,
    sendResponse: (response: ContentScriptResponse) => void
  ) => {
    if (message.action === "SCRAPE") {
      const comments = scrape();
      sendResponse({ success: true, comments });
    }

    if (message.action === "POST_REPLY") {
      postReply(message.payload).then(sendResponse);
      return true; // async response
    }
  }
);
