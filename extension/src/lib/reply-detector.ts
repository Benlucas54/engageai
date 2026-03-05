import type { Platform, EngagementContext } from "./types";
import { extractPostContext } from "./post-context";

export interface ReplyContext {
  username: string;
  commentText: string;
  commentExternalId: string;
  replyInput: HTMLElement;
  platform: Platform;
  postUrl: string;
  postTitle: string;
}

type ReplyCallback = (context: ReplyContext) => void;
type EngagementCallback = (context: EngagementContext) => void;

interface PlatformConfig {
  /** Selectors for reply input elements */
  replyInputSelectors: string;
  /** How to extract the parent comment context from a reply input */
  extractContext: (input: HTMLElement) => Omit<ReplyContext, "replyInput" | "platform"> | null;
}

const PLATFORM_CONFIGS: Record<string, PlatformConfig> = {
  instagram: {
    replyInputSelectors: 'textarea[aria-label*="comment" i], textarea[placeholder*="reply" i]',
    extractContext: (input: HTMLElement) => {
      // Walk up to find the comment container (ul ul li)
      let el: HTMLElement | null = input;
      for (let i = 0; i < 15; i++) {
        el = el?.parentElement || null;
        if (!el) break;
        if (el.matches("ul ul li, div[class*='comment']")) {
          const usernameEl = el.querySelector("a[href*='/'] span, a[class*='username']");
          const textEl = el.querySelector("span:not([class*='username']):not(:first-child)");
          const username = usernameEl?.textContent?.trim();
          const text = textEl?.textContent?.trim();
          if (username && text) {
            const postUrl = window.location.href.split("?")[0];
            return {
              username,
              commentText: text,
              commentExternalId: `ig:${username}:${[...text].slice(0, 30).join("")}`,
              postUrl,
              postTitle: document.querySelector("h1, span[class*='caption']")?.textContent?.trim().slice(0, 50) || "Post",
            };
          }
        }
      }
      return null;
    },
  },
  threads: {
    replyInputSelectors: 'div[contenteditable="true"]',
    extractContext: (input: HTMLElement) => {
      // On Threads, the reply modal appears when clicking reply on a comment
      // The context is stored from the last clicked reply target
      const modal = input.closest('div[role="dialog"]');
      if (!modal) return null;

      // Try to extract from the modal context (Threads shows the original comment in the reply modal)
      const spans = modal.querySelectorAll('span[dir="auto"]');
      let username = "";
      let text = "";
      for (let i = 0; i < spans.length; i++) {
        const t = spans[i]?.textContent?.trim();
        if (t && !username && t.length > 0 && !t.includes(" ")) {
          username = t.replace("@", "");
        } else if (t && username && !text && t.length > 3 && t !== "·" && t !== "Author") {
          text = t;
          break;
        }
      }

      if (username && text) {
        const postUrl = window.location.href.split("?")[0];
        return {
          username,
          commentText: text,
          commentExternalId: `th:${username}:${[...text].slice(0, 30).join("")}`,
          postUrl,
          postTitle: "Thread",
        };
      }
      return null;
    },
  },
  x: {
    replyInputSelectors: 'div[data-testid="tweetTextarea_0"]',
    extractContext: (input: HTMLElement) => {
      // Walk up to find the tweet being replied to
      let el: HTMLElement | null = input;
      for (let i = 0; i < 20; i++) {
        el = el?.parentElement || null;
        if (!el) break;
      }
      // Find the previous tweet article
      const articles = document.querySelectorAll('article[data-testid="tweet"]');
      if (articles.length === 0) return null;
      const tweet = articles[0]; // First tweet is the one being replied to
      const userNameEl = tweet.querySelector('div[data-testid="User-Name"] a[href*="/"]');
      const username = userNameEl?.getAttribute("href")?.replace("/", "")?.split("/")[0] || "";
      const textEl = tweet.querySelector('div[data-testid="tweetText"]');
      const text = textEl?.textContent?.trim() || "";
      if (username && text) {
        return {
          username,
          commentText: text,
          commentExternalId: `x:${username}:${[...text].slice(0, 30).join("")}`,
          postUrl: window.location.href.split("?")[0],
          postTitle: "X Post",
        };
      }
      return null;
    },
  },
  linkedin: {
    replyInputSelectors: 'div[contenteditable="true"][role="textbox"], div[class*="ql-editor"][contenteditable="true"]',
    extractContext: (input: HTMLElement) => {
      // Walk up to find the comment container
      let el: HTMLElement | null = input;
      for (let i = 0; i < 15; i++) {
        el = el?.parentElement || null;
        if (!el) break;
        if (el.matches('article.comments-comment-item, div[class*="comments-comment-item"]')) {
          const authorEl = el.querySelector('a[class*="comment__author"] span, span[class*="hoverable-link-text"] span');
          const textEl = el.querySelector('span[class*="comment__text"] span, div[class*="comment__text"] span');
          const username = authorEl?.textContent?.trim();
          const text = textEl?.textContent?.trim();
          if (username && text) {
            return {
              username,
              commentText: text,
              commentExternalId: `li:${username}:${[...text].slice(0, 30).join("")}`,
              postUrl: window.location.href.split("?")[0],
              postTitle: "LinkedIn Post",
            };
          }
        }
      }
      return null;
    },
  },
  tiktok: {
    replyInputSelectors: 'div[data-e2e="comment-input"] div[contenteditable], div[class*="DivInputEditorContainer"] div[contenteditable]',
    extractContext: (input: HTMLElement) => {
      // Walk up to find comment container
      let el: HTMLElement | null = input;
      for (let i = 0; i < 15; i++) {
        el = el?.parentElement || null;
        if (!el) break;
        if (el.matches('div[class*="DivCommentItemContainer"], div[data-e2e="comment-item"]')) {
          const usernameEl = el.querySelector('a[data-e2e="comment-username-1"], a[href*="/@"]');
          const textEl = el.querySelector('p[data-e2e="comment-level-1"], span[class*="SpanCommentText"]');
          const username = usernameEl?.textContent?.trim().replace("@", "");
          const text = textEl?.textContent?.trim();
          if (username && text) {
            return {
              username,
              commentText: text,
              commentExternalId: `tt:${username}:${[...text].slice(0, 30).join("")}`,
              postUrl: window.location.href.split("?")[0],
              postTitle: "Video",
            };
          }
        }
      }
      return null;
    },
  },
};

