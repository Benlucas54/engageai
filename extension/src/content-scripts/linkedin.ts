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

function isNotificationsPage(): boolean {
  return /linkedin\.com\/notifications/i.test(window.location.href);
}

function isPostPage(): boolean {
  return /linkedin\.com\/(feed\/update|posts|pulse)\//i.test(window.location.href);
}

// --- Notifications page scraper ---

function scrapeNotifications(ownerUsername: string): ScrapedComment[] {
  console.log(`[EngageAI] Scraping LinkedIn notifications. Owner: ${ownerUsername || "(unknown)"}`);

  // Find notification cards by walking up from headline links
  // LinkedIn's card container class can vary, so anchor on the stable a.nt-card__headline
  const headlines = document.querySelectorAll('a[class*="nt-card__headline"]');
  console.log(`[EngageAI] Found ${headlines.length} headline links`);

  // Collect unique parent cards (walk up to find a reasonable container)
  const seen = new Set<Element>();
  const cards: Element[] = [];
  for (const hl of headlines) {
    let el: Element | null = hl.parentElement;
    // Walk up a few levels to find the card container
    for (let i = 0; i < 8; i++) {
      if (!el) break;
      const cls = el.className || "";
      if (/nt-card/i.test(cls) && !/(list|container)/i.test(cls)) {
        break;
      }
      el = el.parentElement;
    }
    const card = el || hl.parentElement;
    if (card && !seen.has(card)) {
      seen.add(card);
      cards.push(card);
    }
  }
  console.log(`[EngageAI] Found ${cards.length} notification cards`);

  const comments: ScrapedComment[] = [];
  const seenIds = new Set<string>();

  for (const card of cards) {
    // The headline link: a.nt-card__headline contains "<strong>Name</strong> commented on your post."
    const headline = card.querySelector("a.nt-card__headline");
    if (!headline) continue;

    const headlineText = headline.textContent || "";

    // POSITIVE filter: only "commented on your" notifications
    if (!/commented on your/i.test(headlineText)) continue;

    // Extract commenter name from <strong> inside the headline
    const strongEl = headline.querySelector("strong");
    const username = strongEl?.textContent?.trim() || "";
    if (!username) {
      console.log(`[EngageAI] Skip card: no username. Headline: "${headlineText.slice(0, 80)}"`);
      continue;
    }

    // Skip own comments
    if (ownerUsername && username.toLowerCase() === ownerUsername.toLowerCase()) continue;

    // Extract comment text from the body div below the headline
    // Structure: div.nt-card__text--2-line-large contains the actual comment
    const bodyEl = card.querySelector(
      'div[class*="nt-card__text--2-line"], div[class*="nt-card__text--3-line"]:not(.nt-card__headline *)'
    );
    // Fallback: try any div with nt-card__text that's NOT inside the headline
    let commentText = "";
    if (bodyEl && !headline.contains(bodyEl)) {
      commentText = bodyEl.textContent?.trim() || "";
    }
    // Second fallback: look for siblings of the headline
    if (!commentText) {
      const siblings = card.querySelectorAll("div[class*='nt-card__text']");
      for (const sib of siblings) {
        if (headline.contains(sib)) continue;
        const t = sib.textContent?.trim() || "";
        if (t.length > 1) {
          commentText = t;
          break;
        }
      }
    }

    if (!commentText) {
      console.log(`[EngageAI] Skip ${username}: no comment text found`);
      continue;
    }

    // Extract post URL from the headline link href
    let postUrl = window.location.href;
    const href = headline.getAttribute("href") || "";
    if (href) {
      postUrl = href.startsWith("http") ? href.split("?")[0] : new URL(href.split("?")[0], window.location.origin).href;
    }

    // Extract timestamp
    const timeEl = card.querySelector("time[datetime]");
    let created_at = timeEl?.getAttribute("datetime") || "";
    if (!created_at) {
      const fullText = card.textContent || "";
      const relMatch = fullText.match(/\b(\d+)\s*(s|m|h|d|w|mo|y)\b/i);
      created_at = relMatch ? parseRelativeTime(relMatch[0]) : new Date().toISOString();
    }

    const extId = `li:${username}:${[...commentText].slice(0, 30).join("")}`;
    if (seenIds.has(extId)) continue;
    seenIds.add(extId);

    console.log(`[EngageAI] => ${username}: "${commentText.slice(0, 60)}"`);

    comments.push({
      platform: "linkedin",
      username,
      comment_text: commentText,
      post_title: "LinkedIn Post",
      post_url: postUrl,
      comment_external_id: extId,
      created_at,
    });
  }

  console.log(`[EngageAI] Total scraped from notifications: ${comments.length}`);
  return comments;
}

// --- Post page scraper (existing) ---

function scrapePostPage(ownerUsername: string): ScrapedComment[] {
  const postUrl = window.location.href.split("?")[0];

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

// --- Main scrape entry ---

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function scrollToLoadMore(): Promise<void> {
  const scrollCount = 3;
  for (let i = 0; i < scrollCount; i++) {
    window.scrollTo(0, document.body.scrollHeight);
    await delay(1200);
  }
  window.scrollTo(0, 0);
  await delay(500);
}

async function scrape(ownerUsername: string): Promise<{ comments: ScrapedComment[]; engagedComments: EngagedComment[] }> {
  if (isNotificationsPage()) {
    await scrollToLoadMore();
    const comments = scrapeNotifications(ownerUsername);
    return { comments, engagedComments: [] };
  }
  if (isPostPage()) {
    const comments = scrapePostPage(ownerUsername);
    return { comments, engagedComments: [] };
  }
  return { comments: [], engagedComments: [] };
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

      // On notifications page, find the individual card via headline links
      let found = false;
      if (isNotificationsPage()) {
        const headlines = document.querySelectorAll('a[class*="nt-card__headline"]');
        for (const hl of headlines) {
          // Walk up to find the card container
          let card: Element | null = hl.parentElement;
          for (let i = 0; i < 8; i++) {
            if (!card) break;
            const cls = card.className || "";
            if (/nt-card/i.test(cls) && !/(list|container)/i.test(cls)) break;
            card = card.parentElement;
          }
          if (!card) card = hl.parentElement;
          if (!card) continue;
          const text = card.textContent || "";
          if (text.includes(username) && text.includes(textPrefix)) {
            card.scrollIntoView({ behavior: "smooth", block: "center" });
            const htmlEl = card as HTMLElement;
            const orig = htmlEl.style.outline;
            const origT = htmlEl.style.transition;
            htmlEl.style.transition = "outline 0.3s ease";
            htmlEl.style.outline = "2px solid #f97316";
            setTimeout(() => { htmlEl.style.outline = orig; htmlEl.style.transition = origT; }, 3000);
            found = true;
            break;
          }
        }
      }

      // Fallback for post pages / other views
      if (!found) {
        const allEls = document.querySelectorAll(
          'article.comments-comment-item, div[class*="comments-comment-item"], div[role="listitem"], div[role="article"]'
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
            setTimeout(() => { htmlEl.style.outline = orig; htmlEl.style.transition = origT; }, 3000);
            break;
          }
        }
      }
      sendResponse({ success: true });
    }
  }
);
