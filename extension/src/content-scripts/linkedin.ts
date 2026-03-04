import type { ScrapedComment, CommentMark, ContentScriptMessage, ContentScriptResponse } from "../lib/types";

function parseRelativeTime(text: string): string {
  const match = text.match(/(\d+)\s*(s|m|h|d|w|mo|y)/i);
  if (!match) return new Date().toISOString();
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const ms = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000, mo: 2592000000, y: 31536000000 }[unit] || 0;
  return new Date(Date.now() - num * ms).toISOString();
}

const MAX_REPLIES_PER_BATCH = 15;
let repliesSentThisSession = 0;

function scrape(ownerUsername: string): ScrapedComment[] {
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

    // Skip owner's own comments
    if (ownerUsername && username.toLowerCase() === ownerUsername.toLowerCase()) continue;

    // Extract timestamp — LinkedIn uses <time> or relative time spans
    const timeEl = el.querySelector("time[datetime]");
    let created_at = timeEl?.getAttribute("datetime") || "";
    if (!created_at) {
      // Parse relative time like "2h", "3d", "1w"
      const relEl = el.querySelector('span[class*="time"], time, span.visually-hidden');
      const relText = relEl?.textContent?.trim() || "";
      created_at = parseRelativeTime(relText);
    }

    comments.push({
      platform: "linkedin",
      username,
      comment_text: text,
      post_title: "LinkedIn Post",
      post_url: postUrl,
      comment_external_id: `li:${username}:${[...text].slice(0, 30).join("")}`,
      created_at,
    });
  }

  return comments;
}

async function setStatus(step: string, username: string) {
  await chrome.storage.local.set({
    send_status: { step, username, platform: "linkedin", ts: Date.now() },
  });
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
  await setStatus("finding", payload.username);
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

  if (!targetEl) {
    await setStatus("error", payload.username);
    return { success: false, error: "Comment not found" };
  }

  targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
  await delay(1500);

  // Like the comment (click like button if not already active)
  await setStatus("liking", payload.username);
  const likeBtns = targetEl.querySelectorAll('button');
  for (const btn of likeBtns) {
    const label = (btn.getAttribute("aria-label") || "").toLowerCase();
    if (label.includes("like") && !label.includes("unlike")) {
      const isActive = btn.getAttribute("aria-pressed") === "true" ||
        btn.classList.toString().includes("active");
      if (!isActive) {
        btn.click();
        console.log("[EngageAI] Liked comment");
        await delay(1000 + Math.random() * 500);
      }
      break;
    }
  }

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
  await setStatus("typing", payload.username);
  for (const char of payload.reply_text) {
    replyBox.textContent = (replyBox.textContent || "") + char;
    replyBox.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await delay(120 + Math.random() * 80);
  }

  await delay(500);

  // Verify typed text matches expected reply before posting
  const typed = (replyBox.textContent || "").trim();
  const expected = payload.reply_text.trim();
  if (typed !== expected) {
    console.log(`[EngageAI] Text mismatch — fixing`);
    replyBox.textContent = expected;
    replyBox.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await delay(300);
  }

  // Longer pause after typing
  await delay(2000 + Math.random() * 2000);

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await setStatus("retrying", payload.username);
      console.log(`[EngageAI] Reply attempt ${attempt + 1}/3`);
      await delay(2000);

      // Re-clear and retype
      replyBox.focus();
      await delay(300);
      replyBox.textContent = "";
      replyBox.dispatchEvent(new InputEvent("input", { bubbles: true }));
      await delay(200);

      await setStatus("typing", payload.username);
      for (const char of payload.reply_text) {
        replyBox.textContent = (replyBox.textContent || "") + char;
        replyBox.dispatchEvent(new InputEvent("input", { bubbles: true }));
        await delay(120 + Math.random() * 80);
      }
      await delay(2000 + Math.random() * 2000);
    }

    // Click submit button
    await setStatus("posting", payload.username);
    const buttons = document.querySelectorAll("button");
    let clicked = false;
    for (const btn of buttons) {
      const text = btn.textContent?.trim().toLowerCase();
      if (
        (text === "post" || text === "reply" || text === "submit") &&
        !btn.disabled
      ) {
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
      repliesSentThisSession++;
      await setStatus("done", payload.username);
      return {
        success: true,
        comment_external_id: payload.comment_external_id,
      };
    }
    console.log(`[EngageAI] Reply not verified, attempt ${attempt + 1}/3`);
  }

  await setStatus("error", payload.username);
  return { success: false, error: "Reply not confirmed after 3 attempts" };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Comment indicators ---

const MARKER_CLASS = "engageai-marker";

function clearMarkers(): void {
  document.querySelectorAll(`.${MARKER_CLASS}`).forEach((el) => el.remove());
}

function injectMarkers(marks: CommentMark[]): void {
  clearMarkers();
  const commentEls = document.querySelectorAll(
    'article.comments-comment-item, div[class*="comments-comment-item"], div[data-id][class*="comment"]'
  );
  for (const mark of marks) {
    for (const el of commentEls) {
      const text = el.textContent || "";
      if (text.includes(mark.username) && text.includes(mark.comment_text_prefix)) {
        const authorEl = el.querySelector(
          'a[class*="comment__author"] span, span[class*="hoverable-link-text"] span, a[data-tracking-control-name*="comment"] span'
        );
        if (authorEl) {
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
          authorEl.parentElement?.insertBefore(dot, authorEl.nextSibling);
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
  }
);
