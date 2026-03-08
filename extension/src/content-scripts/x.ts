import type { ScrapedComment, ContentScriptMessage, ContentScriptResponse } from "../lib/types";
import { initSidePanel, updatePanelData } from "./shared/side-panel";

function scrape(ownerUsername: string): ScrapedComment[] {
  const url = window.location.href;
  if (!url.includes("x.com")) return [];

  const postUrl = url.split("?")[0];

  const tweetEls = document.querySelectorAll(
    'article[data-testid="tweet"]'
  );

  const comments: ScrapedComment[] = [];

  for (const el of tweetEls) {
    const userNameEl = el.querySelector(
      'div[data-testid="User-Name"] a[href*="/"]'
    );
    const username =
      userNameEl
        ?.getAttribute("href")
        ?.replace("/", "")
        ?.split("/")[0] || "";

    const textEl = el.querySelector('div[data-testid="tweetText"]');
    const text = textEl?.textContent?.trim() || "";

    if (!username || !text) continue;
    if (ownerUsername && username.toLowerCase() === ownerUsername.toLowerCase()) continue;

    const timeEl = el.querySelector("time[datetime]");
    const created_at = timeEl?.getAttribute("datetime") || new Date().toISOString();

    comments.push({
      platform: "x",
      username,
      comment_text: text,
      post_title: "X Post",
      post_url: postUrl,
      comment_external_id: `x:${username}:${[...text].slice(0, 30).join("")}`,
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
          htmlEl.style.outline = "2px solid #f97316";
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
