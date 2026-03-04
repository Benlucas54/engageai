-- Smart Tags: AI-powered comment classification
-- Adds smart_tag to comments, trigger_type/trigger_tags to automation_rules,
-- and tag_priorities to voice_settings.

-- 1. Add smart_tag column to comments (nullable for existing comments)
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS smart_tag TEXT
    CHECK (smart_tag IN ('question','purchase_intent','complaint','compliment','other'));

CREATE INDEX IF NOT EXISTS idx_comments_smart_tag ON comments(smart_tag);

-- 2. Extend automation_rules with tag-based triggers
ALTER TABLE automation_rules
  ADD COLUMN IF NOT EXISTS trigger_type TEXT NOT NULL DEFAULT 'keyword'
    CHECK (trigger_type IN ('keyword','tag','both'));

ALTER TABLE automation_rules
  ADD COLUMN IF NOT EXISTS trigger_tags TEXT[] NOT NULL DEFAULT '{}';

-- 3. Add tag_priorities to voice_settings
ALTER TABLE voice_settings
  ADD COLUMN IF NOT EXISTS tag_priorities JSONB NOT NULL
    DEFAULT '{"purchase_intent":5,"complaint":4,"question":3,"compliment":2,"other":1}';
