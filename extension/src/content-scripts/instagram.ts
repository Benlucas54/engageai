import type { ScrapedComment, EngagedComment, ContentScriptMessage, ContentScriptResponse } from "../lib/types";
import { initSidePanel, updatePanelData } from "./shared/side-panel";

function parseRelativeTime(text: string): string {
  const match = text.match(/(\d+)\s*(s|m|h|d|w|mo|y)/i);
  if (!match) return new Date().toISOString();
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const ms = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000, mo: 2592000000, y: 31536000000 }[unit] || 0;
  return new Date(Date.now() - num * ms).toISOString();
}

function extractTimestamp(el: Element): string {
  // Instagram notifications use <abbr aria-label="5 days ago"><span>5d</span></abbr>
  const abbr = el.querySelector("abbr[aria-label]");
  if (abbr) {
    const spanText = abbr.querySelector("span")?.textContent?.trim();
    if (spanText) return parseRelativeTime(spanText);
    const label = abbr.getAttribute("aria-label") || "";
    if (label) return parseRelativeTime(label);
  }
  // Fallback: look for <time datetime>
  const timeEl = el.querySelector("time[datetime]");
  if (timeEl?.getAttribute("datetime")) return timeEl.getAttribute("datetime")!;
  // Fallback: relative time spans
  const spans = el.querySelectorAll("span");
  for (const s of spans) {
    const t = s.textContent?.trim() || "";
    if (/^\d+[smhdwy]$/.test(t) || /^\d+mo$/.test(t)) {
      return parseRelativeTime(t);
    }
  }
  return new Date().toISOString();
}

/**
 * Find the Instagram notification panel container element.
 * The panel is a side overlay — no URL change — so we detect by the
 * "Notifications" heading span, then walk up to find the panel root.
 * Returns null if the panel isn't open.
 */
function getNotificationPanel(): Element | null {
  const spans = document.querySelectorAll("span");
  for (const span of spans) {
    if (span.textContent?.trim() !== "Notifications") continue;
    // Verify this is the heading (it has specific Instagram classes, not a random match)
    // Walk up to find the panel container — the panel is typically a few levels up
    let el: Element | null = span;
    for (let i = 0; i < 10; i++) {
      el = el?.parentElement || null;
      if (!el) break;
      // The panel container should contain "commented:" notifications
      // and be a substantial container (not the whole body)
      if (el === document.body) return null;
      const text = el.textContent || "";
      if (text.includes("commented:") || text.includes("started following")) {
        // Found a container that holds notification content — use it
        return el;
      }
    }
  }
  return null;
}

interface NotificationCard {
  username: string;
  card: Element;
  commentText: string;
  postUrl: string;
}

