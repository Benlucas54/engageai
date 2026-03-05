import type { Platform, EngagementContext } from "./types";
import { fillReplyInput } from "./input-fill";

type WidgetState = "loading" | "ready" | "error";

const WIDGET_CLASS = "engageai-inline-widget";

/** Remove all existing inline widgets */
export function removeInlineWidgets(): void {
  document.querySelectorAll(`.${WIDGET_CLASS}`).forEach((el) => el.remove());
}

/**
 * Shows a floating AI suggestion widget near a reply input.
 */
export function showInlineWidget(opts: {
  replyInput: HTMLElement;
  platform: Platform;
  commentExternalId: string;
  username: string;
  commentText: string;
  postUrl: string;
  postTitle: string;
}): void {
  // Remove any existing widget
  removeInlineWidgets();

  const widget = document.createElement("div");
  widget.className = WIDGET_CLASS;
  Object.assign(widget.style, {
    position: "absolute",
    zIndex: "10001",
    background: "#ffffff",
    border: "1px solid #e0e0e0",
    borderRadius: "10px",
    padding: "12px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    maxWidth: "340px",
    minWidth: "260px",
    fontSize: "13px",
    lineHeight: "1.5",
    color: "#333",
    fontFamily: "'DM Sans', -apple-system, sans-serif",
  });

  // Header
  const header = document.createElement("div");
  Object.assign(header.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "8px",
  });
  const title = document.createElement("span");
  title.textContent = "EngageAI Suggestion";
  Object.assign(title.style, {
    fontSize: "10px",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#999",
  });
  header.appendChild(title);

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "\u00d7";
  Object.assign(closeBtn.style, {
    border: "none",
    background: "transparent",
    fontSize: "16px",
    cursor: "pointer",
    color: "#999",
    padding: "0 2px",
    lineHeight: "1",
  });
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    widget.remove();
  });
  header.appendChild(closeBtn);
  widget.appendChild(header);

  // Content area
  const content = document.createElement("div");
  Object.assign(content.style, {
    marginBottom: "10px",
    padding: "8px",
    background: "#f5f5f5",
    borderRadius: "6px",
    fontSize: "12px",
    lineHeight: "1.6",
    minHeight: "40px",
  });
  content.textContent = "Generating suggestion...";
  content.style.color = "#999";
  widget.appendChild(content);

  // Button row
  const btnRow = document.createElement("div");
  Object.assign(btnRow.style, { display: "flex", gap: "6px", flexWrap: "wrap" });
  widget.appendChild(btnRow);

  function setState(state: WidgetState, text?: string): void {
    content.textContent = "";
    btnRow.innerHTML = "";

    if (state === "loading") {
      content.textContent = "Generating suggestion...";
      content.style.color = "#999";
    } else if (state === "error") {
      content.textContent = text || "Failed to generate suggestion";
      content.style.color = "#cc4444";
      addButton(btnRow, "Retry", "#333", "#fff", () => fetchSuggestion());
      addButton(btnRow, "Dismiss", "transparent", "#666", () => widget.remove(), true);
    } else if (state === "ready" && text) {
      content.textContent = text;
      content.style.color = "#333";

      addButton(btnRow, "Use", "#333", "#fff", () => {
        fillReplyInput(opts.replyInput, text, opts.platform);
        widget.remove();
      });
      addButton(btnRow, "Copy", "#f5f5f5", "#333", () => {
        navigator.clipboard.writeText(text).catch(() => {});
        const copyBtn = btnRow.querySelector("button:nth-child(2)") as HTMLElement;
        if (copyBtn) {
          copyBtn.textContent = "Copied!";
          setTimeout(() => { copyBtn.textContent = "Copy"; }, 1000);
        }
      }, true);
      addButton(btnRow, "Regenerate", "transparent", "#666", () => {
        setState("loading");
        fetchSuggestion(true);
      }, true);
      addButton(btnRow, "Dismiss", "transparent", "#999", () => widget.remove(), true);
    }
  }

  function fetchSuggestion(forceRegenerate = false): void {
    setState("loading");
    chrome.runtime.sendMessage(
      {
        action: "GENERATE_SUGGESTION_INLINE",
        username: opts.username,
        commentText: opts.commentText,
        commentExternalId: opts.commentExternalId,
        platform: opts.platform,
        postUrl: opts.postUrl,
        postTitle: opts.postTitle,
        forceRegenerate,
      },
      (res) => {
        if (chrome.runtime.lastError) {
          setState("error", "Extension error");
          return;
        }
        if (res?.success && res.draftText) {
          setState("ready", res.draftText);
        } else {
          setState("error", res?.error || "Failed to generate");
        }
      }
    );
  }

  // Position the widget
  positionWidget(widget, opts.replyInput);

  // Reposition on resize
  const resizeObserver = new ResizeObserver(() => {
    positionWidget(widget, opts.replyInput);
  });
  resizeObserver.observe(opts.replyInput);

  // Clean up observer when widget is removed
  const mutationObserver = new MutationObserver(() => {
    if (!document.contains(widget)) {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    }
  });
  mutationObserver.observe(document.body, { childList: true, subtree: true });

  document.body.appendChild(widget);

  // Start fetching
  fetchSuggestion();
}

