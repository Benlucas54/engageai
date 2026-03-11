const OVERLAY_ATTR = "data-engageai-outbound";
const HOST_CLASS = "engageai-outbound-host";

export interface OutboundPostData {
  postUrl: string;
  postAuthor: string;
  postCaption: string;
  existingComments?: { username: string; text: string }[];
  mediaType?: string;
  hashtags?: string[];
}

export interface OutboundOverlayConfig {
  platform: string;
  postContainerSelector: string;
  getPostData: (container: Element) => OutboundPostData | null;
}

let config: OutboundOverlayConfig | null = null;

export function initOutboundOverlay(cfg: OutboundOverlayConfig): void {
  config = cfg;
  processExistingPosts();
  observeNewPosts();
}

function processExistingPosts(): void {
  if (!config) return;
  const containers = document.querySelectorAll(config.postContainerSelector);
  for (const container of containers) {
    injectButton(container);
  }
}

function observeNewPosts(): void {
  const observer = new MutationObserver(() => {
    if (!config) return;
    const containers = document.querySelectorAll(config.postContainerSelector);
    for (const container of containers) {
      injectButton(container);
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

function injectButton(container: Element): void {
  if (container.getAttribute(OVERLAY_ATTR)) return;
  container.setAttribute(OVERLAY_ATTR, "true");

  // Ensure container has position for absolute child
  const style = window.getComputedStyle(container);
  if (style.position === "static") {
    (container as HTMLElement).style.position = "relative";
  }

  const host = document.createElement("div");
  host.className = HOST_CLASS;
  Object.assign(host.style, {
    position: "absolute",
    top: "8px",
    right: "8px",
    zIndex: "9999",
    opacity: "0",
    transition: "opacity 0.2s ease",
    pointerEvents: "none",
  });

  const shadow = host.attachShadow({ mode: "open" });

  const styleEl = document.createElement("style");
  styleEl.textContent = `
    .engageai-btn {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: none;
      background: rgba(99, 102, 241, 0.85);
      color: white;
      font-size: 14px;
      line-height: 28px;
      text-align: center;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.15s ease, transform 0.15s ease;
      box-shadow: 0 1px 4px rgba(0,0,0,0.2);
      pointer-events: auto;
    }
    .engageai-btn:hover {
      background: rgba(99, 102, 241, 1);
      transform: scale(1.1);
    }
    .engageai-btn.captured {
      background: rgba(34, 197, 94, 0.9);
      pointer-events: none;
    }
  `;
  shadow.appendChild(styleEl);

  const btn = document.createElement("button");
  btn.className = "engageai-btn";
  btn.title = "Capture for outbound engagement";
  // Arrow icon
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    handleCapture(container, btn);
  });

  shadow.appendChild(btn);
  container.appendChild(host);

  // Show on hover
  container.addEventListener("mouseenter", () => {
    host.style.opacity = "1";
    host.style.pointerEvents = "auto";
  });
  container.addEventListener("mouseleave", () => {
    host.style.opacity = "0";
    host.style.pointerEvents = "none";
  });
}

function handleCapture(container: Element, btn: HTMLButtonElement): void {
  if (!config) return;
  const data = config.getPostData(container);
  if (!data) {
    console.log("[EngageAI] Could not extract post data from container");
    return;
  }

  chrome.runtime.sendMessage(
    {
      action: "CAPTURE_OUTBOUND_POST",
      platform: config.platform,
      postUrl: data.postUrl,
      postAuthor: data.postAuthor,
      postCaption: data.postCaption,
      existingComments: data.existingComments || [],
      mediaType: data.mediaType || null,
      hashtags: data.hashtags || [],
    },
    (response) => {
      if (response?.success) {
        btn.className = "engageai-btn captured";
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        setTimeout(() => {
          btn.className = "engageai-btn";
          btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
        }, 2000);
      }
    }
  );
}
