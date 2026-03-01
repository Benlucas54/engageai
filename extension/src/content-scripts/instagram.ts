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

    comments.push({
      platform: "instagram",
      username,
      comment_text: text,
      post_title: postTitle,
      post_url: postUrl,
      comment_external_id: `ig:${username}:${[...text].slice(0, 30).join("")}`,
      created_at: new Date().toISOString(),
    });
  }

  return comments;
}

async function postReply(
  payload: ContentScriptMessage["payload"]
): Promise<ContentScriptResponse> {
  if (!payload) return { success: false, error: "No payload" };

  // Find the comment by matching username + text
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

  if (!targetEl) return { success: false, error: "Comment not found" };

  // Scroll into view
  targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
  await delay(1000);

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

  if (!textarea) return { success: false, error: "Reply textarea not found" };

  textarea.focus();
  await delay(300);

  // Type character by character with humanised delays
  for (const char of payload.reply_text) {
    const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype,
      "value"
    )?.set;
    nativeInputValueSetter?.call(textarea, textarea.value + char);
    textarea.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await delay(80 + Math.random() * 60);
  }

  // Wait after typing
  await delay(800 + Math.random() * 400);

  // Click Post button
  const buttons = document.querySelectorAll("button");
  for (const btn of buttons) {
    if (
      btn.textContent?.trim().toLowerCase() === "post" &&
      !btn.disabled
    ) {
      btn.click();
      await delay(2000);
      return {
        success: true,
        comment_external_id: payload.comment_external_id,
      };
    }
  }

  return { success: false, error: "Post button not found" };
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
