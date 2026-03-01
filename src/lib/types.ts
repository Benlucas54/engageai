export interface Comment {
  id: string;
  platform: "instagram" | "threads" | "x";
  username: string;
  comment_text: string;
  post_title: string;
  post_url: string;
  comment_external_id: string;
  status: "pending" | "replied" | "flagged" | "hidden";
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
  sent_at: string | null;
  generated_at: string;
}

export interface VoiceSettings {
  id: string;
  tone: string;
  signature_phrases: string;
  avoid: string;
  signoff: string;
  auto_threshold: "none" | "simple" | "most" | "all";
}

export interface VoiceFormData {
  id: string;
  tone: string;
  phrases: string;
  avoid: string;
  signoff: string;
  threshold: "none" | "simple" | "most" | "all";
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

export interface LinkedAccount {
  id: string;
  platform: "instagram" | "threads" | "x" | "linkedin";
  username: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface FlaggedComment extends Comment {
  draft: string;
  replyId: string | undefined;
}

export interface NavItem {
  id: string;
  icon: string;
  href: string;
  alert?: boolean;
}
