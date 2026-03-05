import type { SidePanelItem } from "../../lib/types";

const PANEL_ID = "engageai-side-panel";
const HOST_ID = "engageai-side-panel-host";

let panelItems: SidePanelItem[] = [];
let filterTag: string | null = null;
let suggestionsOnly = false;

/** Initialize the side panel on the page */
export function initSidePanel(): void {
  chrome.storage.local.get(["side_panel_enabled", "side_panel_collapsed"], ({ side_panel_enabled, side_panel_collapsed }) => {
    if (side_panel_enabled === false) return;
    createPanelHost(side_panel_collapsed !== false); // default collapsed
  });

  // Listen for keyboard shortcut (Alt+E)
  document.addEventListener("keydown", (e) => {
    if (e.altKey && e.key === "e") {
      e.preventDefault();
      togglePanel();
    }
  });
}

/** Update panel data */
export function updatePanelData(items: SidePanelItem[]): void {
  panelItems = items;
  renderPanel();
}

function createPanelHost(collapsed: boolean): void {
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement("div");
  host.id = HOST_ID;
  Object.assign(host.style, {
    position: "fixed",
    top: "0",
    right: "0",
    height: "100vh",
    zIndex: "99999",
    fontFamily: "'DM Sans', -apple-system, sans-serif",
  });
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: "open" });

  // Inject styles into shadow DOM
  const style = document.createElement("style");
  style.textContent = getPanelStyles();
  shadow.appendChild(style);

  const container = document.createElement("div");
  container.id = PANEL_ID;
  container.dataset.collapsed = collapsed ? "true" : "false";
  shadow.appendChild(container);

  renderPanel();
}

function togglePanel(): void {
  const host = document.getElementById(HOST_ID);
  if (!host?.shadowRoot) {
    // Panel doesn't exist yet — create it expanded
    createPanelHost(false);
    chrome.storage.local.set({ side_panel_collapsed: false });
    return;
  }
  const container = host.shadowRoot.getElementById(PANEL_ID);
  if (!container) return;

  const isCollapsed = container.dataset.collapsed === "true";
  container.dataset.collapsed = isCollapsed ? "false" : "true";
  chrome.storage.local.set({ side_panel_collapsed: !isCollapsed });
  renderPanel();
}

function renderPanel(): void {
  const host = document.getElementById(HOST_ID);
  if (!host?.shadowRoot) return;
  const container = host.shadowRoot.getElementById(PANEL_ID);
  if (!container) return;

  const isCollapsed = container.dataset.collapsed === "true";
  container.innerHTML = "";

  if (isCollapsed) {
    renderCollapsedTab(container);
  } else {
    renderExpandedPanel(container);
  }
}

function renderCollapsedTab(container: HTMLElement): void {
  Object.assign(container.style, {
    width: "36px",
    height: "auto",
    position: "fixed",
    top: "50%",
    right: "0",
    transform: "translateY(-50%)",
  });

  const tab = document.createElement("button");
  tab.className = "collapsed-tab";
  tab.innerHTML = `<span class="tab-icon">AI</span>${panelItems.length > 0 ? `<span class="tab-badge">${panelItems.length}</span>` : ""}`;
  tab.addEventListener("click", () => togglePanel());
  container.appendChild(tab);
}

