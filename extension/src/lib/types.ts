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
  status: "pending" | "replied" | "flagged" | "hidden";
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

export interface QueuedReply {
  comment_id: string;
  comment_external_id: string;
  reply_id: string;
  reply_text: string;
  platform: Platform;
  post_url: string;
  username: string;
  comment_text: string;
  scheduled_for: number;
  status: "queued" | "sending" | "sent" | "failed";
}

export interface ExtensionSettings {
  batch_times: string[];
  auto_threshold: "none" | "simple" | "most" | "all";
  active_platforms: Platform[];
  jitter_minutes: number;
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
}

export interface ContentScriptMessage {
  action: "SCRAPE" | "POST_REPLY" | "MARK_COMMENTS" | "CLEAR_MARKS" | "SCRAPE_NOTIFICATIONS" | "SCRAPE_FOLLOWER_PROFILE" | "SEND_DM" | "COMMENT_ON_POST";
  payload?: QueuedReply;
  ownerUsername?: string;
  marks?: CommentMark[];
  username?: string;
  messageText?: string;
  postUrl?: string;
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

export interface AutomationRule {
  id: string;
  name: string;
  keywords: string[];
  match_mode: "any" | "all";
  trigger_type: "keyword" | "tag" | "both";
  trigger_tags: string[];
  action_type: "fixed" | "ai_instruction";
  fixed_template: string | null;
  ai_instruction: string | null;
  auto_send: boolean;
  enabled: boolean;
  priority: number;
  platform: string | null;
  created_at: string;
  updated_at: string;
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

export interface FollowerActionRule {
  id: string;
  name: string;
  platform: string | null;
  message_type: "dm" | "comment";
  action_type: "fixed" | "ai_instruction";
  fixed_template: string | null;
  ai_instruction: string | null;
  auto_send: boolean;
  enabled: boolean;
  priority: number;
  min_follower_count: number | null;
  require_bio: boolean;
  require_recent_posts: boolean;
  ai_filter_enabled: boolean;
  ai_filter_instruction: string | null;
  daily_dm_cap: number;
  daily_comment_cap: number;
  created_at: string;
  updated_at: string;
}

export interface FollowerAction {
  id: string;
  follower_id: string;
  action_rule_id: string | null;
  message_type: "dm" | "comment";
  message_text: string | null;
  draft_text: string | null;
  target_post_url: string | null;
  approved: boolean;
  auto_sent: boolean;
  sent_at: string | null;
  send_step: string | null;
  created_at: string;
}

export interface QueuedFollowerAction {
  follower_id: string;
  action_id: string;
  follower_username: string;
  platform: Platform;
  message_type: "dm" | "comment";
  message_text: string;
  target_post_url: string | null;
  scheduled_for: number;
  status: "queued" | "sending" | "sent" | "failed";
}
