-- Add context columns to outbound_posts for better AI comment generation
ALTER TABLE outbound_posts
  ADD COLUMN IF NOT EXISTS existing_comments JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS media_type TEXT,
  ADD COLUMN IF NOT EXISTS hashtags TEXT[] DEFAULT '{}';
