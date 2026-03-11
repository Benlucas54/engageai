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

  // Collect unique parent cards — the card is div.nt-card__container
  const seen = new Set<Element>();
  const cards: Element[] = [];
  for (const hl of headlines) {
    let el: Element | null = hl.parentElement;
    // Walk up to find div.nt-card__container (the individual notification card)
    for (let i = 0; i < 8; i++) {
      if (!el) break;
      const cls = el.className || "";
      if (/nt-card__container/i.test(cls)) {
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
    const headline = card.querySelector("a.nt-card__headline") || card.querySelector('a[class*="nt-card__headline"]');
    if (!headline) continue;

    const headlineText = headline.textContent?.replace(/\s+/g, " ").trim() || "";

    // NEGATIVE filter: skip reactions (e.g. "reacted to ... post that mentioned you")
    if (/reacted to/i.test(headlineText)) continue;

    // POSITIVE filter: "commented on your" OR "mentioned you"
    const isComment = /commented on your/i.test(headlineText);
    const isMention = /mentioned you/i.test(headlineText);
    if (!isComment && !isMention) continue;

    // Extract commenter name from <strong> inside the headline
    const strongEl = headline.querySelector("strong");
    const username = strongEl?.textContent?.trim() || "";
    if (!username) continue;

    // Skip own comments
    if (ownerUsername && username.toLowerCase() === ownerUsername.toLowerCase()) continue;

    // Extract comment/mention text from the card body
    let commentText = "";

    // Strategy 1: artdeco-card button/div → first direct child div with comment text
    const artdecoCard = card.querySelector("button.artdeco-card, div.artdeco-card");
    if (artdecoCard) {
      for (const child of artdecoCard.children) {
        if (child.tagName === "DIV") {
          // Skip the post body
          if (/nt-card-content__body/i.test(child.className || "")) continue;
          const t = child.textContent?.trim() || "";
          if (t.length > 0 && t.length < 500) {
            commentText = t;
            break;
          }
        }
      }
    }

    // Strategy 2: nt-card__text divs NOT in headline and NOT the post body
    if (!commentText) {
      const textDivs = card.querySelectorAll('div[class*="nt-card__text"]');
      for (const div of textDivs) {
        if (headline.contains(div)) continue;
        if (/nt-card-content__body/i.test(div.className || "")) continue;
        if (/nt-card__text--3-line/i.test(div.className || "")) continue;
        const t = div.textContent?.trim() || "";
        if (t.length > 0 && t.length < 500) {
          commentText = t;
          break;
        }
      }
    }

    // Strategy 3: For mentions, use the repost body text
    if (!commentText && isMention) {
      const bodyTextEl = card.querySelector('div[class*="nt-card-content__body-text"]');
      if (bodyTextEl) {
        commentText = bodyTextEl.textContent?.trim() || "";
      }
    }

    if (!commentText) {
      console.log(`[EngageAI] Skip ${username}: no comment/mention text found`);
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
      post_title: isMention ? "LinkedIn Mention" : "LinkedIn Post",
      post_url: postUrl,
      comment_external_id: extId,
      created_at,
    });
  }

  console.log(`[EngageAI] Total scraped from notifications: ${comments.length}`);
  return comments;
}

// --- Post page scraper (existing) ---

function expandComments(): void {
  // Click "load more comments" / "show previous comments" buttons
  const loadMoreSelectors = [
    'button[class*="show-previous"]',
    'button[class*="comments-comments-list__load-more"]',
    'button[aria-label*="Load more comments"]',
    'button[aria-label*="Show previous"]',
    'button[aria-label*="more comments"]',
  ];
  for (const sel of loadMoreSelectors) {
    const btns = document.querySelectorAll(sel);
    for (const btn of btns) {
      (btn as HTMLElement).click();
    }
  }
}

