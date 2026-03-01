import type { NavItem } from "./types";

export const P_LABEL: Record<string, string> = {
  instagram: "Instagram",
  threads: "Threads",
  x: "X",
};

export const NAV_ITEMS: NavItem[] = [
  { id: "Overview", icon: "\u25CB", href: "/dashboard" },
  { id: "Feed",     icon: "\u2261", href: "/feed" },
  { id: "Flagged",  icon: "\u25C7", href: "/flagged", alert: true },
  { id: "Voice",    icon: "\u25C8", href: "/voice" },
];

export const TAG_STYLES: Record<string, string> = {
  replied:   "bg-tag-replied-bg text-tag-replied-text border border-tag-replied-border",
  flagged:   "bg-tag-flagged-bg text-tag-flagged-text border border-tag-flagged-border",
  hidden:    "bg-tag-hidden-bg text-tag-hidden-text border border-tag-hidden-border",
  pending:   "bg-tag-pending-bg text-tag-pending-text border border-tag-pending-border",
  instagram: "bg-tag-instagram-bg text-tag-instagram-text border border-tag-instagram-border",
  threads:   "bg-tag-threads-bg text-tag-threads-text border border-tag-threads-border",
  x:         "bg-tag-x-bg text-tag-x-text border border-tag-x-border",
};