function collectNotificationCards(panel: Element, ownerUsername: string): NotificationCard[] {
  const cards: NotificationCard[] = [];
  const seen = new Set<Element>();

  // Only search within the notification panel — never the whole page.
  // Each comment notification lives in a <span dir="auto"> with structure:
  //   <a href="/{username}/">...username...</a> commented: {text} <span>...{timestamp}...</span>
  const spans = panel.querySelectorAll('span[dir="auto"]');

  for (const span of spans) {
    const text = span.textContent || "";
    if (!text.includes("commented:")) continue;
    if (seen.has(span)) continue;

    // Find the profile link inside this span
    const profileLink = span.querySelector('a[href^="/"][role="link"]');
    if (!profileLink) continue;

    const href = profileLink.getAttribute("href") || "";
    if (!/^\/[\w.]+\/?$/.test(href)) continue;
    const username = href.replace(/\//g, "");
    if (!username) continue;
    if (ownerUsername && username.toLowerCase() === ownerUsername.toLowerCase()) continue;

    seen.add(span);

    // Extract comment text: everything between "commented: " and the timestamp
    // The timestamp is inside a child <abbr> or trailing span like "5d"
    // Use the span's textContent which is: "{username} commented: {comment text} {timestamp}"
    const afterCommented = text.split(/\s*commented:\s*/);
    if (afterCommented.length < 2) continue;

    let commentText = afterCommented.slice(1).join(" commented: "); // rejoin in case "commented:" appears in the comment
    // Strip trailing relative timestamp (e.g. "5d", "2h", "1w", "3mo")
    commentText = commentText.replace(/\s*\d+(s|m|h|d|w|mo|y)\s*$/i, "").trim();

    if (!commentText) continue;

    // Find post URL — walk up a few levels to find a link to a post
    let postUrl = "https://www.instagram.com";
    let parent: Element | null = span;
    for (let i = 0; i < 10; i++) {
      parent = parent?.parentElement || null;
      if (!parent) break;
      const postLink = parent.querySelector('a[href*="/p/"], a[href*="/reel/"]');
      if (postLink?.getAttribute("href")) {
        postUrl = new URL(postLink.getAttribute("href")!, "https://www.instagram.com").href;
        break;
      }
    }

    cards.push({ username, card: span, commentText, postUrl });
  }

  return cards;
}

function hasOwnerLiked(card: Element): boolean {
  const svgs = card.querySelectorAll("svg");
  for (const svg of svgs) {
    const label = (svg.getAttribute("aria-label") || "").toLowerCase();
    if (label === "unlike" || label === "liked") return true;
  }
  const buttons = card.querySelectorAll('div[role="button"], button');
  for (const btn of buttons) {
    const label = (btn.getAttribute("aria-label") || "").toLowerCase();
    if (label === "unlike") return true;
  }
  return false;
}

interface ScrapeResult {
  comments: ScrapedComment[];
  engagedComments: EngagedComment[];
}

function scrapeNotificationPanel(panel: Element, ownerUsername: string): ScrapeResult {
  const comments: ScrapedComment[] = [];
  const engagedComments: EngagedComment[] = [];

  console.log(`[EngageAI] Scraping Instagram notification panel. Owner: @${ownerUsername || "(unknown)"}`);

  const allCards = collectNotificationCards(panel, ownerUsername);
  console.log(`[EngageAI] Notification cards found: ${allCards.length}`);

  const seenIds = new Set<string>();

  for (const { username, card, commentText, postUrl } of allCards) {
    const liked = hasOwnerLiked(card);
    if (liked) {
      console.log(`[EngageAI] Skip @${username}: owner already liked — "${commentText.slice(0, 40)}"`);
      engagedComments.push({ username, comment_text: commentText });
      continue;
    }

    const extId = `ig:${username}:${[...commentText].slice(0, 30).join("")}`;
    if (seenIds.has(extId)) continue;
    seenIds.add(extId);

    console.log(`[EngageAI] => @${username}: "${commentText.slice(0, 60)}"`);

    comments.push({
      platform: "instagram",
      username,
      comment_text: commentText,
      post_title: "Post",
      post_url: postUrl,
      comment_external_id: extId,
      created_at: extractTimestamp(card),
    });
  }

  console.log(`[EngageAI] Total scraped: ${comments.length}, engaged: ${engagedComments.length}`);
  return { comments, engagedComments };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function scrape(ownerUsername: string): Promise<ScrapeResult> {
  const panel = getNotificationPanel();
  if (!panel) {
    console.log("[EngageAI] Instagram notification panel not detected");
    return { comments: [], engagedComments: [] };
  }

  // Small delay to let the panel fully render
  await delay(500);

  return scrapeNotificationPanel(panel, ownerUsername);
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
      // Search within the notification panel only
      const panel = getNotificationPanel();
      if (panel) {
        const spans = panel.querySelectorAll('span[dir="auto"]');
        for (const span of spans) {
          const text = span.textContent || "";
          if (text.includes(username) && text.includes(textPrefix)) {
            span.scrollIntoView({ behavior: "smooth", block: "center" });
            const htmlEl = span as HTMLElement;
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
      }
      sendResponse({ success: true });
    }
  }
);
