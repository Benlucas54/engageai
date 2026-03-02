import type { ScrapedComment, ContentScriptMessage, ContentScriptResponse } from "../lib/types";

function scrape(): ScrapedComment[] {
  const url = window.location.href;
  if (!url.includes("x.com")) return [];

  const postUrl = url.split("?")[0];

  // Find tweets
  const tweetEls = document.querySelectorAll(
    'article[data-testid="tweet"]'
  );

  const comments: ScrapedComment[] = [];

  for (const el of tweetEls) {
    // Extract username
    const userNameEl = el.querySelector(
      'div[data-testid="User-Name"] a[href*="/"]'
    );
    const username =
      userNameEl
        ?.getAttribute("href")
        ?.replace("/", "")
        ?.split("/")[0] || "";

    // Extract tweet text
    const textEl = el.querySelector('div[data-testid="tweetText"]');
    const text = textEl?.textContent?.trim() || "";

    if (!username || !text) continue;

    // Extract timestamp from <time datetime="...">
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
      // X posting is disabled — monitor only
      sendResponse({ success: false, error: "X posting disabled" });
    }
  }
);
