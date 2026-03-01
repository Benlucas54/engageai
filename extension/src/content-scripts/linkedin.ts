import type { ScrapedComment, ContentScriptMessage, ContentScriptResponse } from "../lib/types";

const MAX_REPLIES_PER_BATCH = 15;
let repliesSentThisSession = 0;

function scrape(): ScrapedComment[] {
  const url = window.location.href;
  if (!url.includes("linkedin.com")) return [];

  const postUrl = url.split("?")[0];

  // Find comments using aria roles and common LinkedIn selectors
  const commentEls = document.querySelectorAll(
    'article.comments-comment-item, div[class*="comments-comment-item"], div[data-id][class*="comment"]'
  );

  const comments: ScrapedComment[] = [];

  for (const el of commentEls) {
    // Extract author name
    const authorEl = el.querySelector(
      'a[class*="comment__author"] span, span[class*="hoverable-link-text"] span, a[data-tracking-control-name*="comment"] span'
    );
    const username = authorEl?.textContent?.trim() || "";

    // Extract comment text
    const textEl = el.querySelector(
      'span[class*="comment__text"] span, div[class*="comment__text"] span, span[dir="ltr"]'
    );
    const text = textEl?.textContent?.trim() || "";

    if (!username || !text) continue;

    comments.push({
      platform: "linkedin",
      username,
      comment_text: text,
      post_title: "LinkedIn Post",
      post_url: postUrl,
      comment_external_id: `li:${username}:${[...text].slice(0, 30).join("")}`,
      created_at: new Date().toISOString(),
    });
  }

  return comments;
}

async function postReply(
  payload: ContentScriptMessage["payload"]
): Promise<ContentScriptResponse> {
  if (!payload) return { success: false, error: "No payload" };

  // Rate limit check
  if (repliesSentThisSession >= MAX_REPLIES_PER_BATCH) {
    return { success: false, error: "Rate limit: max 15 replies per batch" };
  }

  // Find the comment by matching text
  const commentEls = document.querySelectorAll(
    'article.comments-comment-item, div[class*="comments-comment-item"], div[data-id][class*="comment"]'
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

  targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
  await delay(1500);

  // Click Reply button
  const replyBtns = targetEl.querySelectorAll("button");
  let clicked = false;
  for (const btn of replyBtns) {
    if (btn.textContent?.toLowerCase().includes("reply")) {
      btn.click();
      clicked = true;
      break;
    }
  }
  if (!clicked) return { success: false, error: "Reply button not found" };
  await delay(2000);

  // Find reply textbox
  const replyBox = document.querySelector(
    'div[contenteditable="true"][role="textbox"], div[class*="ql-editor"][contenteditable="true"]'
  ) as HTMLElement | null;

  if (!replyBox) return { success: false, error: "Reply textbox not found" };

  replyBox.focus();
  await delay(500);

  // Type with slower delays (LinkedIn is stricter)
  for (const char of payload.reply_text) {
    replyBox.textContent = (replyBox.textContent || "") + char;
    replyBox.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await delay(120 + Math.random() * 80);
  }

  // Longer pause after typing
  await delay(2000 + Math.random() * 2000);

  // Click submit button
  const buttons = document.querySelectorAll("button");
  for (const btn of buttons) {
    const text = btn.textContent?.trim().toLowerCase();
    if (
      (text === "post" || text === "reply" || text === "submit") &&
      !btn.disabled
    ) {
      btn.click();
      repliesSentThisSession++;
      await delay(3000);
      return {
        success: true,
        comment_external_id: payload.comment_external_id,
      };
    }
  }

  return { success: false, error: "Submit button not found" };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

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
      return true;
    }
  }
);