/**
 * Starts observing for reply input activations on the given platform.
 * When a reply context is found (replying to a specific comment), fires replyCallback.
 * When no reply context is found (top-level comment input) and the post isn't the user's own,
 * fires engagementCallback with the post context for outbound engagement.
 * Returns a cleanup function to stop observing.
 */
export function startReplyDetector(
  platform: Platform,
  replyCallback: ReplyCallback,
  engagementCallback?: EngagementCallback
): () => void {
  const config = PLATFORM_CONFIGS[platform];
  if (!config) return () => {};

  const processedInputs = new WeakSet<HTMLElement>();

  function checkInput(input: HTMLElement): void {
    if (processedInputs.has(input)) return;
    processedInputs.add(input);

    const context = config.extractContext(input);
    if (context) {
      replyCallback({
        ...context,
        replyInput: input,
        platform,
      });
    } else if (engagementCallback) {
      // Top-level comment input — check if this is someone else's post
      const postContext = extractPostContext(platform);
      if (!postContext || !postContext.postCaption) return;

      // Check against cached owner usernames to avoid showing on own posts
      chrome.storage.local.get("owner_usernames", ({ owner_usernames }) => {
        const ownerUsername = owner_usernames?.[platform] || "";
        if (
          ownerUsername &&
          postContext.postAuthor.toLowerCase() === ownerUsername.toLowerCase()
        ) {
          return; // Own post — let the inbound flow handle it
        }
        engagementCallback({
          ...postContext,
          replyInput: input,
        });
      });
    }
  }

  // Detect reply inputs via focusin delegation
  function handleFocusIn(e: FocusEvent): void {
    const target = e.target as HTMLElement;
    if (!target) return;
    if (target.matches(config.replyInputSelectors)) {
      checkInput(target);
    }
    // Also check if target is inside a matching element
    const match = target.closest(config.replyInputSelectors) as HTMLElement | null;
    if (match) {
      checkInput(match);
    }
  }

  // MutationObserver to catch dynamically added reply inputs
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof HTMLElement)) continue;
        // Check if the added node is a reply input
        if (node.matches(config.replyInputSelectors)) {
          // Small delay to let the DOM settle
          setTimeout(() => checkInput(node), 100);
        }
        // Check descendants
        const inputs = node.querySelectorAll(config.replyInputSelectors);
        for (const input of inputs) {
          setTimeout(() => checkInput(input as HTMLElement), 100);
        }
      }
    }
  });

  document.addEventListener("focusin", handleFocusIn);
  observer.observe(document.body, { childList: true, subtree: true });

  return () => {
    document.removeEventListener("focusin", handleFocusIn);
    observer.disconnect();
  };
}