function scrapePostPage(ownerUsername: string): ScrapedComment[] {
  const postUrl = window.location.href.split("?")[0];

  // Try to expand collapsed comments
  expandComments();

  const commentEls = document.querySelectorAll(
    'article.comments-comment-entity, article.comments-comment-item, div[class*="comments-comment-item"], div[data-id][class*="comment"]'
  );

  const comments: ScrapedComment[] = [];

  for (const el of commentEls) {
    // Author name: try multiple selectors for different LinkedIn layouts
    const authorEl = el.querySelector(
      'span.comments-comment-meta__description-title, a[class*="comment__author"] span, span[class*="hoverable-link-text"] span, a[data-tracking-control-name*="comment"] span'
    );
    const username = authorEl?.textContent?.trim() || "";

    // Comment text: try the main content span first, then fallbacks
    const textEl = el.querySelector(
      'span.comments-comment-item__main-content span[dir="ltr"], span[class*="comment__text"] span, div[class*="comment__text"] span, span[dir="ltr"]'
    );
    const text = textEl?.textContent?.trim() || "";

    if (!username || !text) continue;
    if (ownerUsername && username.toLowerCase() === ownerUsername.toLowerCase()) continue;

    const timeEl = el.querySelector("time[datetime], time");
    let created_at = timeEl?.getAttribute("datetime") || "";
    if (!created_at) {
      const relText = timeEl?.textContent?.trim() || "";
      created_at = relText ? parseRelativeTime(relText) : new Date().toISOString();
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
    expandComments();
    await delay(1000);
    const comments = scrapePostPage(ownerUsername);
    return { comments, engagedComments: [] };
  }
  return { comments: [], engagedComments: [] };
}

// --- "EngageAI" action bar button ---

const ACTION_BTN_ATTR = "data-engageai-reply";

function extractPostDataFromActionBar(actionBar: Element): {
  postUrl: string;
  postAuthor: string;
  postCaption: string;
  existingComments: { username: string; text: string }[];
  mediaType: string | undefined;
  hashtags: string[] | undefined;
} | null {
  // --- Boundary-marker approach ---
  // Walk up from the action bar. At each ancestor, check if it contains post
  // text AND exactly 1 EngageAI button. That means the ancestor scopes to
  // exactly one post. This is structure-agnostic — no LinkedIn class names
  // needed for boundary detection.

  const TEXT_SELECTORS = [
    'span[data-testid="expandable-text-box"]',
    'div.feed-shared-text',
    'div.update-components-text',
  ];
  const AUTHOR_SELECTORS = [
    'span.feed-shared-actor__name span',
    'span.update-components-actor__name span',
  ];

  // 1. Find post container via EngageAI button count boundary
  let postContainer: Element | null = null;
  let current: Element | null = actionBar;
  for (let level = 0; level < 15; level++) {
    current = current?.parentElement || null;
    if (!current || current === document.body) break;

    // Does this ancestor contain post text?
    let hasText = false;
    for (const sel of TEXT_SELECTORS) {
      if (current.querySelector(sel)) { hasText = true; break; }
    }
    if (!hasText) continue;

    // Count EngageAI buttons — 1 means single-post scope
    const count = current.querySelectorAll(`[${ACTION_BTN_ATTR}]`).length;
    if (count === 1) {
      // Keep the largest single-post container (don't break yet)
      postContainer = current;
      console.log(`[EngageAI] Single-post candidate at level ${level}`);
      continue;
    }
    if (count > 1) {
      // We've gone too high — multiple posts. Use whatever we saved.
      console.log(`[EngageAI] Boundary hit at level ${level} (${count} buttons)`);
      break;
    }
    // count === 0: timing edge case, save as candidate and keep walking
    postContainer = current;
  }

  if (!postContainer) {
    console.log("[EngageAI] No post container found");
    return null;
  }
  console.log(`[EngageAI] Using post container: <${postContainer.tagName}> classes="${(postContainer.className || "").slice(0, 80)}"`);

  // 2. Activity URN — check within postContainer, then walk up ancestors
  let activityUrn = "";
  // Search all elements with data attributes that might contain URNs
  const urnAttrs = ["data-view-tracking-scope", "data-urn", "data-activity-urn", "data-id"];
  const urnPattern = /urn:li:activity:(\d+)/;

  // First: check within postContainer
  for (const attr of urnAttrs) {
    const els = postContainer.querySelectorAll(`[${attr}]`);
    for (const el of els) {
      const m = (el.getAttribute(attr) || "").match(urnPattern);
      if (m) { activityUrn = m[0]; break; }
    }
    if (activityUrn) break;
    // Also check the container itself
    const m = (postContainer.getAttribute(attr) || "").match(urnPattern);
    if (m) { activityUrn = m[0]; break; }
  }

  // Second: walk up ancestors
  if (!activityUrn) {
    let ancestor: Element | null = postContainer.parentElement;
    for (let i = 0; i < 8; i++) {
      if (!ancestor || ancestor === document.body) break;
      for (const attr of urnAttrs) {
        const m = (ancestor.getAttribute(attr) || "").match(urnPattern);
        if (m) { activityUrn = m[0]; break; }
      }
      if (activityUrn) break;
      ancestor = ancestor.parentElement;
    }
  }
  let postUrl = activityUrn ? `https://www.linkedin.com/feed/update/${activityUrn}` : "";

  // 3. Caption — search within postContainer only
  let postCaption = "";
  for (const sel of TEXT_SELECTORS) {
    const el = postContainer.querySelector(sel);
    if (el) {
      const text = el.textContent?.trim() || "";
      if (text.length > 20) { postCaption = text; break; }
    }
  }
  // Fallback: span[dir="ltr"] with substantial text
  if (!postCaption) {
    const spans = postContainer.querySelectorAll('span[dir="ltr"]');
    for (const span of spans) {
      const text = span.textContent?.trim() || "";
      if (text.length > 50) { postCaption = text; break; }
    }
  }

  // 4. Author — search within postContainer only
  let postAuthor = "";
  for (const sel of AUTHOR_SELECTORS) {
    const el = postContainer.querySelector(sel);
    if (el) {
      const name = el.textContent?.trim() || "";
      if (name.length > 1) { postAuthor = name; break; }
    }
  }
  if (!postAuthor) {
    const profileLink = postContainer.querySelector('a[href*="/in/"] span');
    if (profileLink) {
      const name = profileLink.textContent?.trim() || "";
      if (name.length > 1 && name.length < 80) postAuthor = name;
    }
  }

  // 5. Post URL fallback — search for any link containing activity/post patterns
  if (!postUrl) {
    const linkSelectors = [
      'a[href*="/feed/update/"]',
      'a[href*="/posts/"]',
      'a[href*="activity:"]',
      'a[href*="/pulse/"]',
    ];
    for (const sel of linkSelectors) {
      const link = postContainer.querySelector(sel);
      if (link?.getAttribute("href")) {
        postUrl = new URL(link.getAttribute("href")!.split("?")[0], "https://www.linkedin.com").href;
        break;
      }
    }
  }

  // 6. Last resort — try to find a URN in any attribute on any element
  if (!postUrl) {
    const allEls = postContainer.querySelectorAll("*");
    for (const el of allEls) {
      for (const attr of el.getAttributeNames()) {
        const val = el.getAttribute(attr) || "";
        const m = val.match(urnPattern);
        if (m) {
          postUrl = `https://www.linkedin.com/feed/update/${m[0]}`;
          console.log(`[EngageAI] Found URN in attr="${attr}" on <${el.tagName}>`);
          break;
        }
      }
      if (postUrl) break;
    }
  }

  // 7. Absolute last resort — generate a unique URL from author + caption hash
  if (!postUrl && postCaption) {
    const hash = [...postCaption.slice(0, 100)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0);
    postUrl = `https://www.linkedin.com/feed/#engageai-${Math.abs(hash).toString(36)}`;
    console.log("[EngageAI] Using generated fallback URL");
  }

  if (!postUrl) {
    console.log("[EngageAI] No post URL found. Caption:", postCaption.slice(0, 40), "Author:", postAuthor);
    return null;
  }

  console.log("[EngageAI] Extracted:", { postAuthor: postAuthor.slice(0, 40), postCaption: postCaption.slice(0, 80), postUrl });

  // 6. Hashtags from caption
  const captionTags: string[] = postCaption.match(/#[\w]+/g) || [];
  const hashtags = captionTags.length > 0 ? captionTags : undefined;

  // 7. Media type
  let mediaType: string | undefined;
  if (postContainer.querySelector('video, div[class*="video"]')) mediaType = "video";
  else if (postContainer.querySelector('div[class*="carousel"]')) mediaType = "carousel";
  else if (postContainer.querySelector('img[class*="feed-shared-image"]')) mediaType = "image";

  // 8. Existing comments
  const existingComments: { username: string; text: string }[] = [];
  const commentEls = postContainer.querySelectorAll('article.comments-comment-item, div[class*="comments-comment-item"]');
  for (const el of commentEls) {
    if (existingComments.length >= 5) break;
    const authorEl = el.querySelector('a[class*="comment__author"] span, span[class*="hoverable-link-text"] span');
    const username = authorEl?.textContent?.trim() || "";
    const textEl = el.querySelector('span[class*="comment__text"] span, div[class*="comment__text"] span, span[dir="ltr"]');
    const text = textEl?.textContent?.trim() || "";
    if (username && text) existingComments.push({ username, text });
  }

  return { postUrl, postAuthor, postCaption, existingComments, mediaType, hashtags };
}

function injectActionBarButton(actionBar: Element): void {
  if (actionBar.querySelector(`[${ACTION_BTN_ATTR}]`)) return;

  // Find a sibling action button (Comment, Repost, Send) to clone its classes
  const existingButtons = actionBar.querySelectorAll("button, a");
  // Find the "Comment" button — it's the one with a comment SVG icon
  let templateBtn: Element | null = null;
  for (const btn of existingButtons) {
    const text = btn.textContent?.trim().toLowerCase() || "";
    if (text === "comment" || text.includes("comment")) {
      templateBtn = btn;
      break;
    }
  }
  // Fallback: use the "Repost" or "Send" button
  if (!templateBtn) {
    for (const btn of existingButtons) {
      const text = btn.textContent?.trim().toLowerCase() || "";
      if (text === "repost" || text === "send") {
        templateBtn = btn;
        break;
      }
    }
  }
  if (!templateBtn) return;

  // Create our button, cloning the template's structure
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = templateBtn.className;
  btn.setAttribute(ACTION_BTN_ATTR, "true");

  // Clone the inner <span> wrapper
  const templateSpan = templateBtn.querySelector("span");
  if (!templateSpan) return;

  const span = document.createElement("span");
  span.className = templateSpan.className;

  // Simple sparkle/magic wand SVG icon
  const iconSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  iconSvg.setAttribute("viewBox", "0 0 16 16");
  iconSvg.setAttribute("width", "16");
  iconSvg.setAttribute("height", "16");
  iconSvg.setAttribute("fill", "currentColor");
  iconSvg.setAttribute("aria-hidden", "true");
  // Copy classes from an existing SVG icon in the template
  const templateSvg = templateSpan.querySelector("svg");
  if (templateSvg) {
    iconSvg.className.baseVal = templateSvg.className.baseVal;
  }
  // Sparkle icon path
  iconSvg.innerHTML = '<path d="M8 1.5l1.14 3.36L12.5 6l-3.36 1.14L8 10.5 6.86 7.14 3.5 6l3.36-1.14zm4.5 6l.57 1.68L14.75 10l-1.68.57-.57 1.68-.57-1.68L10.25 10l1.68-.57zM4 10l.76 2.24L7 13l-2.24.76L4 16l-.76-2.24L1 13l2.24-.76z"/>';

  // Text label — clone the wrapper div + span structure
  const templateTextDiv = templateSpan.querySelector("div");
  const textDiv = document.createElement("div");
  if (templateTextDiv) {
    textDiv.className = templateTextDiv.className;
  }

  const templateLabel = templateSpan.querySelector("div span") || templateSpan.querySelector("span:last-child");
  const labelSpan = document.createElement("span");
  if (templateLabel) {
    labelSpan.className = templateLabel.className;
  }
  labelSpan.textContent = "EngageAI";

  textDiv.appendChild(labelSpan);
  span.appendChild(iconSvg);
  span.appendChild(textDiv);
  btn.appendChild(span);

  // Insert before the Send button (last action), or append at end
  const sendBtn = Array.from(actionBar.querySelectorAll("button, a")).find(
    (el) => el.textContent?.trim().toLowerCase() === "send"
  );
  if (sendBtn) {
    sendBtn.parentElement?.insertBefore(btn, sendBtn);
  } else {
    actionBar.appendChild(btn);
  }

  // Tooltip for generating state
  let generating = false;

  btn.addEventListener("click", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (generating) return;

    generating = true;
    labelSpan.textContent = "Generating...";

    const data = extractPostDataFromActionBar(actionBar);
    if (!data) {
      labelSpan.textContent = "Post not found";
      setTimeout(() => { labelSpan.textContent = "EngageAI"; generating = false; }, 2000);
      return;
    }

    // Copy the post URL to clipboard
    try { await navigator.clipboard.writeText(data.postUrl); } catch {}

    // Route through service worker (avoids CORS issues)
    chrome.runtime.sendMessage(
      {
        action: "GENERATE_OUTBOUND_COMMENT",
        platform: "linkedin",
        postUrl: data.postUrl,
        postAuthor: data.postAuthor,
        postCaption: data.postCaption,
        existingComments: data.existingComments || [],
        mediaType: data.mediaType || null,
        hashtags: data.hashtags || [],
      },
      async (response) => {
        if (response?.success && response.commentText) {
          try {
            await navigator.clipboard.writeText(response.commentText);
          } catch {}
          showCommentPopup(btn, response.commentText, data.postUrl);
          labelSpan.textContent = "Copied!";
          setTimeout(() => { labelSpan.textContent = "EngageAI"; generating = false; }, 3000);
        } else {
          labelSpan.textContent = response?.error || "Failed";
          setTimeout(() => { labelSpan.textContent = "EngageAI"; generating = false; }, 2000);
        }
      }
    );
  });
}

function showCommentPopup(anchor: Element, commentText: string, postUrl: string): void {
  // Remove any existing popup
  document.querySelectorAll("[data-engageai-popup]").forEach((el) => el.remove());

  const popup = document.createElement("div");
  popup.setAttribute("data-engageai-popup", "true");
  Object.assign(popup.style, {
    position: "absolute",
    bottom: "100%",
    left: "50%",
    transform: "translateX(-50%)",
    marginBottom: "8px",
    background: "#1a1a2e",
    color: "#e0e0e0",
    borderRadius: "10px",
    padding: "12px 16px",
    fontSize: "13px",
    lineHeight: "1.5",
    maxWidth: "340px",
    minWidth: "260px",
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
    zIndex: "99999",
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  });

  const text = document.createElement("div");
  text.textContent = commentText;
  Object.assign(text.style, {
    marginBottom: "10px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  });

  const actions = document.createElement("div");
  Object.assign(actions.style, {
    display: "flex",
    gap: "8px",
    justifyContent: "flex-end",
  });

  const copyBtn = document.createElement("button");
  copyBtn.textContent = "Copy again";
  Object.assign(copyBtn.style, {
    background: "rgba(99, 102, 241, 0.9)",
    color: "white",
    border: "none",
    borderRadius: "6px",
    padding: "5px 12px",
    fontSize: "12px",
    cursor: "pointer",
    fontWeight: "500",
  });
  copyBtn.addEventListener("click", async () => {
    await navigator.clipboard.writeText(commentText);
    copyBtn.textContent = "Copied!";
    setTimeout(() => { copyBtn.textContent = "Copy again"; }, 1500);
  });

  const dismissBtn = document.createElement("button");
  dismissBtn.textContent = "Dismiss";
  Object.assign(dismissBtn.style, {
    background: "rgba(255,255,255,0.1)",
    color: "#aaa",
    border: "none",
    borderRadius: "6px",
    padding: "5px 12px",
    fontSize: "12px",
    cursor: "pointer",
  });
  dismissBtn.addEventListener("click", () => popup.remove());

  actions.appendChild(copyBtn);
  actions.appendChild(dismissBtn);
  popup.appendChild(text);
  popup.appendChild(actions);

  // Position relative to the button
  const btnParent = anchor.parentElement;
  if (btnParent) {
    btnParent.style.position = "relative";
    btnParent.appendChild(popup);
  } else {
    anchor.after(popup);
  }

  // Auto-dismiss after 15s
  setTimeout(() => popup.remove(), 15000);
}

// Watch for action bars appearing on feed posts
function processActionBars(): void {
  // LinkedIn action bars contain Like, Comment, Repost, Send buttons.
  // We identify them by finding buttons whose text content is exactly "Comment".
  const allButtons = document.querySelectorAll("button");
  for (const btn of allButtons) {
    // Check this is a "Comment" action button (not a comment input)
    const spans = btn.querySelectorAll("span");
    let isCommentBtn = false;
    for (const s of spans) {
      if (s.textContent?.trim() === "Comment" && s.children.length === 0) {
        isCommentBtn = true;
        break;
      }
    }
    if (!isCommentBtn) continue;

    // Walk up to find the action bar container (the row of action buttons)
    // The action bar has min-height: 4.4rem and contains Like + Comment + Repost + Send
    let actionBar: Element | null = btn.parentElement;
    for (let i = 0; i < 5; i++) {
      if (!actionBar) break;
      const style = (actionBar as HTMLElement).style;
      const children = actionBar.querySelectorAll("button, a");
      // The action bar typically has 4+ interactive children (Like, reactions, Comment, Repost, Send)
      if (children.length >= 4) break;
      actionBar = actionBar.parentElement;
    }
    if (!actionBar) continue;

    injectActionBarButton(actionBar);
  }
}

const actionBarObserver = new MutationObserver(() => {
  processActionBars();
});
actionBarObserver.observe(document.body, { childList: true, subtree: true });
// Process any already-rendered posts
processActionBars();

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
          // Walk up to find div.nt-card__container
          let card: Element | null = hl.parentElement;
          for (let i = 0; i < 8; i++) {
            if (!card) break;
            const cls = card.className || "";
            if (/nt-card__container/i.test(cls)) break;
            card = card.parentElement;
          }
          if (!card) card = hl.parentElement;
          if (!card) continue;
          const text = card.textContent || "";
          // Skip reaction cards — they contain the mentioned user's name but aren't the actual comment
          if (/reacted to/i.test(text)) continue;
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
