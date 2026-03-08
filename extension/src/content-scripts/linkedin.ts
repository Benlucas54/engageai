import type { ScrapedComment, ContentScriptMessage, ContentScriptResponse } from "../lib/types";
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
