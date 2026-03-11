-- Add profile_id to comments table to track which linked account/profile a comment belongs to
ALTER TABLE comments ADD COLUMN profile_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Backfill existing comments by joining linked_accounts on platform
-- For platforms with a single linked account, this is unambiguous
UPDATE comments c
SET profile_id = la.profile_id
FROM linked_accounts la
WHERE c.platform = la.platform
  AND c.profile_id IS NULL;

-- Index for filtering comments by profile
CREATE INDEX idx_comments_profile_id ON comments(profile_id);
