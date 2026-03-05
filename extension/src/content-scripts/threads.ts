import type { ScrapedComment, EngagedComment, CommentMark, ContentScriptMessage, ContentScriptResponse } from "../lib/types";
import { startReplyDetector } from "../lib/reply-detector";
import { showInlineWidget, showEngagementWidget } from "../lib/inline-widget";
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

function isRepliesTab(): boolean {
  return /threads\.(net|com)\/activity\/replies/.test(window.location.href);
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

  for (const p of parsed) {
    const isOwner =
      p.isAuthor || (ownerUsername && p.username === ownerUsername);

    if (isOwner) continue;

    comments.push({
      platform: "threads",
      username: p.username,
      comment_text: p.text,
      post_title: postTitle,
      post_url: postUrl,
      comment_external_id: `th:${p.username}:${[...p.text].slice(0, 30).join("")}`,
      created_at: extractTimestamp(p.element),
    });
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

    // On the replies tab, every card is a reply — skip the notification text check.
    // On the general activity page, only accept reply/comment notifications.
    if (!isRepliesTab()) {
      const fullText = card.textContent?.toLowerCase() || "";
      const isReplyNotification =
        /replied to your/i.test(fullText) ||
        /commented on your/i.test(fullText) ||
        /replied to a thread/i.test(fullText);
      if (!isReplyNotification) {
        continue;
      }
    }

    // Collect meaningful text spans (the actual comment text)
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
        !/^[\d,.]+[KkMm]?$/.test(t) &&
        t.length > 3 &&
        !/^(like|reply|repost|share|send)$/i.test(t) &&
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
  const svgs = card.querySelectorAll("svg");
  for (const svg of svgs) {
    const label = (svg.getAttribute("aria-label") || "").toLowerCase();
    if (label === "unlike" || label === "liked") return true;
    if (label === "like" || label === "love") {
      continue;
    }
  }
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
    if (texts.length < 1) {
      console.log(`[EngageAI] Skip @${username}: no texts`);
      continue;
    }

    const text = texts[texts.length - 1];
    if (!text) continue;

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
    await scrollToLoadMore();
    return scrapeActivityPage(ownerUsername);
  }
  return { comments: [], engagedComments: [] };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// --- Comment indicators ---

const MARKER_CLASS = "engageai-marker";
const PANEL_CLASS = "engageai-suggestion-panel";

function clearMarkers(): void {
  document.querySelectorAll(`.${MARKER_CLASS}`).forEach((el) => el.remove());
  removeSuggestionPanels();
}

function removeSuggestionPanels(): void {
  document.querySelectorAll(`.${PANEL_CLASS}`).forEach((el) => el.remove());
}

function showSuggestionPanel(anchor: HTMLElement, mark: CommentMark): void {
  removeSuggestionPanels();

  const panel = document.createElement("div");
  panel.className = PANEL_CLASS;
  Object.assign(panel.style, {
    position: "absolute",
    top: "calc(100% + 6px)",
    left: "0",
    zIndex: "10000",
    background: "#fff",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    padding: "12px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    maxWidth: "320px",
    minWidth: "240px",
    fontSize: "13px",
    lineHeight: "1.5",
    color: "#333",
  });

  const label = document.createElement("div");
  label.textContent = "AI Suggestion";
  Object.assign(label.style, {
    fontSize: "10px",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#999",
    marginBottom: "6px",
  });
  panel.appendChild(label);

  if (mark.draftText) {
    const draft = document.createElement("div");
    draft.textContent = mark.draftText;
    Object.assign(draft.style, {
      marginBottom: "10px",
      padding: "8px",
      background: "#f5f5f5",
      borderRadius: "6px",
      fontSize: "12px",
      lineHeight: "1.6",
    });
    panel.appendChild(draft);
  } else {
    const noDraft = document.createElement("div");
    noDraft.textContent = "No suggestion generated yet";
    Object.assign(noDraft.style, { marginBottom: "10px", color: "#999", fontSize: "12px" });
    panel.appendChild(noDraft);
  }

  const btnRow = document.createElement("div");
  Object.assign(btnRow.style, { display: "flex", gap: "6px" });

  if (mark.draftText) {
    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy";
    Object.assign(copyBtn.style, {
      padding: "6px 12px",
      borderRadius: "6px",
      border: "none",
      background: "#333",
      color: "#fff",
      fontSize: "11px",
      fontWeight: "600",
      cursor: "pointer",
    });
    copyBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      navigator.clipboard.writeText(mark.draftText!).catch(() => {});
      copyBtn.textContent = "Copied!";
      setTimeout(() => removeSuggestionPanels(), 800);
    });
    btnRow.appendChild(copyBtn);
  } else {
    const genBtn = document.createElement("button");
    genBtn.textContent = "Generate";
    Object.assign(genBtn.style, {
      padding: "6px 12px",
      borderRadius: "6px",
      border: "none",
      background: "#333",
      color: "#fff",
      fontSize: "11px",
      fontWeight: "600",
      cursor: "pointer",
    });
    genBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      e.preventDefault();
      genBtn.textContent = "Generating...";
      genBtn.style.opacity = "0.6";
      chrome.runtime.sendMessage(
        { action: "GENERATE_SUGGESTION_FOR_COMMENT", commentExternalId: mark.comment_external_id },
        (res) => {
          if (res?.success && res.draftText) {
            mark.draftText = res.draftText;
            removeSuggestionPanels();
            showSuggestionPanel(anchor, mark);
          } else {
            genBtn.textContent = "Failed";
            genBtn.style.opacity = "1";
          }
        }
      );
    });
    btnRow.appendChild(genBtn);
  }

  const dismissBtn = document.createElement("button");
  dismissBtn.textContent = "Dismiss";
  Object.assign(dismissBtn.style, {
    padding: "6px 12px",
    borderRadius: "6px",
    border: "1px solid #ddd",
    background: "transparent",
    color: "#666",
    fontSize: "11px",
    cursor: "pointer",
  });
  dismissBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    removeSuggestionPanels();
  });
  btnRow.appendChild(dismissBtn);
  panel.appendChild(btnRow);

  const parent = anchor.parentElement;
  if (parent) {
    parent.style.position = "relative";
    parent.appendChild(panel);
  }
}

