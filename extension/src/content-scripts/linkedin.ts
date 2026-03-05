import type { ScrapedComment, CommentMark, ContentScriptMessage, ContentScriptResponse } from "../lib/types";
import { startReplyDetector } from "../lib/reply-detector";
import { showInlineWidget, showEngagementWidget } from "../lib/inline-widget";
import { initSidePanel, updatePanelData } from "./shared/side-panel";

function parseRelativeTime(text: string): string {
  const match = text.match(/(\d+)\s*(s|m|h|d|w|mo|y)/i);
  if (!match) return new Date().toISOString();
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const ms = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000, mo: 2592000000, y: 31536000000 }[unit] || 0;
  return new Date(Date.now() - num * ms).toISOString();
}

function scrape(ownerUsername: string): ScrapedComment[] {
  const url = window.location.href;
  if (!url.includes("linkedin.com")) return [];

  const postUrl = url.split("?")[0];

  const commentEls = document.querySelectorAll(
    'article.comments-comment-item, div[class*="comments-comment-item"], div[data-id][class*="comment"]'
  );

  const comments: ScrapedComment[] = [];

  for (const el of commentEls) {
    const authorEl = el.querySelector(
      'a[class*="comment__author"] span, span[class*="hoverable-link-text"] span, a[data-tracking-control-name*="comment"] span'
    );
    const username = authorEl?.textContent?.trim() || "";

    const textEl = el.querySelector(
      'span[class*="comment__text"] span, div[class*="comment__text"] span, span[dir="ltr"]'
    );
    const text = textEl?.textContent?.trim() || "";

    if (!username || !text) continue;
    if (ownerUsername && username.toLowerCase() === ownerUsername.toLowerCase()) continue;

    const timeEl = el.querySelector("time[datetime]");
    let created_at = timeEl?.getAttribute("datetime") || "";
    if (!created_at) {
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

// --- Inline reply helper ---
chrome.storage.local.get("inline_helper_enabled", ({ inline_helper_enabled }) => {
  if (inline_helper_enabled === false) return;
  startReplyDetector(
    "linkedin",
    (ctx) => showInlineWidget(ctx),
    (ctx) => showEngagementWidget(ctx)
  );
});

// --- Side panel ---
initSidePanel();

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

    if (message.action === "MARK_COMMENTS") {
      injectMarkers(message.marks || []);
      sendResponse({ success: true });
    }

    if (message.action === "CLEAR_MARKS") {
      clearMarkers();
      sendResponse({ success: true });
    }

    if (message.action === "UPDATE_SIDE_PANEL") {
      if (message.sidePanelItems) {
        updatePanelData(message.sidePanelItems);
      }
      sendResponse({ success: true });
    }
  }
);
