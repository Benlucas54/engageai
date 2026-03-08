import type { ScrapedComment, EngagedComment, ContentScriptMessage, ContentScriptResponse } from "../lib/types";
import { initSidePanel, updatePanelData } from "./shared/side-panel";

function parseRelativeTime(text: string): string {
  // TikTok uses "33s ago", "2h ago", "1d ago", etc.
  const match = text.match(/(\d+)\s*(s|m|h|d|w|mo|y)/i);
  if (!match) return new Date().toISOString();
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const ms = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000, mo: 2592000000, y: 31536000000 }[unit] || 0;
  return new Date(Date.now() - num * ms).toISOString();
}

/**
 * Find the TikTok inbox/notification panel.
 * The inbox is a popout panel — no URL change.
 * We detect it by looking for inbox list items.
 */
function getInboxPanel(): Element | null {
  // Look for the container that holds inbox-list-item elements
  const items = document.querySelectorAll('div[data-e2e="inbox-list-item"]');
  if (items.length === 0) return null;

  // Walk up from the first item to find a common container
  let el: Element | null = items[0];
  for (let i = 0; i < 10; i++) {
    el = el?.parentElement || null;
    if (!el || el === document.body) break;
    // The container should hold all the inbox items
    const contained = el.querySelectorAll('div[data-e2e="inbox-list-item"]');
    if (contained.length >= items.length) return el;
  }

  // Fallback: use document
  return document.body;
}

interface InboxCard {
  username: string;
  card: Element;
  commentText: string;
  postUrl: string;
  timestamp: string;
}

function collectInboxCards(panel: Element, ownerUsername: string): InboxCard[] {
  const cards: InboxCard[] = [];
  const items = panel.querySelectorAll('div[data-e2e="inbox-list-item"]');

  for (const item of items) {
    // Check if this is a comment notification
    const contentEl = item.querySelector('p[data-e2e="inbox-content"]');
    if (!contentEl) continue;
    const contentText = contentEl.textContent || "";
    if (!contentText.includes("commented:")) continue;

    // Extract username from the profile link href (/@username)
    const titleLink = item.querySelector('a[data-e2e="inbox-title"]');
    const profileLink = item.querySelector('a[href^="/@"]');
    if (!profileLink) continue;

    const href = profileLink.getAttribute("href") || "";
    const usernameMatch = href.match(/^\/@([\w.]+)/);
    if (!usernameMatch) continue;
    const username = usernameMatch[1];
    if (!username) continue;
    if (ownerUsername && username.toLowerCase() === ownerUsername.toLowerCase()) continue;

    // Extract comment text from the span inside inbox-content
    // Format: " commented: Hi" followed by timestamp like "33s ago"
    const primarySpan = contentEl.querySelector('span');
    if (!primarySpan) continue;
    const spanText = primarySpan.textContent || "";
    const commentMatch = spanText.match(/\s*commented:\s*(.*)/);
    if (!commentMatch) continue;
    const commentText = commentMatch[1].trim();
    if (!commentText) continue;

    // Extract timestamp from the content text (e.g. "33s ago", "2h ago")
    const timeMatch = contentText.match(/(\d+(?:s|m|h|d|w|mo|y))\s*ago/i);
    const timestamp = timeMatch ? parseRelativeTime(timeMatch[1]) : new Date().toISOString();

    // Extract post URL from the video thumbnail link
    let postUrl = "https://www.tiktok.com";
    const videoLink = item.querySelector('a[href*="/video/"]');
    if (videoLink?.getAttribute("href")) {
      postUrl = new URL(videoLink.getAttribute("href")!, "https://www.tiktok.com").href;
    }

    cards.push({ username, card: item, commentText, postUrl, timestamp });
  }

  return cards;
}

interface ScrapeResult {
  comments: ScrapedComment[];
  engagedComments: EngagedComment[];
}