function positionWidget(widget: HTMLElement, anchor: HTMLElement): void {
  const rect = anchor.getBoundingClientRect();
  const scrollTop = window.scrollY || document.documentElement.scrollTop;
  const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

  // Position above the input if there's room, otherwise below
  const widgetHeight = widget.offsetHeight || 200;
  const spaceAbove = rect.top;
  const spaceBelow = window.innerHeight - rect.bottom;

  if (spaceAbove > widgetHeight + 10) {
    widget.style.top = `${rect.top + scrollTop - widgetHeight - 8}px`;
  } else {
    widget.style.top = `${rect.bottom + scrollTop + 8}px`;
  }

  widget.style.left = `${Math.max(10, rect.left + scrollLeft)}px`;
}

function addButton(
  container: HTMLElement,
  label: string,
  bg: string,
  color: string,
  onClick: () => void,
  outline = false
): void {
  const btn = document.createElement("button");
  btn.textContent = label;
  Object.assign(btn.style, {
    padding: "5px 12px",
    borderRadius: "6px",
    border: outline ? "1px solid #ddd" : "none",
    background: bg,
    color,
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "inherit",
  });
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    e.preventDefault();
    onClick();
  });
  container.appendChild(btn);
}

/**
 * Shows a floating AI engagement comment widget near a top-level comment input.
 * Used for outbound engagement on other people's posts.
 */
export function showEngagementWidget(ctx: EngagementContext): void {
  removeInlineWidgets();

  const widget = document.createElement("div");
  widget.className = WIDGET_CLASS;
  Object.assign(widget.style, {
    position: "absolute",
    zIndex: "10001",
    background: "#ffffff",
    border: "1px solid #e0e0e0",
    borderRadius: "10px",
    padding: "12px",
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    maxWidth: "340px",
    minWidth: "260px",
    fontSize: "13px",
    lineHeight: "1.5",
    color: "#333",
    fontFamily: "'DM Sans', -apple-system, sans-serif",
  });

  // Header
  const header = document.createElement("div");
  Object.assign(header.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "8px",
  });
  const title = document.createElement("span");
  title.textContent = "EngageAI Comment";
  Object.assign(title.style, {
    fontSize: "10px",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#999",
  });
  header.appendChild(title);

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "\u00d7";
  Object.assign(closeBtn.style, {
    border: "none",
    background: "transparent",
    fontSize: "16px",
    cursor: "pointer",
    color: "#999",
    padding: "0 2px",
    lineHeight: "1",
  });
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    widget.remove();
  });
  header.appendChild(closeBtn);
  widget.appendChild(header);

  // Content area
  const content = document.createElement("div");
  Object.assign(content.style, {
    marginBottom: "10px",
    padding: "8px",
    background: "#f5f5f5",
    borderRadius: "6px",
    fontSize: "12px",
    lineHeight: "1.6",
    minHeight: "40px",
  });
  content.textContent = "Generating comment...";
  content.style.color = "#999";
  widget.appendChild(content);

  // Button row
  const btnRow = document.createElement("div");
  Object.assign(btnRow.style, { display: "flex", gap: "6px", flexWrap: "wrap" });
  widget.appendChild(btnRow);

  type WidgetState = "loading" | "ready" | "error";

  function setState(state: WidgetState, text?: string): void {
    content.textContent = "";
    btnRow.innerHTML = "";

    if (state === "loading") {
      content.textContent = "Generating comment...";
      content.style.color = "#999";
    } else if (state === "error") {
      content.textContent = text || "Failed to generate comment";
      content.style.color = "#cc4444";
      addButton(btnRow, "Retry", "#333", "#fff", () => fetchEngagement());
      addButton(btnRow, "Dismiss", "transparent", "#666", () => widget.remove(), true);
    } else if (state === "ready" && text) {
      content.textContent = text;
      content.style.color = "#333";

      addButton(btnRow, "Use", "#333", "#fff", () => {
        fillReplyInput(ctx.replyInput, text, ctx.platform);
        widget.remove();
      });
      addButton(btnRow, "Copy", "#f5f5f5", "#333", () => {
        navigator.clipboard.writeText(text).catch(() => {});
        const copyBtn = btnRow.querySelector("button:nth-child(2)") as HTMLElement;
        if (copyBtn) {
          copyBtn.textContent = "Copied!";
          setTimeout(() => { copyBtn.textContent = "Copy"; }, 1000);
        }
      }, true);
      addButton(btnRow, "Regenerate", "transparent", "#666", () => {
        setState("loading");
        fetchEngagement();
      }, true);
      addButton(btnRow, "Dismiss", "transparent", "#999", () => widget.remove(), true);
    }
  }

  function fetchEngagement(): void {
    setState("loading");
    chrome.runtime.sendMessage(
      {
        action: "GENERATE_ENGAGEMENT_INLINE",
        platform: ctx.platform,
        postAuthor: ctx.postAuthor,
        postCaption: ctx.postCaption,
        postUrl: ctx.postUrl,
        existingComments: ctx.existingComments,
      },
      (res) => {
        if (chrome.runtime.lastError) {
          setState("error", "Extension error");
          return;
        }
        if (res?.success && res.draftText) {
          setState("ready", res.draftText);
        } else {
          setState("error", res?.error || "Failed to generate");
        }
      }
    );
  }

  // Position the widget
  positionWidget(widget, ctx.replyInput);

  const resizeObserver = new ResizeObserver(() => {
    positionWidget(widget, ctx.replyInput);
  });
  resizeObserver.observe(ctx.replyInput);

  const mutationObserver = new MutationObserver(() => {
    if (!document.contains(widget)) {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    }
  });
  mutationObserver.observe(document.body, { childList: true, subtree: true });

  document.body.appendChild(widget);
  fetchEngagement();
}
