import type { ScrapedComment, ContentScriptMessage, ContentScriptResponse } from "../lib/types";

function isPostPage(): boolean {
  return /threads\.(net|com)\/@[\w.]+\/post\//.test(window.location.href);
}

function isActivityPage(): boolean {
  return /threads\.(net|com)\/(activity|@[\w.]+\/replies)/.test(window.location.href);
}

interface ParsedContainer {
  username: string;
  text: string;
  isAuthor: boolean;
  element: Element;
}

function parseContainer(el: Element): ParsedContainer | null {
  const spans = el.querySelectorAll('span[dir="auto"]');
  const username = spans[0]?.textContent?.trim().replace("@", "") || "";

  // Check if this container has the "Author" badge
  const isAuthor = Array.from(spans).some(
    (s) => s.textContent?.trim() === "Author"
  );

  // Find the actual comment text: skip meta spans
  let text = "";
  for (let i = 1; i < spans.length; i++) {
    const t = spans[i]?.textContent?.trim();
    if (
      t &&
      t !== "·" &&
      t !== "Author" &&
      !/^\d+$/.test(t) &&
      t.length > 1
    ) {
      text = t;
      break;
    }
  }

  if (!username || !text) return null;
  return { username, text, isAuthor, element: el };
}

function scrapePostPage(): ScrapedComment[] {
  const postUrl = window.location.href.split("?")[0];

  // Get original post text as title
  const firstPost = document.querySelector(
    'div[data-pressable-container="true"] span, div[class*="text"] span'
  );
  const postTitle = firstPost?.textContent?.trim().slice(0, 50) || "Thread";

  // Get all reply containers (skip first = original post)
  const containers = document.querySelectorAll(
    'div[data-pressable-container="true"]'
  );
  const containerArr = Array.from(containers).slice(1);

  // Parse all containers to understand the conversation flow
  const parsed: ParsedContainer[] = [];
  for (const el of containerArr) {
    const p = parseContainer(el);
    if (p) parsed.push(p);
  }

  // Detect the owner username from "Author" badges
  const ownerUsername = parsed.find((p) => p.isAuthor)?.username || "";

  const comments: ScrapedComment[] = [];

  // Walk through the conversation:
  // - Capture all comments from non-owner users
  // - This includes top-level replies AND replies-to-owner-replies
  // - The dedup in Supabase will filter out previously processed ones
  let lastWasOwner = false;

  for (const p of parsed) {
    const isOwner =
      p.isAuthor || (ownerUsername && p.username === ownerUsername);

    if (isOwner) {
      lastWasOwner = true;
      continue;
    }

    // This is a non-owner comment — could be:
    // 1. A top-level reply to the post
    // 2. A reply to the owner's reply (conversation continuation)
    // Both should be captured.
    comments.push({
      platform: "threads",
      username: p.username,
      comment_text: p.text,
      post_title: postTitle,
      post_url: postUrl,
      comment_external_id: `th:${p.username}:${[...p.text].slice(0, 30).join("")}`,
      created_at: new Date().toISOString(),
    });

    lastWasOwner = false;
  }

  return comments;
}

interface ActivityCard {
  username: string;
  card: Element;
  texts: string[];
  postUrl: string;
}

function collectActivityCards(ownerUsername: string): ActivityCard[] {
  const allLinks = document.querySelectorAll('a[href^="/@"]');
  const profileLinks: Element[] = [];
  for (const link of allLinks) {
    const href = link.getAttribute("href") || "";
    if (/^\/@[\w.]+\/?$/.test(href)) {
      profileLinks.push(link);
    }
  }

  console.log(`[EngageAI] Found ${profileLinks.length} profile links`);

  const seen = new Set<Element>();
  const cards: ActivityCard[] = [];

  for (const link of profileLinks) {
    const href = link.getAttribute("href") || "";
    const username = href.match(/@([\w.]+)/)?.[1] || "";
    if (!username) continue;
    if (ownerUsername && username.toLowerCase() === ownerUsername.toLowerCase()) continue;

    // Walk up to find the OUTERMOST notification container
    let el: Element | null = link;
    let card: Element | null = null;
    for (let i = 0; i < 15; i++) {
      el = el?.parentElement || null;
      if (!el) break;
      const role = el.getAttribute("role");
      const dp = el.getAttribute("data-pressable-container");
      if (role === "listitem" || role === "article" || role === "row" || dp === "true") {
        card = el;
      }
    }
    if (!card) card = el;
    if (!card || seen.has(card)) continue;
    seen.add(card);

    // Skip non-reply notifications (likes, follows)
    const fullText = card.textContent?.toLowerCase() || "";
    if (/followed you/i.test(fullText) && !/replied/i.test(fullText)) continue;
    if (/liked/i.test(fullText) && !/replied/i.test(fullText) && !/commented/i.test(fullText)) continue;

    // Collect meaningful text spans
    const spans = card.querySelectorAll('span[dir="auto"], span[dir="ltr"]');
    const texts: string[] = [];
    for (const s of spans) {
      const t = s.textContent?.trim();
      if (
        t &&
        t !== "·" &&
        t !== "Author" &&
        t !== username &&
        t !== `@${username}` &&
        t !== ownerUsername &&
        t !== `@${ownerUsername}` &&
        !/^\d+[smhd]?$/.test(t) &&
        t.length > 3 &&
        !/^replied to/i.test(t) &&
        !/^liked your/i.test(t) &&
        !/^mentioned you/i.test(t) &&
        !/^followed/i.test(t) &&
        !/^commented on/i.test(t) &&
        !/^quoted your/i.test(t) &&
        !/\band \d+ others?\b/i.test(t)
      ) {
        texts.push(t);
      }
    }

    // Find post link
    const postLink = card.querySelector('a[href*="/post/"]');
    const postUrl = postLink?.getAttribute("href")
      ? new URL(postLink.getAttribute("href")!, window.location.origin).href
      : window.location.href;

    cards.push({ username, card, texts, postUrl });
  }

  return cards;
}

