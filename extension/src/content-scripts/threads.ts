import type { ScrapedComment, EngagedComment, ContentScriptMessage, ContentScriptResponse } from "../lib/types";

function parseRelativeTime(text: string): string {
  const match = text.match(/(\d+)\s*(s|m|h|d|w|mo|y)/i);
  if (!match) return new Date().toISOString();
  const num = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const ms = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000, mo: 2592000000, y: 31536000000 }[unit] || 0;
  return new Date(Date.now() - num * ms).toISOString();
}

function extractTimestamp(el: Element): string {
  // Try <time datetime> first
  const timeEl = el.querySelector("time[datetime]");
  if (timeEl?.getAttribute("datetime")) return timeEl.getAttribute("datetime")!;
  // Look for relative time spans like "2h", "3d"
  const spans = el.querySelectorAll('span[dir="auto"], span');
  for (const s of spans) {
    const t = s.textContent?.trim() || "";
    if (/^\d+[smhdwy]$/.test(t) || /^\d+mo$/.test(t)) {
      return parseRelativeTime(t);
    }
  }
  return new Date().toISOString();
}

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
      created_at: extractTimestamp(p.element),
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

    // Skip notifications that are NOT comments (likes, follows, mentions without text)
    const fullText = card.textContent?.toLowerCase() || "";
    if (/followed you/i.test(fullText) && !/replied/i.test(fullText) && !/commented/i.test(fullText)) continue;
    // "liked your" notifications are not comments — skip them
    if (/liked your/i.test(fullText) && !/replied/i.test(fullText) && !/commented/i.test(fullText)) continue;

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
  // Only check actual like BUTTONS, not decorative notification icons.
  // The like button is a clickable element with aria-label "Like" or "Unlike".
  // Notification badge icons (pink/red dots on profile pics) are NOT like buttons.
  const svgs = card.querySelectorAll("svg");
  for (const svg of svgs) {
    const label = (svg.getAttribute("aria-label") || "").toLowerCase();
    // "Unlike" means the owner already liked this comment
    if (label === "unlike" || label === "liked") return true;
    // "Like" means not yet liked — check if the SVG is a filled (red) heart
    // Only consider SVGs that are inside a button/clickable role and have a like-related label
    if (label === "like" || label === "love") {
      // This is the like button and it's not yet pressed — not liked
      continue;
    }
  }
  // Also check for heart count indicators like "❤️ 1" which means the owner liked
  const buttons = card.querySelectorAll('div[role="button"], button');
  for (const btn of buttons) {
    const label = (btn.getAttribute("aria-label") || "").toLowerCase();
    if (label === "unlike") return true;
  }
  return false;
}

interface ScrapeActivityResult {
  comments: ScrapedComment[];
  engagedComments: EngagedComment[];
}

function scrapeActivityPage(ownerUsername: string): ScrapeActivityResult {
  const comments: ScrapedComment[] = [];
  const engagedComments: EngagedComment[] = [];

  console.log(`[EngageAI] Scraping activity page. Owner: @${ownerUsername || "(unknown)"}`);

  const allCards = collectActivityCards(ownerUsername);
  console.log(`[EngageAI] Cards found: ${allCards.length}`);

  const seenIds = new Set<string>();

  for (const { username, card, texts, postUrl } of allCards) {
    // Skip cards with no meaningful comment text
    if (texts.length < 1) {
      console.log(`[EngageAI] Skip @${username}: no texts`);
      continue;
    }

    // The comment text is the last text span in the card
    const text = texts[texts.length - 1];
    if (!text) continue;

    // Check if the owner already LIKED this comment
    const liked = hasOwnerLiked(card);
    if (liked) {
      console.log(`[EngageAI] Skip @${username}: owner already liked — "${text.slice(0, 40)}"`);
      engagedComments.push({ username, comment_text: text });
      continue;
    }

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
      created_at: extractTimestamp(card),
    });
  }

  console.log(`[EngageAI] Total scraped: ${comments.length}, engaged: ${engagedComments.length}`);
  return { comments, engagedComments };
}

async function scrollToLoadMore(): Promise<void> {
  const scrollCount = 5;
  for (let i = 0; i < scrollCount; i++) {
    window.scrollTo(0, document.body.scrollHeight);
    await delay(1200);
  }
  // Scroll back to top
  window.scrollTo(0, 0);
  await delay(500);
}