// Close panels on outside click
document.addEventListener("click", (e) => {
  const target = e.target as HTMLElement;
  if (!target.closest(`.${PANEL_CLASS}`) && !target.closest(`.${MARKER_CLASS}`)) {
    removeSuggestionPanels();
  }
});

function injectMarkers(marks: CommentMark[]): void {
  clearMarkers();
  const containers = document.querySelectorAll('div[data-pressable-container="true"]');
  for (const mark of marks) {
    for (const el of containers) {
      const text = el.textContent || "";
      if (text.includes(mark.username) && text.includes(mark.comment_text_prefix)) {
        const spans = el.querySelectorAll('span[dir="auto"]');
        const usernameSpan = spans[0];
        if (usernameSpan) {
          const badge = document.createElement("span");
          badge.className = MARKER_CLASS;
          const hasDraft = !!mark.draftText;
          Object.assign(badge.style, {
            display: "inline-flex",
            alignItems: "center",
            padding: "1px 6px",
            borderRadius: "10px",
            backgroundColor: hasDraft ? "#e8f4fd" : "#f0ddb8",
            color: hasDraft ? "#1a73a7" : "#92600a",
            fontSize: "10px",
            fontWeight: "600",
            marginLeft: "6px",
            cursor: "pointer",
            position: "relative",
            zIndex: "9999",
            lineHeight: "1.4",
          });
          badge.textContent = hasDraft ? "AI" : "Pending";
          badge.title = hasDraft ? "Click to view AI suggestion" : "Click for options";
          badge.addEventListener("click", (e) => {
            e.stopPropagation();
            e.preventDefault();
            showSuggestionPanel(badge, mark);
          });
          usernameSpan.parentElement?.insertBefore(badge, usernameSpan.nextSibling);
        }
        break;
      }
    }
  }
}

// --- Inline reply helper ---
chrome.storage.local.get("inline_helper_enabled", ({ inline_helper_enabled }) => {
  if (inline_helper_enabled === false) return;
  startReplyDetector(
    "threads",
    (ctx) => showInlineWidget(ctx),
    (ctx) => showEngagementWidget(ctx)
  );
});

// --- Side panel ---
initSidePanel();

// Clear markers on SPA navigation
let _lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== _lastUrl) {
    _lastUrl = location.href;
    clearMarkers();
  }
}).observe(document.body, { childList: true, subtree: true });

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

    if (message.action === "MARK_COMMENTS") {
      injectMarkers(message.marks || []);
      sendResponse({ success: true });
    }

    if (message.action === "CLEAR_MARKS") {
      clearMarkers();
      sendResponse({ success: true });
    }

    if (message.action === "UPDATE_SIDE_PANEL") {
      if (message.sidePanelItems) {
        updatePanelData(message.sidePanelItems);
      }
      sendResponse({ success: true });
    }

    if (message.action === "SHOW_SUGGESTION") {
      const containers = document.querySelectorAll('div[data-pressable-container="true"]');
      for (const el of containers) {
        const text = el.textContent || "";
        if (message.username && text.includes(message.username)) {
          const spans = el.querySelectorAll('span[dir="auto"]');
          if (spans[0]) {
            showSuggestionPanel(spans[0] as HTMLElement, {
              comment_external_id: message.commentExternalId || "",
              username: message.username,
              comment_text_prefix: "",
              status: "flagged",
              draftText: message.draftText,
              postUrl: message.postUrl,
              commentId: message.commentId,
            });
            break;
          }
        }
      }
      sendResponse({ success: true });
    }
  }
);
