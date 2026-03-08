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

export interface Comment {
  id: string;
  platform: "instagram" | "threads" | "x" | "linkedin" | "tiktok" | "youtube";
  username: string;
  comment_text: string;
  post_title: string;
  post_url: string;
  comment_external_id: string;
  status: "pending" | "replied" | "flagged" | "hidden";
  smart_tag: SmartTag | null;
  created_at: string;
  synced_at: string;
  replies?: Reply[];
}

export interface Reply {
  id: string;
  comment_id: string;
  reply_text: string;
  draft_text: string | null;
  approved: boolean;
  auto_sent: boolean;
  sent_at: string | null;
  send_step: string | null;
  generated_at: string;
}

export interface VoiceSettings {
  id: string;
  name: string;
  tone: string;
  signature_phrases: string;
  avoid: string;
  signoff: string;
  auto_threshold: "none" | "simple" | "most" | "all";
  platform_tones: Record<string, string>;
  tag_priorities: Record<string, number>;
}

export interface VoiceFormData {
  id: string;
  name: string;
  tone: string;
  phrases: string;
  avoid: string;
  signoff: string;
  threshold: "none" | "simple" | "most" | "all";
  platform_tones: Record<string, string>;
}

export interface VoiceExample {
  id: string;
  platform: Comment["platform"] | null;
  comment_text: string;
  reply_text: string;
  source: "manual" | "learned";
  created_at: string;
}

export interface AgentRun {
  id: string;
  started_at: string;
  completed_at: string | null;
  comments_found: number;
  replies_sent: number;
  flagged_count: number;
  platform: string | null;
  status: "running" | "success" | "error";
  error_message: string | null;
}

export interface VoiceDocument {
  id: string;
  file_name: string;
  file_size: number;
  file_type: "pdf" | "txt";
  storage_path: string;
  extracted_text: string | null;
  uploaded_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  color: string;
  avatar_url: string | null;
  voice_id: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface LinkedAccount {
  id: string;
  profile_id: string;
  platform: "instagram" | "threads" | "x" | "linkedin" | "tiktok" | "youtube";
  username: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface CommenterProfile {
  id: string;
  platform: Comment["platform"];
  username: string;
  summary: string;
  topics: string[];
  comment_count: number;
  first_seen_at: string;
  last_seen_at: string;
  last_analyzed_at: string | null;
}

export interface FlaggedComment extends Comment {
  draft: string;
  replyId: string | undefined;
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

export interface NavItem {
  id: string;
  icon: string;
  href: string;
  alert?: boolean;
  adminOnly?: boolean;
}

export interface Follower {
  id: string;
  platform: "instagram" | "threads" | "tiktok";
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

export type CustomerStatus = "new" | "engaged" | "converted" | "churned";

export interface Customer {
  id: string;
  profile_id: string;
  platform: Comment["platform"];
  username: string;
  display_name: string | null;
  status: CustomerStatus;
  status_manually_set: boolean;
  comment_count: number;
  follower_interaction: boolean;
  first_seen_at: string;
  last_interaction_at: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface FlaggedFollower extends Follower {
  draft: string;
  actionId: string | undefined;
  messageType: "dm" | "comment";
  actionRuleName: string | null;
}
