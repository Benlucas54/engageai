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
  }
);
