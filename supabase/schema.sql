-- EngageAI Schema
-- Run this in the Supabase SQL editor to set up all tables, RLS, indexes, and seed data.

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  platform TEXT NOT NULL CHECK (platform IN ('instagram', 'threads', 'x')),
  username TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  post_title TEXT,
  post_url TEXT,
  comment_external_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'replied', 'flagged', 'hidden')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  synced_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  reply_text TEXT,
  draft_text TEXT,
  approved BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS voice_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tone TEXT NOT NULL DEFAULT '',
  signature_phrases TEXT NOT NULL DEFAULT '',
  avoid TEXT NOT NULL DEFAULT '',
  signoff TEXT NOT NULL DEFAULT '',
  auto_threshold TEXT NOT NULL DEFAULT 'simple' CHECK (auto_threshold IN ('simple', 'most', 'all'))
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
  file_name TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  file_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  extracted_text TEXT,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);
CREATE INDEX IF NOT EXISTS idx_comments_platform ON comments(platform);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_replies_comment_id ON replies(comment_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_started_at ON agent_runs(started_at DESC);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE replies ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_documents ENABLE ROW LEVEL SECURITY;

-- Comments: anon can SELECT, can UPDATE only flagged→hidden
CREATE POLICY "comments_select" ON comments FOR SELECT TO anon USING (true);
CREATE POLICY "comments_update_dismiss" ON comments FOR UPDATE TO anon
  USING (status = 'flagged') WITH CHECK (status = 'hidden');

-- Replies: anon can SELECT, UPDATE (draft edits + approvals)
CREATE POLICY "replies_select" ON replies FOR SELECT TO anon USING (true);
CREATE POLICY "replies_update" ON replies FOR UPDATE TO anon USING (true);

-- Voice settings: anon can SELECT, UPDATE, INSERT
CREATE POLICY "voice_settings_select" ON voice_settings FOR SELECT TO anon USING (true);
CREATE POLICY "voice_settings_update" ON voice_settings FOR UPDATE TO anon USING (true);
CREATE POLICY "voice_settings_insert" ON voice_settings FOR INSERT TO anon WITH CHECK (true);

-- Agent runs: anon can SELECT only
CREATE POLICY "agent_runs_select" ON agent_runs FOR SELECT TO anon USING (true);

-- Voice documents: anon can SELECT, INSERT, DELETE
CREATE POLICY "voice_documents_select" ON voice_documents FOR SELECT TO anon USING (true);
CREATE POLICY "voice_documents_insert" ON voice_documents FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "voice_documents_delete" ON voice_documents FOR DELETE TO anon USING (true);

-- ============================================================
-- SEED DATA
-- ============================================================

-- Singleton voice_settings row with defaults matching the dashboard mock
INSERT INTO voice_settings (tone, signature_phrases, avoid, signoff, auto_threshold)
VALUES (
  'Warm and direct. Encouraging without being over the top. No corporate speak — sound like a person, not a brand.',
  E'\U0001F64C \U0001F525 \U0001F499 — use naturally. ''Means a lot'', ''genuinely'', ''let''s figure it out''.',
  E'''Great question!'' / ''Absolutely!'' / ''Of course!'' — too salesy. No hollow affirmations.',
  'Use first names. Keep it short. Don''t wrap up too neatly.',
  'simple'
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
-- STORAGE BUCKET (run this separately or via Supabase dashboard)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('voice-documents', 'voice-documents', false);
