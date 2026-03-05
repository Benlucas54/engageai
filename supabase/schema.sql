-- EngageAI Schema
-- Run this in the Supabase SQL editor to set up all tables, RLS, indexes, and seed data.

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'threads', 'x', 'linkedin', 'tiktok', 'youtube')),
  username TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  post_title TEXT,
  post_url TEXT,
  comment_external_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'replied', 'flagged', 'hidden', 'dismissed')),
  smart_tag TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  reply_text TEXT,
  draft_text TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  auto_sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  send_step TEXT DEFAULT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voice_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'Default Voice',
  tone TEXT NOT NULL DEFAULT '',
  signature_phrases TEXT NOT NULL DEFAULT '',
  avoid TEXT NOT NULL DEFAULT '',
  signoff TEXT NOT NULL DEFAULT '',
  auto_threshold TEXT NOT NULL DEFAULT 'simple' CHECK (auto_threshold IN ('none', 'simple', 'most', 'all')),
  platform_tones JSONB NOT NULL DEFAULT '{}',
  tag_priorities JSONB NOT NULL DEFAULT '{"purchase_intent":5,"complaint":4,"question":3,"compliment":2,"other":1}'
);

CREATE TABLE IF NOT EXISTS agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  comments_found INTEGER DEFAULT 0,
  replies_sent INTEGER DEFAULT 0,
  flagged_count INTEGER DEFAULT 0,
  platform TEXT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'error')),
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS voice_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_settings_id UUID REFERENCES voice_settings(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  extracted_text TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Brand',
  color TEXT NOT NULL DEFAULT '#6366f1',
  avatar_url TEXT,
  voice_id UUID REFERENCES voice_settings(id) ON DELETE SET NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS linked_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'threads', 'x', 'linkedin', 'tiktok', 'youtube')),
  username TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voice_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_settings_id UUID REFERENCES voice_settings(id) ON DELETE CASCADE,
  platform TEXT,
  comment_text TEXT NOT NULL,
  reply_text TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'learned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commenter_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('instagram','threads','x','linkedin','tiktok','youtube')),
  username TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  topics TEXT[] NOT NULL DEFAULT '{}',
  comment_count INTEGER NOT NULL DEFAULT 0,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_analyzed_at TIMESTAMPTZ,
  UNIQUE(platform, username)
);

