-- Add follower tracking and action tables
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_followers_platform ON followers(platform);
CREATE INDEX IF NOT EXISTS idx_followers_status ON followers(status);
CREATE INDEX IF NOT EXISTS idx_followers_first_seen_at ON followers(first_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_followers_lookup ON followers(platform, username);
CREATE INDEX IF NOT EXISTS idx_follower_action_rules_priority ON follower_action_rules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_follower_actions_follower_id ON follower_actions(follower_id);
CREATE INDEX IF NOT EXISTS idx_follower_actions_sent_at ON follower_actions(sent_at);

-- RLS
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
