CREATE TABLE outbound_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  platform TEXT NOT NULL,
  post_url TEXT NOT NULL,
  post_author TEXT,
  post_caption TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'pending',
  generated_comment TEXT,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, post_url)
);

-- Enable realtime for dashboard live updates
ALTER PUBLICATION supabase_realtime ADD TABLE outbound_posts;

-- RLS policies
ALTER TABLE outbound_posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own outbound posts"
  ON outbound_posts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own outbound posts"
  ON outbound_posts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own outbound posts"
  ON outbound_posts FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own outbound posts"
  ON outbound_posts FOR DELETE
  USING (auth.uid() = user_id);

-- Service role bypass (for API routes using service key)
CREATE POLICY "Service role full access"
  ON outbound_posts FOR ALL
  USING (auth.role() = 'service_role');
