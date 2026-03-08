import type { ScrapedComment, ContentScriptMessage, ContentScriptResponse } from "../lib/types";
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

// --- Side panel ---
initSidePanel();

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

    if (message.action === "UPDATE_SIDE_PANEL") {
      if (message.sidePanelItems) {
        updatePanelData(message.sidePanelItems);
      }
      sendResponse({ success: true });
    }

    if (message.action === "JUMP_TO_COMMENT") {
      const { username, textPrefix } = message as any;
      const allEls = document.querySelectorAll(
        'ul ul li, div[class*="comment"], article[data-testid="tweet"], div[data-e2e="comment-item"], div[role="listitem"], div[role="article"]'
      );
      for (const el of allEls) {
        const text = el.textContent || "";
        if (text.includes(username) && text.includes(textPrefix)) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          const htmlEl = el as HTMLElement;
          const orig = htmlEl.style.outline;
          const origT = htmlEl.style.transition;
          htmlEl.style.transition = "outline 0.3s ease";
          htmlEl.style.outline = "2px solid #3a6e8c";
          setTimeout(() => {
            htmlEl.style.outline = orig;
            htmlEl.style.transition = origT;
          }, 3000);
          break;
        }
      }
      sendResponse({ success: true });
    }
  }
);