function hasOwnerLiked(card: Element): boolean {
  // Check for filled heart / "Unlike" button indicating the owner liked this
  const svgs = card.querySelectorAll("svg");
  for (const svg of svgs) {
    const label = svg.getAttribute("aria-label")?.toLowerCase() || "";
    if (label === "unlike" || label === "liked") return true;
    // Check for red/filled heart SVG
    const fill = svg.getAttribute("fill") || "";
    if (fill.includes("255") || fill.includes("red") || fill === "#ff3040") return true;
    // Check child path elements for red fill
    const paths = svg.querySelectorAll("path, circle");
    for (const p of paths) {
      const pFill = p.getAttribute("fill") || "";
      if (pFill.includes("255") || pFill.includes("red") || pFill === "#ff3040") return true;
    }
  }
  return false;
}

function scrapeActivityPage(ownerUsername: string): ScrapedComment[] {
  const comments: ScrapedComment[] = [];

  console.log(`[EngageAI] Scraping activity page. Owner: @${ownerUsername || "(unknown)"}`);

  const allCards = collectActivityCards(ownerUsername);
  console.log(`[EngageAI] Cards found: ${allCards.length}`);

  // --- Pass 1: Count text frequency across all cards ---
  // Post captions appear in multiple cards (freq > 1).
  // Owner's unique replies appear once (freq == 1).
  const textFrequency = new Map<string, number>();
  for (const { texts } of allCards) {
    for (const t of texts) {
      textFrequency.set(t, (textFrequency.get(t) || 0) + 1);
    }
  }

  // --- Pass 2: Filter and select ---
  const seenIds = new Set<string>();

  for (const { username, card, texts, postUrl } of allCards) {
    // Skip cards with < 2 texts (like/mention notifications)
    if (texts.length < 2) continue;

    // Check if the owner already LIKED this comment
    if (hasOwnerLiked(card)) {
      console.log(`[EngageAI] Skip @${username}: owner already liked`);
      continue;
    }

    // Check if the owner already REPLIED to this comment.
    // texts[0] is the owner's content (context). If it's unique (freq == 1),
    // it's the owner's specific reply to this commenter, not a post caption.
    const ownerText = texts[0];
    const ownerTextFreq = textFrequency.get(ownerText) || 0;
    if (ownerTextFreq <= 1) {
      console.log(`[EngageAI] Skip @${username}: owner already replied ("${ownerText.slice(0, 40)}…")`);
      continue;
    }

    // Take the LAST text — that's the commenter's reply
    const text = texts[texts.length - 1];
    if (!text) continue;

    const extId = `th:${username}:${[...text].slice(0, 30).join("")}`;
    if (seenIds.has(extId)) continue;
    seenIds.add(extId);

    console.log(`[EngageAI] => @${username}: "${text.slice(0, 60)}"`);

    comments.push({
      platform: "threads",
      username,
      comment_text: text,
      post_title: "Thread",
      post_url: postUrl,
      comment_external_id: extId,
      created_at: new Date().toISOString(),
    });
  }

  console.log(`[EngageAI] Total scraped: ${comments.length}`);
  return comments;
}

function scrape(ownerUsername: string): ScrapedComment[] {
  if (isPostPage()) return scrapePostPage();
  if (isActivityPage()) return scrapeActivityPage(ownerUsername);
  return [];
}

async function postReply(
  payload: ContentScriptMessage["payload"]
): Promise<ContentScriptResponse> {
  if (!payload) return { success: false, error: "No payload" };

  // Find reply input area
  const replyArea = document.querySelector(
    'div[contenteditable="true"], textarea[placeholder*="Reply"], div[role="textbox"]'
  ) as HTMLElement | null;

  if (!replyArea) return { success: false, error: "Reply area not found" };

  replyArea.click();
  replyArea.focus();
  await delay(500);

  // Type character by character
  for (const char of payload.reply_text) {
    if (replyArea.tagName === "TEXTAREA") {
      const textarea = replyArea as HTMLTextAreaElement;
      const nativeSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        "value"
      )?.set;
      nativeSetter?.call(textarea, textarea.value + char);
    } else {
      // contenteditable div
      replyArea.textContent = (replyArea.textContent || "") + char;
    }
    replyArea.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await delay(80 + Math.random() * 60);
  }

  await delay(800 + Math.random() * 400);

  // Click Post/Reply button
  const buttons = document.querySelectorAll(
    'div[role="button"], button'
  );
  for (const btn of buttons) {
    const text = btn.textContent?.trim().toLowerCase();
    if (text === "post" || text === "reply") {
      (btn as HTMLElement).click();
      await delay(2000);
      return {
        success: true,
        comment_external_id: payload.comment_external_id,
      };
    }
  }

  return { success: false, error: "Post button not found" };
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
      const comments = scrape(message.ownerUsername || "");
      sendResponse({ success: true, comments });
    }

    if (message.action === "POST_REPLY") {
      postReply(message.payload).then(sendResponse);
      return true;
    }
  }
);
