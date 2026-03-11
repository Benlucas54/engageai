import type { ScrapedComment, ContentScriptMessage, ContentScriptResponse } from "../lib/types";
import { initSidePanel, updatePanelData } from "./shared/side-panel";
import { initOutboundOverlay } from "./shared/outbound-overlay";

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

// --- Outbound overlay ---
initOutboundOverlay({
  platform: "x",
  postContainerSelector: 'article[data-testid="tweet"]',
  getPostData: (container) => {
    const userLink = container.querySelector('div[data-testid="User-Name"] a[href*="/"]');
    const postAuthor = userLink?.getAttribute("href")?.replace("/", "")?.split("/")[0] || "";
    const textEl = container.querySelector('div[data-testid="tweetText"]');
    const postCaption = textEl?.textContent?.trim() || "";
    // Post URL: look for time element's parent link
    const timeLink = container.querySelector("time")?.closest("a");
    let postUrl = "";
    if (timeLink?.getAttribute("href")) {
      postUrl = new URL(timeLink.getAttribute("href")!, "https://x.com").href;
    } else if (/x\.com\/\w+\/status\//.test(window.location.href)) {
      postUrl = window.location.href.split("?")[0];
    }
    if (!postUrl) return null;

    // Media type detection
    let mediaType: string | undefined;
    if (container.querySelector('[data-testid="videoPlayer"]')) mediaType = "video";
    else if (container.querySelector('[data-testid="tweetPhoto"]')) mediaType = "image";
    else if (!postCaption) mediaType = "text";

    // Hashtag extraction
    const hashtags = postCaption.match(/#[\w]+/g) || undefined;

    // Existing comments (replies visible in thread, up to 5)
    const existingComments: { username: string; text: string }[] = [];
    const allTweets = document.querySelectorAll('article[data-testid="tweet"]');
    let foundSelf = false;
    for (const tweet of allTweets) {
      if (tweet === container) { foundSelf = true; continue; }
      if (!foundSelf) continue;
      if (existingComments.length >= 5) break;
      const replyUser = tweet.querySelector('div[data-testid="User-Name"] a[href*="/"]')?.getAttribute("href")?.replace("/", "")?.split("/")[0] || "";
      const replyText = tweet.querySelector('div[data-testid="tweetText"]')?.textContent?.trim() || "";
      if (replyUser && replyText) existingComments.push({ username: replyUser, text: replyText });
    }

    return { postUrl, postAuthor, postCaption, existingComments, mediaType, hashtags };
  },
});

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
