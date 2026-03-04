-- Custom Smart Tags table
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

CREATE UNIQUE INDEX idx_smart_tags_user_key ON smart_tags(user_id, key);
CREATE INDEX idx_smart_tags_user ON smart_tags(user_id);

-- RLS
ALTER TABLE smart_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "smart_tags_select" ON smart_tags FOR SELECT TO anon USING (true);
CREATE POLICY "smart_tags_insert" ON smart_tags FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "smart_tags_update" ON smart_tags FOR UPDATE TO anon USING (true);
CREATE POLICY "smart_tags_delete" ON smart_tags FOR DELETE TO anon USING (true);

-- Drop the CHECK constraint on comments.smart_tag to allow custom tag keys
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_smart_tag_check;
