import type { Platform } from "./types";

export interface PostContext {
  postAuthor: string;
  postCaption: string;
  postUrl: string;
  existingComments: { username: string; text: string }[];
  platform: Platform;
}

interface PlatformPostExtractor {
  extractAuthor: () => string;
  extractCaption: () => string;
  extractComments: () => { username: string; text: string }[];
}

const MAX_COMMENTS = 5;

const extractors: Partial<Record<Platform, () => PlatformPostExtractor>> = {
  instagram: () => ({
    extractAuthor: () => {
      // Post author is in the header area — usually an <a> near the top with the username
      const headerLink = document.querySelector(
        'header a[href*="/"] span, header a[role="link"] span'
      );
      return headerLink?.textContent?.trim() || "";
    },
    extractCaption: () => {
      const captionEl = document.querySelector(
        "h1, span[class*='caption'], div[class*='Caption'] span"
      );
      return captionEl?.textContent?.trim() || "";
    },
    extractComments: () => {
      const comments: { username: string; text: string }[] = [];
      const commentEls = document.querySelectorAll("ul ul li, div[class*='comment']");
      for (const el of commentEls) {
        if (comments.length >= MAX_COMMENTS) break;
        const usernameEl = el.querySelector("a[href*='/'] span, a[class*='username']");
        const textEl = el.querySelector("span:not([class*='username']):not(:first-child)");
        const username = usernameEl?.textContent?.trim();
        const text = textEl?.textContent?.trim();
        if (username && text) {
          comments.push({ username, text });
        }
      }
      return comments;
    },
  }),

  threads: () => ({
    extractAuthor: () => {
      const firstContainer = document.querySelector('div[data-pressable-container="true"]');
      if (!firstContainer) return "";
      const span = firstContainer.querySelector('span[dir="auto"]');
      return span?.textContent?.trim().replace("@", "") || "";
    },
    extractCaption: () => {
      const firstContainer = document.querySelector('div[data-pressable-container="true"]');
      if (!firstContainer) return "";
      const spans = firstContainer.querySelectorAll('span[dir="auto"]');
      for (let i = 1; i < spans.length; i++) {
        const t = spans[i]?.textContent?.trim();
        if (t && t !== "·" && t !== "Author" && t.length > 3) {
          return t;
        }
      }
      return "";
    },
    extractComments: () => {
      const comments: { username: string; text: string }[] = [];
      const containers = document.querySelectorAll('div[data-pressable-container="true"]');
      // Skip first container (the post itself)
      const commentContainers = Array.from(containers).slice(1);
      for (const el of commentContainers) {
        if (comments.length >= MAX_COMMENTS) break;
        const spans = el.querySelectorAll('span[dir="auto"]');
        const username = spans[0]?.textContent?.trim().replace("@", "") || "";
        let text = "";
        for (let i = 1; i < spans.length; i++) {
          const t = spans[i]?.textContent?.trim();
          if (t && t !== "·" && t !== "Author" && !/^\d+$/.test(t) && t.length > 1) {
            text = t;
            break;
          }
        }
        if (username && text) {
          comments.push({ username, text });
        }
      }
      return comments;
    },
  }),

  x: () => ({
    extractAuthor: () => {
      const firstTweet = document.querySelector('article[data-testid="tweet"]');
      if (!firstTweet) return "";
      const userNameEl = firstTweet.querySelector('div[data-testid="User-Name"] a[href*="/"]');
      return userNameEl?.getAttribute("href")?.replace("/", "")?.split("/")[0] || "";
    },
    extractCaption: () => {
      const firstTweet = document.querySelector('article[data-testid="tweet"]');
      if (!firstTweet) return "";
      const textEl = firstTweet.querySelector('div[data-testid="tweetText"]');
      return textEl?.textContent?.trim() || "";
    },
    extractComments: () => {
      const comments: { username: string; text: string }[] = [];
      const articles = document.querySelectorAll('article[data-testid="tweet"]');
      // Skip first article (the post itself)
      const commentArticles = Array.from(articles).slice(1);
      for (const el of commentArticles) {
        if (comments.length >= MAX_COMMENTS) break;
        const userNameEl = el.querySelector('div[data-testid="User-Name"] a[href*="/"]');
        const username = userNameEl?.getAttribute("href")?.replace("/", "")?.split("/")[0] || "";
        const textEl = el.querySelector('div[data-testid="tweetText"]');
        const text = textEl?.textContent?.trim() || "";
        if (username && text) {
          comments.push({ username, text });
        }
      }
      return comments;
    },
  }),

  linkedin: () => ({
    extractAuthor: () => {
      const authorEl = document.querySelector(
        'div[class*="feed-shared-actor"] span[class*="hoverable-link-text"] span, a[class*="update-components-actor__name"] span'
      );
      return authorEl?.textContent?.trim() || "";
    },
    extractCaption: () => {
      const captionEl = document.querySelector(
        'div[class*="feed-shared-text"] span[dir="ltr"], div[class*="update-components-text"] span[dir="ltr"]'
      );
      return captionEl?.textContent?.trim() || "";
    },
    extractComments: () => {
      const comments: { username: string; text: string }[] = [];
      const commentEls = document.querySelectorAll(
        'article.comments-comment-item, div[class*="comments-comment-item"]'
      );
      for (const el of commentEls) {
        if (comments.length >= MAX_COMMENTS) break;
        const authorEl = el.querySelector(
          'a[class*="comment__author"] span, span[class*="hoverable-link-text"] span'
        );
        const textEl = el.querySelector(
          'span[class*="comment__text"] span, div[class*="comment__text"] span'
        );
        const username = authorEl?.textContent?.trim() || "";
        const text = textEl?.textContent?.trim() || "";
        if (username && text) {
          comments.push({ username, text });
        }
      }
      return comments;
    },
  }),

  tiktok: () => ({
    extractAuthor: () => {
      const authorEl = document.querySelector(
        'span[data-e2e="browse-username"], a[data-e2e="video-author-uniqueid"], h3[data-e2e="browse-user-name"]'
      );
      return authorEl?.textContent?.trim().replace("@", "") || "";
    },
    extractCaption: () => {
      const captionEl = document.querySelector(
        'span[data-e2e="browse-video-desc"], h1[data-e2e="browse-video-desc"], div[class*="DivVideoInfoContainer"] span'
      );
      return captionEl?.textContent?.trim() || "";
    },
    extractComments: () => {
      const comments: { username: string; text: string }[] = [];
      const commentEls = document.querySelectorAll(
        'div[data-e2e="comment-item"], div[class*="DivCommentItemContainer"]'
      );
      for (const el of commentEls) {
        if (comments.length >= MAX_COMMENTS) break;
        const usernameEl = el.querySelector(
          'a[data-e2e="comment-username-1"], a[href*="/@"]'
        );
        const textEl = el.querySelector(
          'p[data-e2e="comment-level-1"], span[class*="SpanCommentText"]'
        );
        const username = usernameEl?.textContent?.trim().replace("@", "") || "";
        const text = textEl?.textContent?.trim() || "";
        if (username && text) {
          comments.push({ username, text });
        }
      }
      return comments;
    },
  }),
};

export function extractPostContext(platform: Platform): PostContext | null {
  const factory = extractors[platform];
  if (!factory) return null;

  const extractor = factory();
  const postCaption = extractor.extractCaption();

  // Need at least a caption to generate an engagement comment
  if (!postCaption) return null;

  return {
    postAuthor: extractor.extractAuthor(),
    postCaption: postCaption.slice(0, 1000),
    postUrl: window.location.href.split("?")[0],
    existingComments: extractor.extractComments(),
    platform,
  };
}
