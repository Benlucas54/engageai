import type { ScrapedComment, ContentScriptMessage, ContentScriptResponse } from "../lib/types";
import { initSidePanel, updatePanelData } from "./shared/side-panel";

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
