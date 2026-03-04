-- Migration: Add profiles table and link to linked_accounts
-- Run this against an existing EngageAI database to add the profiles feature.

-- 1. Create the profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'My Brand',
  color TEXT NOT NULL DEFAULT '#6366f1',
  avatar_url TEXT,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON profiles(user_id);

-- RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO anon USING (true);
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO anon USING (true);
CREATE POLICY "profiles_delete" ON profiles FOR DELETE TO anon USING (true);

-- 2. Add profile_id column to linked_accounts (nullable first for backfill)
ALTER TABLE linked_accounts ADD COLUMN IF NOT EXISTS profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE;

-- 3. Create a default profile for the test user and backfill linked_accounts
DO $$
DECLARE
  _user_id UUID := '9c2e43d4-cdfe-4ebd-9a17-3f75b7348bf0';
  _profile_id UUID;
BEGIN
  -- Only run if there are existing linked_accounts without a profile_id
  IF EXISTS (SELECT 1 FROM linked_accounts WHERE profile_id IS NULL) THEN
    INSERT INTO profiles (user_id, name, color, is_default)
    VALUES (_user_id, 'My Brand', '#6366f1', true)
    RETURNING id INTO _profile_id;

    UPDATE linked_accounts SET profile_id = _profile_id WHERE profile_id IS NULL;
  END IF;
END $$;

-- 4. Now make profile_id NOT NULL
ALTER TABLE linked_accounts ALTER COLUMN profile_id SET NOT NULL;

-- 5. Add index
CREATE INDEX IF NOT EXISTS idx_linked_accounts_profile_id ON linked_accounts(profile_id);
