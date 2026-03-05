import type { ScrapedComment, CommentMark, ContentScriptMessage, ContentScriptResponse } from "../lib/types";
import { startReplyDetector } from "../lib/reply-detector";
import { showInlineWidget, showEngagementWidget } from "../lib/inline-widget";
import { initSidePanel, updatePanelData } from "./shared/side-panel";

function scrape(ownerUsername: string): ScrapedComment[] {
  const url = window.location.href;
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

// --- Inline reply helper ---
chrome.storage.local.get("inline_helper_enabled", ({ inline_helper_enabled }) => {
  if (inline_helper_enabled === false) return;
  startReplyDetector(
    "tiktok",
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
