-- Add bonus AI reply credits column to subscriptions
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS bonus_ai_replies integer NOT NULL DEFAULT 0;

-- RPC function: atomically decrement bonus AI replies
-- Returns the actual amount decremented (capped at available balance)
CREATE OR REPLACE FUNCTION decrement_bonus_ai_replies(
  p_user_id uuid,
  p_amount integer
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_available integer;
  v_decrement integer;
BEGIN
  -- Lock the row to prevent race conditions
  SELECT bonus_ai_replies INTO v_available
  FROM subscriptions
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND OR v_available <= 0 THEN
    RETURN 0;
  END IF;

  -- Cap decrement at available balance
  v_decrement := LEAST(p_amount, v_available);

  UPDATE subscriptions
  SET bonus_ai_replies = bonus_ai_replies - v_decrement,
      updated_at = now()
  WHERE user_id = p_user_id;

  RETURN v_decrement;
END;
$$;
