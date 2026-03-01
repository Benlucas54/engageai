import type { ScrapedComment, ContentScriptMessage, ContentScriptResponse } from "../lib/types";

function scrape(): ScrapedComment[] {
  const url = window.location.href;
  if (!url.match(/threads\.net\/@[\w.]+\/post\//)) return [];

  const postUrl = url.split("?")[0];

  // Get original post text as title
  const firstPost = document.querySelector(
    'div[data-pressable-container="true"] span, div[class*="text"] span'
  );
  const postTitle = firstPost?.textContent?.trim().slice(0, 50) || "Thread";

  // Get all reply containers (skip first = original post)
  const containers = document.querySelectorAll(
    'div[data-pressable-container="true"]'
  );

  const comments: ScrapedComment[] = [];
  const containerArr = Array.from(containers).slice(1);

  for (const el of containerArr) {
    const spans = el.querySelectorAll('span[dir="auto"]');
    const username = spans[0]?.textContent?.trim().replace("@", "") || "";

    // Find comment text: skip time-related spans, "·", "Author", pure digits
    let text = "";
    for (let i = 2; i < spans.length; i++) {
      const t = spans[i]?.textContent?.trim();
      if (t && t !== "·" && t !== "Author" && !/^\d+$/.test(t)) {
        text = t;
        break;
      }
    }

    if (!username || !text) continue;

    comments.push({
      platform: "threads",
      username,
      comment_text: text,
      post_title: postTitle,
      post_url: postUrl,
      comment_external_id: `th:${username}:${[...text].slice(0, 30).join("")}`,
      created_at: new Date().toISOString(),
    });
  }

  return comments;
}

async function postReply(
  payload: ContentScriptMessage["payload"]
): Promise<ContentScriptResponse> {
  if (!payload) return { success: false, error: "No payload" };

  // Find reply input area
  const replyArea = document.querySelector(
    'div[contenteditable="true"], textarea[placeholder*="Reply"], div[role="textbox"]'
  ) as HTMLElement | null;

  if (!replyArea) return { success: false, error: "Reply area not found" };

  replyArea.click();
  replyArea.focus();
  await delay(500);

  // Type character by character
  for (const char of payload.reply_text) {
    if (replyArea.tagName === "TEXTAREA") {
      const textarea = replyArea as HTMLTextAreaElement;
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      nativeSetter?.call(textarea, textarea.value + char);
    } else {
      // contenteditable div
      replyArea.textContent = (replyArea.textContent || "") + char;
    }
    replyArea.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await delay(80 + Math.random() * 60);
  }

  await delay(800 + Math.random() * 400);

  // Click Post/Reply button
  const buttons = document.querySelectorAll(
    'div[role="button"], button'
  );
  for (const btn of buttons) {
    const text = btn.textContent?.trim().toLowerCase();
    if (text === "post" || text === "reply") {
      (btn as HTMLElement).click();
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
