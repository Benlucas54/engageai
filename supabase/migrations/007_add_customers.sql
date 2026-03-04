-- ============================================================
-- CUSTOMERS TABLE (CRM pipeline)
-- ============================================================

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

CREATE INDEX IF NOT EXISTS idx_customers_profile_id ON customers(profile_id);
CREATE INDEX IF NOT EXISTS idx_customers_status ON customers(status);
CREATE INDEX IF NOT EXISTS idx_customers_platform ON customers(platform);
CREATE INDEX IF NOT EXISTS idx_customers_last_interaction ON customers(last_interaction_at DESC);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "customers_select" ON customers FOR SELECT TO anon USING (true);
CREATE POLICY "customers_insert" ON customers FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "customers_update" ON customers FOR UPDATE TO anon USING (true);
CREATE POLICY "customers_delete" ON customers FOR DELETE TO anon USING (true);
