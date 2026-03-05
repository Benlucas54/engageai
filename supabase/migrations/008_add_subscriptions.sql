-- Subscriptions table: one row per user, synced from Stripe
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id text,
  stripe_subscription_id text,
  stripe_price_id text,
  plan_id text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  current_period_start timestamptz NOT NULL DEFAULT now(),
  current_period_end timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT subscriptions_user_id_unique UNIQUE (user_id)
);

-- Usage tracking: one row per user per billing period
CREATE TABLE IF NOT EXISTS usage_tracking (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start timestamptz NOT NULL,
  period_end timestamptz NOT NULL,
  ai_replies_used integer NOT NULL DEFAULT 0,
  follower_messages_used integer NOT NULL DEFAULT 0,
  comment_tags_used integer NOT NULL DEFAULT 0,
  voice_analyses_used integer NOT NULL DEFAULT 0,
  voice_enhancements_used integer NOT NULL DEFAULT 0,
  follower_analyses_used integer NOT NULL DEFAULT 0,
  profile_summaries_used integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT usage_tracking_user_period_unique UNIQUE (user_id, period_start)
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_subscription ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_user_period ON usage_tracking(user_id, period_start);

-- RPC function: atomically increment a usage counter
-- Upserts the row if it doesn't exist, then increments the field
CREATE OR REPLACE FUNCTION increment_usage(
  p_user_id uuid,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_field text,
  p_amount integer DEFAULT 1
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Upsert the usage row
  INSERT INTO usage_tracking (user_id, period_start, period_end)
  VALUES (p_user_id, p_period_start, p_period_end)
  ON CONFLICT (user_id, period_start) DO NOTHING;

  -- Dynamically increment the specified field
  EXECUTE format(
    'UPDATE usage_tracking SET %I = %I + $1, updated_at = now() WHERE user_id = $2 AND period_start = $3',
    p_field, p_field
  ) USING p_amount, p_user_id, p_period_start;
END;
$$;

-- Enable RLS
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_tracking ENABLE ROW LEVEL SECURITY;

-- RLS policies: allow service role full access (used by API routes)
CREATE POLICY subscriptions_all ON subscriptions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY usage_tracking_all ON usage_tracking FOR ALL USING (true) WITH CHECK (true);
