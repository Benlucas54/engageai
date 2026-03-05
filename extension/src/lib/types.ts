export type Platform = "instagram" | "threads" | "x" | "linkedin" | "tiktok" | "youtube";

export type SmartTag = string;

export interface SmartTagDefinition {
  id: string;
  key: string;
  label: string;
  description: string;
  color_bg: string;
  color_text: string;
  color_border: string;
  is_preset: boolean;
  enabled: boolean;
  sort_order: number;
}

export interface ScrapedComment {
  platform: Platform;
  username: string;
  comment_text: string;
  post_title: string;
  post_url: string;
  comment_external_id: string;
  created_at: string;
}

export interface Comment {
  id: string;
  platform: Platform;
  username: string;
  comment_text: string;
  post_title: string;
  post_url: string;
  comment_external_id: string;
  status: "pending" | "replied" | "flagged" | "hidden" | "dismissed";
  smart_tag: SmartTag | null;
  created_at: string;
  synced_at: string;
}

export interface Reply {
  id: string;
  comment_id: string;
  reply_text: string;
  draft_text: string | null;
  approved: boolean;
  sent_at: string | null;
  send_step: string | null;
  generated_at: string;
}

export interface VoiceSettings {
  id: string;
  tone: string;
  signature_phrases: string;
  avoid: string;
  signoff: string;
  auto_threshold: "none" | "simple" | "most" | "all";
  platform_tones: Record<string, string>;
  tag_priorities: Record<string, number>;
}

export interface VoiceExample {
  id: string;
  platform: Platform | null;
  comment_text: string;
  reply_text: string;
  source: "manual" | "learned";
  created_at: string;
}

export interface ExtensionSettings {
  active_platforms: Platform[];
  scan_interval_minutes: number;
}

export interface ScanResult {
  comment: Comment;
  reply?: Reply;
  status: "auto-approved" | "flagged" | "error";
}

export interface CommentMark {
  comment_external_id: string;
  username: string;
  comment_text_prefix: string;
  status: "pending" | "flagged";
  draftText?: string;
  postUrl?: string;
  commentId?: string;
}

export interface EngagementContext {
  postAuthor: string;
  postCaption: string;
  postUrl: string;
  existingComments: { username: string; text: string }[];
  platform: Platform;
  replyInput: HTMLElement;
}

export interface ContentScriptMessage {
  action: "SCRAPE" | "MARK_COMMENTS" | "CLEAR_MARKS" | "SHOW_SUGGESTION" | "UPDATE_SIDE_PANEL" | "FILL_REPLY_INPUT";
  ownerUsername?: string;
  marks?: CommentMark[];
  username?: string;
  postUrl?: string;
  commentExternalId?: string;
  draftText?: string;
  commentId?: string;
  sidePanelItems?: SidePanelItem[];
  fillText?: string;
  platform?: Platform;
}

export interface EngagedComment {
  username: string;
  comment_text: string;
}

export interface CommenterProfile {
  id: string;
  platform: Platform;
  username: string;
  summary: string;
  topics: string[];
  comment_count: number;
  first_seen_at: string;
  last_seen_at: string;
  last_analyzed_at: string | null;
}

export interface ContentScriptResponse {
  success: boolean;
  comments?: ScrapedComment[];
  engagedComments?: EngagedComment[];
  followers?: ScrapedFollower[];
  error?: string;
  comment_external_id?: string;
}

export interface ScrapedFollower {
  platform: Platform;
  username: string;
  display_name?: string;
}

export interface Follower {
  id: string;
  platform: Platform;
  username: string;
  display_name: string | null;
  bio: string | null;
  follower_count: number | null;
  following_count: number | null;
  post_count: number | null;
  profile_pic_url: string | null;
  has_recent_posts: boolean | null;
  first_seen_at: string;
  last_seen_at: string;
  unfollowed_at: string | null;
  status: "new" | "actioned" | "dismissed" | "unfollowed";
}

export interface SidePanelItem {
  commentId: string;
  commentExternalId: string;
  username: string;
  commentText: string;
  smartTag: string | null;
  draftText: string | null;
  platform: Platform;
  postUrl: string;
  status: "pending" | "flagged";
}
