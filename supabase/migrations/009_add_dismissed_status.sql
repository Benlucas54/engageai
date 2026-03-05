-- Add "dismissed" to the comments.status CHECK constraint
ALTER TABLE comments DROP CONSTRAINT IF EXISTS comments_status_check;
ALTER TABLE comments ADD CONSTRAINT comments_status_check
  CHECK (status IN ('pending', 'replied', 'flagged', 'hidden', 'dismissed'));