function scrapeInboxPanel(panel: Element, ownerUsername: string): ScrapeResult {
  const comments: ScrapedComment[] = [];
  const engagedComments: EngagedComment[] = [];

  console.log(`[EngageAI] Scraping TikTok inbox panel. Owner: @${ownerUsername || "(unknown)"}`);

  const allCards = collectInboxCards(panel, ownerUsername);
  console.log(`[EngageAI] Inbox cards found: ${allCards.length}`);

  const seenIds = new Set<string>();

  for (const { username, card, commentText, postUrl, timestamp } of allCards) {
    const extId = `tt:${username}:${[...commentText].slice(0, 30).join("")}`;
    if (seenIds.has(extId)) continue;
    seenIds.add(extId);

    console.log(`[EngageAI] => @${username}: "${commentText.slice(0, 60)}"`);

    comments.push({
      platform: "tiktok",
      username,
      comment_text: commentText,
      post_title: "Video",
      post_url: postUrl,
      comment_external_id: extId,
      created_at: timestamp,
    });
  }

  console.log(`[EngageAI] Total scraped: ${comments.length}, engaged: ${engagedComments.length}`);
  return { comments, engagedComments };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function scrape(ownerUsername: string): Promise<ScrapeResult> {
  const panel = getInboxPanel();
  if (!panel) {
    console.log("[EngageAI] TikTok inbox panel not detected");
    return { comments: [], engagedComments: [] };
  }

  // Small delay to let the panel fully render
  await delay(500);

  return scrapeInboxPanel(panel, ownerUsername);
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
      scrape(message.ownerUsername || "").then(({ comments, engagedComments }) => {
        sendResponse({ success: true, comments, engagedComments });
      });
      return true; // async response
    }

    if (message.action === "UPDATE_SIDE_PANEL") {
      if (message.sidePanelItems) {
        updatePanelData(message.sidePanelItems);
      }
      sendResponse({ success: true });
    }

    if (message.action === "JUMP_TO_COMMENT") {
      const { username, textPrefix } = message as any;
      console.log(`[EngageAI] JUMP_TO_COMMENT: username="${username}", textPrefix="${textPrefix}"`);
      const items = document.querySelectorAll('div[data-e2e="inbox-list-item"]');
      console.log(`[EngageAI] Found ${items.length} inbox items`);
      let found = false;
      for (const item of items) {
        // Extract username from inbox-title link or any profile link
        const titleLink = item.querySelector('a[data-e2e="inbox-title"]');
        const titleHref = titleLink?.getAttribute("href") || "";
        const titleMatch = titleHref.match(/^\/@([\w.]+)/);
        let itemUsername = titleMatch ? titleMatch[1] : "";

        // Fallback: try any /@username link (excluding /video/ paths)
        if (!itemUsername) {
          const links = item.querySelectorAll('a[href^="/@"]');
          for (const link of links) {
            const h = link.getAttribute("href") || "";
            if (h.includes("/video/")) continue;
            const m = h.match(/^\/@([\w.]+)/);
            if (m) { itemUsername = m[1]; break; }
          }
        }

        const text = item.textContent || "";
        console.log(`[EngageAI]   item: username="${itemUsername}", href="${titleHref}", text="${text.slice(0, 80)}"`);
        if (itemUsername.toLowerCase() === username.toLowerCase() && text.includes(textPrefix)) {
          found = true;
          item.scrollIntoView({ behavior: "smooth", block: "center" });
          // Inject style once
          const styleId = "engageai-highlight-style";
          if (!document.getElementById(styleId)) {
            const style = document.createElement("style");
            style.id = styleId;
            style.textContent = `
              .engageai-highlight,
              .engageai-highlight > * {
                background-color: rgba(249, 115, 22, 0.12) !important;
              }
              .engageai-highlight {
                outline: 2px solid #f97316 !important;
                outline-offset: -2px !important;
                border-radius: 8px !important;
              }
            `;
            document.head.appendChild(style);
          }
          // The inbox-list-item wrapper is 0x0; find the first child with actual dimensions
          let htmlEl: HTMLElement = item as HTMLElement;
          for (const child of item.children) {
            const c = child as HTMLElement;
            if (c.offsetWidth > 0 && c.offsetHeight > 0) {
              htmlEl = c;
              break;
            }
          }
          // If still 0x0, try the parent
          if (htmlEl.offsetWidth === 0 && item.parentElement) {
            const p = item.parentElement as HTMLElement;
            if (p.offsetWidth > 0) htmlEl = p;
          }
          console.log(`[EngageAI] Highlighting element:`, htmlEl.tagName, htmlEl.className.slice(0, 60), `dimensions: ${htmlEl.offsetWidth}x${htmlEl.offsetHeight}`);
          htmlEl.classList.add("engageai-highlight");
          setTimeout(() => {
            htmlEl.classList.remove("engageai-highlight");
          }, 3000);
          break;
        }
      }
      console.log(`[EngageAI] JUMP_TO_COMMENT result: found=${found}`);
      sendResponse({ success: true });
    }
  }
);