function renderExpandedPanel(container: HTMLElement): void {
  Object.assign(container.style, {
    width: "300px",
    height: "100vh",
    position: "fixed",
    top: "0",
    right: "0",
    transform: "none",
  });

  // Header
  const header = document.createElement("div");
  header.className = "panel-header";
  header.innerHTML = `
    <span class="panel-title">EngageAI</span>
    <div class="panel-header-actions">
      <button class="panel-btn collapse-btn" title="Collapse (Alt+E)">\u2015</button>
      <button class="panel-btn close-btn" title="Close">\u00d7</button>
    </div>
  `;
  header.querySelector(".collapse-btn")?.addEventListener("click", () => togglePanel());
  header.querySelector(".close-btn")?.addEventListener("click", () => {
    const host = document.getElementById(HOST_ID);
    if (host) host.remove();
    chrome.storage.local.set({ side_panel_enabled: false });
  });
  container.appendChild(header);

  // Summary
  const suggestionsCount = panelItems.filter((i) => i.draftText).length;
  const summary = document.createElement("div");
  summary.className = "panel-summary";
  summary.textContent = `${suggestionsCount} suggestion${suggestionsCount !== 1 ? "s" : ""} ready`;
  container.appendChild(summary);

  // Filter bar
  const filterBar = document.createElement("div");
  filterBar.className = "filter-bar";

  const allBtn = document.createElement("button");
  allBtn.className = `filter-btn${!suggestionsOnly ? " active" : ""}`;
  allBtn.textContent = "All";
  allBtn.addEventListener("click", () => { suggestionsOnly = false; renderPanel(); });
  filterBar.appendChild(allBtn);

  const sugBtn = document.createElement("button");
  sugBtn.className = `filter-btn${suggestionsOnly ? " active" : ""}`;
  sugBtn.textContent = "With suggestions";
  sugBtn.addEventListener("click", () => { suggestionsOnly = true; renderPanel(); });
  filterBar.appendChild(sugBtn);

  container.appendChild(filterBar);

  // Comment list
  const list = document.createElement("div");
  list.className = "panel-list";

  let filtered = panelItems;
  if (suggestionsOnly) {
    filtered = filtered.filter((i) => i.draftText);
  }
  if (filterTag) {
    filtered = filtered.filter((i) => i.smartTag === filterTag);
  }

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.className = "panel-empty";
    empty.textContent = panelItems.length === 0
      ? "No comments yet. Run a scan to get started."
      : "No matching comments.";
    list.appendChild(empty);
  }

  for (const item of filtered) {
    const card = document.createElement("div");
    card.className = "comment-card";

    // Header row
    const cardHeader = document.createElement("div");
    cardHeader.className = "card-header";
    cardHeader.innerHTML = `
      <span class="card-username">@${escapeHtml(item.username)}</span>
      ${item.smartTag ? `<span class="card-tag">${escapeHtml(item.smartTag)}</span>` : ""}
    `;
    card.appendChild(cardHeader);

    // Comment text
    const commentText = document.createElement("div");
    commentText.className = "card-comment";
    commentText.textContent = item.commentText.length > 80
      ? item.commentText.slice(0, 80) + "..."
      : item.commentText;
    card.appendChild(commentText);

    // Draft preview
    if (item.draftText) {
      const draft = document.createElement("div");
      draft.className = "card-draft";
      draft.textContent = item.draftText.length > 100
        ? item.draftText.slice(0, 100) + "..."
        : item.draftText;
      card.appendChild(draft);
    }

    // Actions
    const actions = document.createElement("div");
    actions.className = "card-actions";

    if (item.draftText) {
      const copyBtn = document.createElement("button");
      copyBtn.className = "card-action-btn primary";
      copyBtn.textContent = "Copy";
      copyBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(item.draftText!).catch(() => {});
        copyBtn.textContent = "Copied!";
        setTimeout(() => { copyBtn.textContent = "Copy"; }, 1000);
      });
      actions.appendChild(copyBtn);
    } else {
      const genBtn = document.createElement("button");
      genBtn.className = "card-action-btn primary";
      genBtn.textContent = "Generate";
      genBtn.addEventListener("click", () => {
        genBtn.textContent = "...";
        genBtn.style.opacity = "0.6";
        chrome.runtime.sendMessage(
          { action: "GENERATE_SUGGESTION_FOR_COMMENT", commentExternalId: item.commentExternalId },
          (res) => {
            if (chrome.runtime.lastError) {
              console.error("[EngageAI] Side panel generate error:", chrome.runtime.lastError.message);
              genBtn.textContent = "Error";
              genBtn.title = chrome.runtime.lastError.message || "Extension error";
              genBtn.style.opacity = "1";
              return;
            }
            if (res?.success && res.draftText) {
              item.draftText = res.draftText;
              renderPanel();
            } else {
              const errMsg = res?.error || "Generation failed";
              console.error("[EngageAI] Side panel generate failed:", errMsg);
              genBtn.textContent = "Failed";
              genBtn.title = errMsg;
              genBtn.style.opacity = "1";
            }
          }
        );
      });
      actions.appendChild(genBtn);
    }

    const jumpBtn = document.createElement("button");
    jumpBtn.className = "card-action-btn";
    jumpBtn.textContent = "Jump";
    jumpBtn.addEventListener("click", () => {
      jumpToComment(item.username, item.commentText.slice(0, 20));
    });
    actions.appendChild(jumpBtn);

    card.appendChild(actions);
    list.appendChild(card);
  }

  container.appendChild(list);
}

