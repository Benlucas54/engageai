import type { NavItem } from "./types";

export const TAG_COLOR_PRESETS = [
  { bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0" }, // green
  { bg: "#fef2f2", text: "#991b1b", border: "#fecaca" }, // red
  { bg: "#eff6ff", text: "#1e40af", border: "#bfdbfe" }, // blue
  { bg: "#fffbeb", text: "#92400e", border: "#fde68a" }, // amber
  { bg: "#f4f4f5", text: "#3f3f46", border: "#d4d4d8" }, // gray
  { bg: "#faf5ff", text: "#6b21a8", border: "#d8b4fe" }, // purple
  { bg: "#fdf2f8", text: "#9d174d", border: "#f9a8d4" }, // pink
  { bg: "#f0fdfa", text: "#115e59", border: "#99f6e4" }, // teal
  { bg: "#fff7ed", text: "#9a3412", border: "#fed7aa" }, // orange
  { bg: "#fefce8", text: "#854d0e", border: "#fde047" }, // yellow
];

export const P_LABEL: Record<string, string> = {
  instagram: "Instagram",
  threads: "Threads",
  x: "X",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  youtube: "YouTube",
};

export const NAV_ITEMS: NavItem[] = [
  { id: "Overview", icon: "\u25CB", href: "/dashboard" },
  { id: "Inbox",    icon: "\u25C7", href: "/inbox", alert: true },
  { id: "Feed",        icon: "\u2261",  href: "/feed" },
  { id: "Customers",   icon: "\u25A0",  href: "/customers" },
  { id: "Automations", icon: "\u26A1",  href: "/automations" },
  { id: "Settings",    icon: "\u2699",  href: "/settings" },
  { id: "Setup",    icon: "\u2605", href: "/setup" },
];

export const PROFILE_COLORS = [
  "#6366f1", // indigo
  "#f43f5e", // rose
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#06b6d4", // cyan
  "#8b5cf6", // violet
  "#ec4899", // pink
];

export const CUSTOMER_STATUSES = ["new", "engaged", "converted", "churned"] as const;

export const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  new: "New",
  engaged: "Engaged",
  converted: "Converted",
  churned: "Churned",
};

export const TAG_STYLES: Record<string, string> = {
  replied:   "bg-tag-replied-bg text-tag-replied-text border border-tag-replied-border",
  flagged:   "bg-tag-flagged-bg text-tag-flagged-text border border-tag-flagged-border",
  hidden:    "bg-tag-hidden-bg text-tag-hidden-text border border-tag-hidden-border",
  pending:   "bg-tag-pending-bg text-tag-pending-text border border-tag-pending-border",
  instagram: "bg-tag-instagram-bg text-tag-instagram-text border border-tag-instagram-border",
  threads:   "bg-tag-threads-bg text-tag-threads-text border border-tag-threads-border",
  x:         "bg-tag-x-bg text-tag-x-text border border-tag-x-border",
  linkedin:  "bg-tag-threads-bg text-tag-threads-text border border-tag-threads-border",
  tiktok:    "bg-tag-threads-bg text-tag-threads-text border border-tag-threads-border",
  youtube:   "bg-tag-flagged-bg text-tag-flagged-text border border-tag-flagged-border",
  // Smart tag styles
  purchase_intent: "bg-tag-purchase-bg text-tag-purchase-text border border-tag-purchase-border",
  complaint:       "bg-tag-complaint-bg text-tag-complaint-text border border-tag-complaint-border",
  question:        "bg-tag-question-bg text-tag-question-text border border-tag-question-border",
  compliment:      "bg-tag-compliment-bg text-tag-compliment-text border border-tag-compliment-border",
  other:           "bg-tag-x-bg text-tag-x-text border border-tag-x-border",
  // Follower status styles
  new:        "bg-tag-flagged-bg text-tag-flagged-text border border-tag-flagged-border",
  actioned:   "bg-tag-replied-bg text-tag-replied-text border border-tag-replied-border",
  dismissed:  "bg-tag-hidden-bg text-tag-hidden-text border border-tag-hidden-border",
  unfollowed: "bg-tag-x-bg text-tag-x-text border border-tag-x-border",
  // Message type styles
  dm:      "bg-tag-purchase-bg text-tag-purchase-text border border-tag-purchase-border",
  comment: "bg-tag-question-bg text-tag-question-text border border-tag-question-border",
  // Customer status styles
  engaged:   "bg-tag-purchase-bg text-tag-purchase-text border border-tag-purchase-border",
  converted: "bg-tag-replied-bg text-tag-replied-text border border-tag-replied-border",
  churned:   "bg-tag-hidden-bg text-tag-hidden-text border border-tag-hidden-border",
};
