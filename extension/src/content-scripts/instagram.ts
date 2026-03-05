import type { ScrapedComment, CommentMark, ContentScriptMessage, ContentScriptResponse } from "../lib/types";
import { startReplyDetector } from "../lib/reply-detector";
import { showInlineWidget, showEngagementWidget } from "../lib/inline-widget";
import { initSidePanel, updatePanelData } from "./shared/side-panel";

function scrape(ownerUsername: string): ScrapedComment[] {
  const url = window.location.href;
  if (!url.match(/instagram\.com\/(p|reels)\//)) return [];

  const postUrl = url.split("?")[0];

  // Get post caption for title
  const captionEl = document.querySelector(
    "h1, span[class*='caption'], div[class*='Caption'] span"
  );
  const postTitle = captionEl?.textContent?.trim().slice(0, 50) || "Post";

  // Find comment elements
  const commentEls = document.querySelectorAll(
    "ul ul li, div[class*='comment']"
  );

  const comments: ScrapedComment[] = [];
  for (const el of commentEls) {
    const usernameEl = el.querySelector(
      "a[href*='/'] span, a[class*='username']"
    );
    const textEl = el.querySelector(
      "span:not([class*='username']):not(:first-child)"
    );
    const username = usernameEl?.textContent?.trim();
    const text = textEl?.textContent?.trim();

    if (!username || !text) continue;

    // Skip owner's own comments
    if (ownerUsername && username.toLowerCase() === ownerUsername.toLowerCase()) continue;

    // Extract timestamp — Instagram uses <time datetime="...">
    const timeEl = el.querySelector("time[datetime]");
    const created_at = timeEl?.getAttribute("datetime") || new Date().toISOString();

    comments.push({
      platform: "instagram",
      username,
      comment_text: text,
      post_title: postTitle,
      post_url: postUrl,
      comment_external_id: `ig:${username}:${[...text].slice(0, 30).join("")}`,
      created_at,
    });
  }

  return comments;
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
    // Generate button for comments without suggestions
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
  const commentEls = document.querySelectorAll(
    "ul ul li, div[class*='comment']"
  );
  for (const mark of marks) {
    for (const el of commentEls) {
      const text = el.textContent || "";
      if (text.includes(mark.username) && text.includes(mark.comment_text_prefix)) {
        const usernameEl = el.querySelector(
          "a[href*='/'] span, a[class*='username']"
        );
        if (usernameEl) {
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
          usernameEl.parentElement?.insertBefore(badge, usernameEl.nextSibling);
        }
        break;
      }
    }
  }
}

// Clear markers on SPA navigation
let _lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== _lastUrl) {
    _lastUrl = location.href;
    clearMarkers();
  }
}).observe(document.body, { childList: true, subtree: true });

// --- Inline reply helper ---
chrome.storage.local.get("inline_helper_enabled", ({ inline_helper_enabled }) => {
  if (inline_helper_enabled === false) return;
  startReplyDetector(
    "instagram",
    (ctx) => showInlineWidget(ctx),
    (ctx) => showEngagementWidget(ctx)
  );
});

// --- Side panel ---
initSidePanel();

// Listen for messages from service worker
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
      // Find the comment element and show the suggestion panel
      const commentEls = document.querySelectorAll("ul ul li, div[class*='comment']");
      for (const el of commentEls) {
        const text = el.textContent || "";
        if (message.username && text.includes(message.username)) {
          const usernameEl = el.querySelector("a[href*='/'] span, a[class*='username']");
          if (usernameEl) {
            showSuggestionPanel(usernameEl as HTMLElement, {
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