function jumpToComment(username: string, textPrefix: string): void {
  // Find element by username + text prefix matching
  const allEls = document.querySelectorAll(
    'ul ul li, div[class*="comment"], div[data-pressable-container="true"], article[data-testid="tweet"], div[data-e2e="comment-item"]'
  );
  for (const el of allEls) {
    const text = el.textContent || "";
    if (text.includes(username) && text.includes(textPrefix)) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      // Temporary highlight
      const htmlEl = el as HTMLElement;
      const originalOutline = htmlEl.style.outline;
      const originalTransition = htmlEl.style.transition;
      htmlEl.style.transition = "outline 0.3s ease";
      htmlEl.style.outline = "2px solid #3a6e8c";
      setTimeout(() => {
        htmlEl.style.outline = originalOutline;
        htmlEl.style.transition = originalTransition;
      }, 3000);
      break;
    }
  }
}

function escapeHtml(str: string): string {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function getPanelStyles(): string {
  return `
    :host {
      all: initial;
    }

    #${PANEL_ID} {
      background: #ffffff;
      border-left: 1px solid #e9e6e0;
      box-shadow: -2px 0 12px rgba(0,0,0,0.06);
      font-family: 'DM Sans', -apple-system, sans-serif;
      font-size: 13px;
      color: #1c1917;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .collapsed-tab {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      padding: 8px 6px;
      background: #1c1917;
      color: #fff;
      border: none;
      border-radius: 8px 0 0 8px;
      cursor: pointer;
      font-family: inherit;
      font-size: 10px;
      font-weight: 600;
      writing-mode: vertical-rl;
      text-orientation: mixed;
    }
    .collapsed-tab:hover { background: #333; }
    .tab-icon { font-size: 11px; font-weight: 700; }
    .tab-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 16px;
      height: 16px;
      background: #e74c3c;
      color: #fff;
      border-radius: 8px;
      font-size: 9px;
      font-weight: 700;
      padding: 0 4px;
    }

    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px;
      border-bottom: 1px solid #e9e6e0;
      flex-shrink: 0;
    }
    .panel-title {
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.02em;
    }
    .panel-header-actions { display: flex; gap: 4px; }
    .panel-btn {
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 16px;
      color: #78746e;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .panel-btn:hover { background: #f0eeeb; }

    .panel-summary {
      padding: 10px 14px;
      font-size: 12px;
      color: #78746e;
      background: #f7f6f3;
      border-bottom: 1px solid #e9e6e0;
      flex-shrink: 0;
    }

    .filter-bar {
      display: flex;
      gap: 0;
      padding: 8px 14px;
      border-bottom: 1px solid #e9e6e0;
      background: #fff;
      flex-shrink: 0;
    }
    .filter-btn {
      padding: 4px 10px;
      border: none;
      background: transparent;
      cursor: pointer;
      font-size: 11px;
      font-weight: 500;
      color: #78746e;
      font-family: inherit;
      border-radius: 4px;
    }
    .filter-btn.active {
      background: #f0eeeb;
      color: #1c1917;
      font-weight: 600;
    }
    .filter-btn:hover { background: #f0eeeb; }

    .panel-list {
      flex: 1;
      overflow-y: auto;
      padding: 10px;
    }

    .panel-empty {
      text-align: center;
      color: #b5b0a8;
      font-size: 12px;
      padding: 32px 16px;
    }

    .comment-card {
      background: #fff;
      border: 1px solid #e9e6e0;
      border-radius: 8px;
      padding: 10px;
      margin-bottom: 8px;
    }
    .card-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }
    .card-username {
      font-weight: 600;
      font-size: 12px;
      color: #1c1917;
    }
    .card-tag {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 9999px;
      background: #f0f7fd;
      color: #3a6e8c;
      font-weight: 500;
    }
    .card-comment {
      font-size: 12px;
      color: #555;
      line-height: 1.4;
      margin-bottom: 6px;
    }
    .card-draft {
      font-size: 11px;
      color: #1c1917;
      background: #f7f6f3;
      border-radius: 6px;
      padding: 6px 8px;
      line-height: 1.5;
      margin-bottom: 8px;
    }
    .card-actions {
      display: flex;
      gap: 6px;
    }
    .card-action-btn {
      padding: 4px 10px;
      border-radius: 5px;
      border: 1px solid #e9e6e0;
      background: #fff;
      color: #555;
      font-size: 10px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .card-action-btn:hover { background: #f7f6f3; }
    .card-action-btn.primary {
      background: #1c1917;
      color: #fff;
      border-color: #1c1917;
    }
    .card-action-btn.primary:hover { background: #333; }
  `;
}