async function scrape(ownerUsername: string): Promise<ScrapeActivityResult> {
  if (isPostPage()) return { comments: scrapePostPage(), engagedComments: [] };
  if (isActivityPage()) {
    // Scroll to load more notifications before scraping
    await scrollToLoadMore();
    return scrapeActivityPage(ownerUsername);
  }
  return { comments: [], engagedComments: [] };
}

function likeComment(container: Element): void {
  // Skip if already liked
  if (hasOwnerLiked(container)) return;
  // Find the heart/like SVG button
  const svgs = container.querySelectorAll("svg");
  for (const svg of svgs) {
    const label = (svg.getAttribute("aria-label") || "").toLowerCase();
    if (label === "like" || label === "love") {
      const btn = svg.closest('div[role="button"], button') as HTMLElement | null;
      if (btn) {
        btn.click();
        console.log("[EngageAI] Liked comment");
        return;
      }
    }
  }
}

async function setStatus(step: string, username: string) {
  await chrome.storage.local.set({
    send_status: { step, username, platform: "threads", ts: Date.now() },
  });
}

async function postReply(
  payload: ContentScriptMessage["payload"]
): Promise<ContentScriptResponse> {
  if (!payload) return { success: false, error: "No payload" };

  // Find the target comment container
  await setStatus("finding", payload.username);
  const containers = document.querySelectorAll('div[data-pressable-container="true"]');
  let targetContainer: Element | null = null;
  for (const container of containers) {
    const text = container.textContent || "";
    if (
      text.includes(payload.username) &&
      text.includes(payload.comment_text.slice(0, 20))
    ) {
      targetContainer = container;
      break;
    }
  }

  // Like the comment
  if (targetContainer) {
    await setStatus("liking", payload.username);
    likeComment(targetContainer);
    await delay(1500 + Math.random() * 500);
  }

  // Click the reply/comment icon on the target comment to open reply modal
  await setStatus("opening_reply", payload.username);
  if (targetContainer) {
    // Method 1: Find reply SVG by aria-label
    const svgs = targetContainer.querySelectorAll("svg");
    let clickedReplyIcon = false;
    for (const svg of svgs) {
      const label = (svg.getAttribute("aria-label") || "").toLowerCase();
      if (label === "reply" || label === "comment") {
        const btn = svg.closest('div[role="button"], button') as HTMLElement | null;
        if (btn) {
          btn.click();
          clickedReplyIcon = true;
          console.log("[EngageAI] Clicked reply icon via aria-label");
          break;
        }
      }
    }
    // Method 2: Find the speech bubble icon (second icon button after heart)
    if (!clickedReplyIcon) {
      const iconBtns = targetContainer.querySelectorAll('div[role="button"]');
      if (iconBtns.length >= 2) {
        (iconBtns[1] as HTMLElement).click();
        console.log("[EngageAI] Clicked reply icon (2nd button)");
      }
    }
  }

  await delay(2500);

  // Wait for the reply MODAL (dialog) to appear
  // The modal has "Cancel", "Reply" header, and a "Post" button
  let modal: Element | null = null;
  let replyArea: HTMLElement | null = null;
  for (let attempt = 0; attempt < 10; attempt++) {
    // Look for the modal dialog
    modal = document.querySelector('div[role="dialog"]');
    if (!modal) {
      // Fallback: look for a container that has both "Cancel" and "Post" text
      const allDivs = document.querySelectorAll("div");
      for (const div of allDivs) {
        const text = div.textContent || "";
        if (text.includes("Cancel") && text.includes("Post") && div.querySelector('div[contenteditable="true"]')) {
          modal = div;
          break;
        }
      }
    }

    if (modal) {
      // Find the contenteditable INSIDE the modal specifically
      replyArea = modal.querySelector(
        'div[contenteditable="true"], p[contenteditable="true"], div[role="textbox"]'
      ) as HTMLElement | null;
      if (replyArea) {
        console.log(`[EngageAI] Found reply area inside modal: <${replyArea.tagName}>`);
        break;
      }
    }

    console.log(`[EngageAI] Modal/reply area not found, retry ${attempt + 1}/10 (modal=${!!modal})`);
    // Re-click reply icon on retry 3
    if (attempt === 3 && targetContainer) {
      const svgs = targetContainer.querySelectorAll("svg");
      for (const svg of svgs) {
        const label = (svg.getAttribute("aria-label") || "").toLowerCase();
        if (label === "reply" || label === "comment") {
          const btn = svg.closest('div[role="button"], button') as HTMLElement | null;
          if (btn) { btn.click(); console.log("[EngageAI] Re-clicked reply icon"); break; }
        }
      }
    }
    await delay(1500);
  }

  if (!replyArea) {
    await setStatus("error", payload.username);
    return { success: false, error: "Reply area not found" };
  }

  // Retry loop: type, post, verify
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) {
      await setStatus("retrying", payload.username);
      console.log(`[EngageAI] Reply attempt ${attempt + 1}/3`);
      await delay(2000);
      // Re-find reply area inside the modal
      const m = document.querySelector('div[role="dialog"]');
      if (m) {
        replyArea = m.querySelector('div[contenteditable="true"], p[contenteditable="true"]') as HTMLElement | null;
      }
      if (!replyArea) continue;
    }

    replyArea.click();
    replyArea.focus();
    await delay(500);

    // Clear any previous text
    replyArea.textContent = "";
    replyArea.dispatchEvent(new InputEvent("input", { bubbles: true }));
    await delay(300);

    // Type character by character using execCommand for React/Lexical compat
    await setStatus("typing", payload.username);
    for (const char of payload.reply_text) {
      document.execCommand("insertText", false, char);
      replyArea.dispatchEvent(new InputEvent("input", { bubbles: true, data: char }));
      await delay(80 + Math.random() * 60);
    }

    await delay(500);

    // Verify typed text matches expected reply before posting
    const typed = (replyArea.textContent || "").trim();
    const expected = payload.reply_text.trim();
    if (typed !== expected) {
      console.log(`[EngageAI] Text mismatch — typed: "${typed.slice(0, 50)}" vs expected: "${expected.slice(0, 50)}"`);
      // Clear and paste the full text at once instead of char-by-char
      replyArea.focus();
      document.execCommand("selectAll");
      document.execCommand("delete");
      await delay(200);
      document.execCommand("insertText", false, expected);
      replyArea.dispatchEvent(new InputEvent("input", { bubbles: true }));
      await delay(500);

      // Final check
      const retyped = (replyArea.textContent || "").trim();
      if (retyped !== expected) {
        console.log(`[EngageAI] Still mismatched after correction: "${retyped.slice(0, 50)}"`);
      } else {
        console.log("[EngageAI] Text corrected successfully");
      }
    } else {
      console.log("[EngageAI] Text matches expected reply");
    }

    await delay(400 + Math.random() * 400);

    // Click Post button — look INSIDE the modal first, then page-wide
    await setStatus("posting", payload.username);
    let clicked = false;
    const searchRoot = modal || document;
    const buttons = searchRoot.querySelectorAll('div[role="button"], button');
    for (const btn of buttons) {
      const text = btn.textContent?.trim().toLowerCase();
      if (text === "post") {
        (btn as HTMLElement).click();
        clicked = true;
        console.log("[EngageAI] Clicked Post button");
        break;
      }
    }
    if (!clicked) {
      // Fallback: search entire page for Post button
      const allBtns = document.querySelectorAll('div[role="button"], button');
      for (const btn of allBtns) {
        if (btn.textContent?.trim().toLowerCase() === "post") {
          (btn as HTMLElement).click();
          clicked = true;
          console.log("[EngageAI] Clicked Post button (page-wide)");
          break;
        }
      }
    }
    if (!clicked) continue;

    // Verify: check if the modal closed (Threads closes it on successful post)
    // or if the reply text appears on the page
    await setStatus("verifying", payload.username);
    await delay(3000);

    const modalGone = !document.querySelector('div[role="dialog"]');
    const snippet = payload.reply_text.slice(0, 30);
    const textOnPage = document.body.innerText.includes(snippet);

    if (modalGone || textOnPage) {
      console.log(`[EngageAI] Reply verified (modalGone=${modalGone}, textOnPage=${textOnPage})`);
      await setStatus("done", payload.username);
      return {
        success: true,
        comment_external_id: payload.comment_external_id,
      };
    }
    console.log(`[EngageAI] Reply not verified, attempt ${attempt + 1}/3`);
  }

  await setStatus("error", payload.username);
  return { success: false, error: "Reply not confirmed after 3 attempts" };
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
      scrape(message.ownerUsername || "").then(({ comments, engagedComments }) => {
        sendResponse({ success: true, comments, engagedComments });
      });
      return true; // async response
    }

    if (message.action === "POST_REPLY") {
      postReply(message.payload).then(sendResponse);
      return true;
    }
  }
);
