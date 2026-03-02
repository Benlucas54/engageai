export type Platform = "instagram" | "threads" | "x" | "linkedin" | "tiktok" | "youtube";

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

export interface ContentScriptMessage {
  action: "SCRAPE" | "POST_REPLY";
  payload?: QueuedReply;
  ownerUsername?: string;
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
  error?: string;
  comment_external_id?: string;
}