CREATE TABLE IF NOT EXISTS smart_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  color_bg TEXT NOT NULL,
  color_text TEXT NOT NULL,
  color_border TEXT NOT NULL,
  is_preset BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'threads', 'x', 'linkedin', 'tiktok', 'youtube')),
  username TEXT NOT NULL,
  display_name TEXT,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'engaged', 'converted', 'churned')),
  status_manually_set BOOLEAN NOT NULL DEFAULT false,
  comment_count INTEGER NOT NULL DEFAULT 0,
  follower_interaction BOOLEAN NOT NULL DEFAULT false,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(profile_id, platform, username)
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);
CREATE INDEX IF NOT EXISTS idx_comments_platform ON comments(platform);
CREATE INDEX IF NOT EXISTS idx_comments_smart_tag ON comments(smart_tag);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_replies_comment_id ON replies(comment_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at ON agent_runs(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_linked_accounts_profile_id ON linked_accounts(profile_id);
CREATE INDEX IF NOT EXISTS idx_linked_accounts_platform ON linked_accounts(platform);
CREATE INDEX IF NOT EXISTS idx_voice_examples_source ON voice_examples(source);
CREATE INDEX IF NOT EXISTS idx_profiles_voice_id ON profiles(voice_id);
CREATE INDEX IF NOT EXISTS idx_voice_examples_voice_settings_id ON voice_examples(voice_settings_id);
CREATE INDEX IF NOT EXISTS idx_voice_documents_voice_settings_id ON voice_documents(voice_settings_id);
CREATE INDEX IF NOT EXISTS idx_commenter_profiles_lookup
  ON commenter_profiles(platform, username);
CREATE UNIQUE INDEX idx_smart_tags_user_key ON smart_tags(user_id, key);
CREATE INDEX idx_smart_tags_user ON smart_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_customers_profile_id ON customers(profile_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_platform ON customers(platform);
CREATE INDEX IF NOT EXISTS idx_customers_last_interaction ON customers(last_interaction_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE linked_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_examples ENABLE ROW LEVEL SECURITY;
ALTER TABLE commenter_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE smart_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

-- Profiles: anon can SELECT, INSERT, UPDATE, DELETE
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO anon USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO anon USING (true);
CREATE POLICY "profiles_delete" ON profiles FOR DELETE TO anon USING (true);

-- Comments: anon can SELECT, INSERT, UPDATE
CREATE POLICY "comments_select" ON comments FOR SELECT TO anon USING (true);
CREATE POLICY "comments_insert" ON comments FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "comments_update" ON comments FOR UPDATE TO anon USING (true);

-- Replies: anon can SELECT, INSERT, UPDATE
CREATE POLICY "replies_select" ON replies FOR SELECT TO anon USING (true);
CREATE POLICY "replies_insert" ON replies FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "replies_update" ON replies FOR UPDATE TO anon USING (true);

-- Voice settings: anon can SELECT, UPDATE, INSERT, DELETE
CREATE POLICY "voice_settings_select" ON voice_settings FOR SELECT TO anon USING (true);
CREATE POLICY "voice_settings_update" ON voice_settings FOR UPDATE TO anon USING (true);
CREATE POLICY "voice_settings_insert" ON voice_settings FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "voice_settings_delete" ON voice_settings FOR DELETE TO anon USING (true);

-- Agent runs: anon can SELECT only
CREATE POLICY "agent_runs_select" ON agent_runs FOR SELECT TO anon USING (true);

-- Linked accounts: anon can SELECT, INSERT, UPDATE
CREATE POLICY "linked_accounts_select" ON linked_accounts FOR SELECT TO anon USING (true);
CREATE POLICY "linked_accounts_insert" ON linked_accounts FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "linked_accounts_update" ON linked_accounts FOR UPDATE TO anon USING (true);

-- Commenter profiles: anon can SELECT, INSERT, UPDATE
CREATE POLICY "commenter_profiles_select" ON commenter_profiles FOR SELECT TO anon USING (true);
CREATE POLICY "commenter_profiles_insert" ON commenter_profiles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "commenter_profiles_update" ON commenter_profiles FOR UPDATE TO anon USING (true);

-- Voice examples: anon can SELECT, INSERT, DELETE
CREATE POLICY "voice_examples_select" ON voice_examples FOR SELECT TO anon USING (true);
CREATE POLICY "voice_examples_insert" ON voice_examples FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "voice_examples_delete" ON voice_examples FOR DELETE TO anon USING (true);

-- Voice documents: anon can SELECT, INSERT, DELETE
CREATE POLICY "voice_documents_select" ON voice_documents FOR SELECT TO anon USING (true);
CREATE POLICY "voice_documents_insert" ON voice_documents FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "voice_documents_delete" ON voice_documents FOR DELETE TO anon USING (true);

-- Smart tags: anon can SELECT, INSERT, UPDATE, DELETE
CREATE POLICY "smart_tags_select" ON smart_tags FOR SELECT TO anon USING (true);
CREATE POLICY "smart_tags_insert" ON smart_tags FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "smart_tags_update" ON smart_tags FOR UPDATE TO anon USING (true);
CREATE POLICY "smart_tags_delete" ON smart_tags FOR DELETE TO anon USING (true);

-- Customers: anon can SELECT, INSERT, UPDATE, DELETE
CREATE POLICY "customers_select" ON customers FOR SELECT TO anon USING (true);
CREATE POLICY "customers_insert" ON customers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "customers_update" ON customers FOR UPDATE TO anon USING (true);
CREATE POLICY "customers_delete" ON customers FOR DELETE TO anon USING (true);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Singleton voice_settings row with defaults matching the dashboard mock
INSERT INTO voice_settings (tone, signature_phrases, avoid, signoff, auto_threshold, platform_tones)
VALUES (
  'Warm and direct. Encouraging without being over the top. No corporate speak — sound like a person, not a brand.',
  E'\U0001F64C \U0001F525 \U0001F499 — use naturally. ''Means a lot'', ''genuinely'', ''let''s figure it out''.',
  E'''Great question!'' / ''Absolutely!'' / ''Of course!'' — too salesy. No hollow affirmations.',
  'Use first names. Keep it short. Don''t wrap up too neatly.',
  'simple',
  '{}'
);

-- Seed test comments matching the original 7 mock comments
INSERT INTO comments (platform, username, comment_text, post_title, status, created_at) VALUES
  ('instagram', 'sarah_wellness',  'This is exactly what I needed to hear today! How do I get started with your programme?', 'Morning routine reel', 'replied', now() - interval '2 minutes'),
  ('threads',   'markbuilds',      'Great insight. Been following for months and the content keeps getting better.', 'AI tools thread', 'replied', now() - interval '14 minutes'),
  ('instagram', 'techfounder_uk',  'What''s the ROI like on your sprint programme? Worth the investment for a solo founder?', 'Client results post', 'flagged', now() - interval '28 minutes'),
  ('x',         'designdave99',    'Been using AI tools for 6 months and nowhere near your level. What am I missing?', 'Vibe coding tweet', 'flagged', now() - interval '41 minutes'),
  ('threads',   'coach_layla',     'Saved this post. Sharing with my whole community 🔥', 'Promptpreneur framework', 'replied', now() - interval '55 minutes'),
  ('instagram', 'spambot_xyz',     'Check out my page for free followers!! follow4follow!!!', 'Morning routine reel', 'hidden', now() - interval '1 hour'),
  ('instagram', 'nina_creates',    'The way you explain complex topics simply is a real skill. Keep going!', 'AI tools breakdown', 'replied', now() - interval '1 hour');

-- Seed replies for comments that have replies
INSERT INTO replies (comment_id, reply_text, approved, sent_at)
SELECT c.id,
  CASE c.username
    WHEN 'sarah_wellness'  THEN 'Hey Sarah! So glad it resonated 🙌 Sent you a DM with everything you need to get started.'
    WHEN 'markbuilds'      THEN 'Really appreciate that Mark — means a lot when you''ve been here from early on 🙏'
    WHEN 'coach_layla'     THEN 'Thank you Layla! Would love to connect with your community 🙌'
    WHEN 'nina_creates'    THEN 'That genuinely makes my day Nina — that''s exactly what I aim for 💙'
  END,
  true,
  now()
FROM comments c
WHERE c.status = 'replied';

-- Seed draft replies for flagged comments
INSERT INTO replies (comment_id, reply_text, draft_text, approved)
SELECT c.id,
  CASE c.username
    WHEN 'techfounder_uk' THEN 'The sprint is built specifically for founders at your stage. Want me to send you the breakdown?'
    WHEN 'designdave99'   THEN 'Honestly it''s not the tools — it''s the workflow around them. DM me and let''s figure out the gap.'
  END,
  CASE c.username
    WHEN 'techfounder_uk' THEN 'The sprint is built specifically for founders at your stage. Want me to send you the breakdown?'
    WHEN 'designdave99'   THEN 'Honestly it''s not the tools — it''s the workflow around them. DM me and let''s figure out the gap.'
  END,
  false
FROM comments c
WHERE c.status = 'flagged';

-- Seed an agent run
INSERT INTO agent_runs (started_at, completed_at, comments_found, replies_sent, flagged_count, platform, status)
VALUES (now() - interval '23 minutes', now() - interval '22 minutes', 7, 4, 2, 'all', 'success');

-- ============================================================
-- AUTOMATION RULES
-- ============================================================

CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  match_mode TEXT NOT NULL DEFAULT 'any' CHECK (match_mode IN ('any', 'all')),
  trigger_type TEXT NOT NULL DEFAULT 'keyword' CHECK (trigger_type IN ('keyword','tag','both')),
  trigger_tags TEXT[] NOT NULL DEFAULT '{}',
  action_type TEXT NOT NULL DEFAULT 'ai_instruction' CHECK (action_type IN ('fixed', 'ai_instruction')),
  fixed_template TEXT,
  ai_instruction TEXT,
  auto_send BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_priority ON automation_rules(priority DESC);

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_rules_select" ON automation_rules FOR SELECT TO anon USING (true);
CREATE POLICY "automation_rules_insert" ON automation_rules FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "automation_rules_update" ON automation_rules FOR UPDATE TO anon USING (true);
CREATE POLICY "automation_rules_delete" ON automation_rules FOR DELETE TO anon USING (true);

-- Add automation_rule_id to replies to track which rule triggered a reply
ALTER TABLE replies ADD COLUMN IF NOT EXISTS automation_rule_id UUID REFERENCES automation_rules(id) ON DELETE SET NULL;

-- ============================================================
-- FOLLOWERS & FOLLOWER ACTIONS
-- ============================================================

CREATE TABLE IF NOT EXISTS followers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'threads', 'tiktok')),
  username TEXT NOT NULL,
  display_name TEXT,
  bio TEXT,
  follower_count INTEGER,
  following_count INTEGER,
  post_count INTEGER,
  profile_pic_url TEXT,
  has_recent_posts BOOLEAN,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  unfollowed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'actioned', 'dismissed', 'unfollowed')),
  UNIQUE(platform, username)
);

CREATE TABLE IF NOT EXISTS follower_action_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('instagram', 'threads', 'tiktok')),
  message_type TEXT NOT NULL DEFAULT 'dm' CHECK (message_type IN ('dm', 'comment')),
  action_type TEXT NOT NULL DEFAULT 'ai_instruction' CHECK (action_type IN ('fixed', 'ai_instruction')),
  fixed_template TEXT,
  ai_instruction TEXT,
  auto_send BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  min_follower_count INTEGER DEFAULT NULL,
  require_bio BOOLEAN NOT NULL DEFAULT false,
  require_recent_posts BOOLEAN NOT NULL DEFAULT false,
  ai_filter_enabled BOOLEAN NOT NULL DEFAULT false,
  ai_filter_instruction TEXT,
  daily_dm_cap INTEGER NOT NULL DEFAULT 10,
  daily_comment_cap INTEGER NOT NULL DEFAULT 15,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follower_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES followers(id) ON DELETE CASCADE,
  action_rule_id UUID REFERENCES follower_action_rules(id) ON DELETE SET NULL,
  message_type TEXT NOT NULL CHECK (message_type IN ('dm', 'comment')),
  message_text TEXT,
  draft_text TEXT,
  target_post_url TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  auto_sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  send_step TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_followers_platform ON followers(platform);
CREATE INDEX IF NOT EXISTS idx_followers_status ON followers(status);
CREATE INDEX IF NOT EXISTS idx_followers_first_seen_at ON followers(first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_followers_lookup ON followers(platform, username);
CREATE INDEX IF NOT EXISTS idx_follower_action_rules_priority ON follower_action_rules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_follower_actions_follower_id ON follower_actions(follower_id);
CREATE INDEX IF NOT EXISTS idx_follower_actions_sent_at ON follower_actions(sent_at);

ALTER TABLE followers ENABLE ROW LEVEL SECURITY;
ALTER TABLE follower_action_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE follower_actions ENABLE ROW LEVEL SECURITY;

-- Followers: anon can SELECT, INSERT, UPDATE
CREATE POLICY "followers_select" ON followers FOR SELECT TO anon USING (true);
CREATE POLICY "followers_insert" ON followers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "followers_update" ON followers FOR UPDATE TO anon USING (true);

-- Follower action rules: anon can SELECT, INSERT, UPDATE, DELETE
CREATE POLICY "follower_action_rules_select" ON follower_action_rules FOR SELECT TO anon USING (true);
CREATE POLICY "follower_action_rules_insert" ON follower_action_rules FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "follower_action_rules_update" ON follower_action_rules FOR UPDATE TO anon USING (true);
CREATE POLICY "follower_action_rules_delete" ON follower_action_rules FOR DELETE TO anon USING (true);

-- Follower actions: anon can SELECT, INSERT, UPDATE
CREATE POLICY "follower_actions_select" ON follower_actions FOR SELECT TO anon USING (true);
CREATE POLICY "follower_actions_insert" ON follower_actions FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "follower_actions_update" ON follower_actions FOR UPDATE TO anon USING (true);

-- ============================================================
-- STORAGE BUCKET (run this separately or via Supabase dashboard)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('voice-documents', 'voice-documents', false);
