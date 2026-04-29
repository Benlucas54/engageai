-- Multi-tenancy fix: add user_id to every user-scoped table that was missing one.
--
-- Tables already scoped (via FK chain) and not changed here:
--   linked_accounts, comments, customers      -> profile_id -> profiles.user_id
--   replies                                   -> comment_id -> comments -> profiles
--   voice_documents, voice_examples           -> voice_settings_id (scoped once voice_settings has user_id)
--   follower_actions                          -> follower_id (scoped once followers has user_id)
--
-- Existing rows are backfilled to the sole admin user, since the app was
-- effectively single-tenant prior to this migration.

DO $$
DECLARE
  admin_id UUID := '9c2e43d4-cdfe-4ebd-9a17-3f75b7348bf0';
BEGIN
  -- voice_settings
  ALTER TABLE voice_settings ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  UPDATE voice_settings SET user_id = admin_id WHERE user_id IS NULL;
  ALTER TABLE voice_settings ALTER COLUMN user_id SET NOT NULL;

  -- agent_runs
  ALTER TABLE agent_runs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  UPDATE agent_runs SET user_id = admin_id WHERE user_id IS NULL;
  ALTER TABLE agent_runs ALTER COLUMN user_id SET NOT NULL;

  -- automation_rules
  ALTER TABLE automation_rules ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  UPDATE automation_rules SET user_id = admin_id WHERE user_id IS NULL;
  ALTER TABLE automation_rules ALTER COLUMN user_id SET NOT NULL;

  -- followers (and drop cross-tenant uniqueness)
  ALTER TABLE followers ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  UPDATE followers SET user_id = admin_id WHERE user_id IS NULL;
  ALTER TABLE followers ALTER COLUMN user_id SET NOT NULL;

  -- follower_action_rules
  ALTER TABLE follower_action_rules ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  UPDATE follower_action_rules SET user_id = admin_id WHERE user_id IS NULL;
  ALTER TABLE follower_action_rules ALTER COLUMN user_id SET NOT NULL;

  -- commenter_profiles (and drop cross-tenant uniqueness)
  ALTER TABLE commenter_profiles ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
  UPDATE commenter_profiles SET user_id = admin_id WHERE user_id IS NULL;
  ALTER TABLE commenter_profiles ALTER COLUMN user_id SET NOT NULL;
END $$;

-- Replace cross-tenant UNIQUE constraints with user-scoped ones.
ALTER TABLE followers DROP CONSTRAINT IF EXISTS followers_platform_username_key;
ALTER TABLE followers ADD CONSTRAINT followers_user_platform_username_key UNIQUE (user_id, platform, username);

ALTER TABLE commenter_profiles DROP CONSTRAINT IF EXISTS commenter_profiles_platform_username_key;
ALTER TABLE commenter_profiles ADD CONSTRAINT commenter_profiles_user_platform_username_key UNIQUE (user_id, platform, username);

-- Indexes for user-scoped queries.
CREATE INDEX IF NOT EXISTS idx_voice_settings_user_id ON voice_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_runs_user_id ON agent_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_user_id ON automation_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_followers_user_id ON followers(user_id);
CREATE INDEX IF NOT EXISTS idx_follower_action_rules_user_id ON follower_action_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_commenter_profiles_user_id ON commenter_profiles(user_id);

-- Tighten RLS: replace permissive USING (true) policies with user-scoped ones.
-- These cover tables that have a direct user_id column. Tables scoped via
-- FK (linked_accounts, comments, replies, customers, voice_documents,
-- voice_examples, follower_actions) get policies in a follow-up step once
-- their parent tables are confirmed scoped.

-- profiles
DROP POLICY IF EXISTS "profiles_select" ON profiles;
DROP POLICY IF EXISTS "profiles_insert" ON profiles;
DROP POLICY IF EXISTS "profiles_update" ON profiles;
DROP POLICY IF EXISTS "profiles_delete" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "profiles_insert" ON profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "profiles_update" ON profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "profiles_delete" ON profiles FOR DELETE TO authenticated USING (user_id = auth.uid());

-- voice_settings
DROP POLICY IF EXISTS "voice_settings_select" ON voice_settings;
DROP POLICY IF EXISTS "voice_settings_insert" ON voice_settings;
DROP POLICY IF EXISTS "voice_settings_update" ON voice_settings;
DROP POLICY IF EXISTS "voice_settings_delete" ON voice_settings;
CREATE POLICY "voice_settings_select" ON voice_settings FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "voice_settings_insert" ON voice_settings FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "voice_settings_update" ON voice_settings FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "voice_settings_delete" ON voice_settings FOR DELETE TO authenticated USING (user_id = auth.uid());

-- agent_runs
DROP POLICY IF EXISTS "agent_runs_select" ON agent_runs;
DROP POLICY IF EXISTS "agent_runs_insert" ON agent_runs;
DROP POLICY IF EXISTS "agent_runs_update" ON agent_runs;
CREATE POLICY "agent_runs_select" ON agent_runs FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "agent_runs_insert" ON agent_runs FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "agent_runs_update" ON agent_runs FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- automation_rules
DROP POLICY IF EXISTS "automation_rules_select" ON automation_rules;
DROP POLICY IF EXISTS "automation_rules_insert" ON automation_rules;
DROP POLICY IF EXISTS "automation_rules_update" ON automation_rules;
DROP POLICY IF EXISTS "automation_rules_delete" ON automation_rules;
CREATE POLICY "automation_rules_select" ON automation_rules FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "automation_rules_insert" ON automation_rules FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "automation_rules_update" ON automation_rules FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "automation_rules_delete" ON automation_rules FOR DELETE TO authenticated USING (user_id = auth.uid());

-- followers
DROP POLICY IF EXISTS "followers_select" ON followers;
DROP POLICY IF EXISTS "followers_insert" ON followers;
DROP POLICY IF EXISTS "followers_update" ON followers;
CREATE POLICY "followers_select" ON followers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "followers_insert" ON followers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "followers_update" ON followers FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- follower_action_rules
DROP POLICY IF EXISTS "follower_action_rules_select" ON follower_action_rules;
DROP POLICY IF EXISTS "follower_action_rules_insert" ON follower_action_rules;
DROP POLICY IF EXISTS "follower_action_rules_update" ON follower_action_rules;
DROP POLICY IF EXISTS "follower_action_rules_delete" ON follower_action_rules;
CREATE POLICY "follower_action_rules_select" ON follower_action_rules FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "follower_action_rules_insert" ON follower_action_rules FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "follower_action_rules_update" ON follower_action_rules FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "follower_action_rules_delete" ON follower_action_rules FOR DELETE TO authenticated USING (user_id = auth.uid());

-- commenter_profiles
DROP POLICY IF EXISTS "commenter_profiles_select" ON commenter_profiles;
DROP POLICY IF EXISTS "commenter_profiles_insert" ON commenter_profiles;
DROP POLICY IF EXISTS "commenter_profiles_update" ON commenter_profiles;
CREATE POLICY "commenter_profiles_select" ON commenter_profiles FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "commenter_profiles_insert" ON commenter_profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "commenter_profiles_update" ON commenter_profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- smart_tags (already had user_id, just tighten policy)
DROP POLICY IF EXISTS "smart_tags_select" ON smart_tags;
DROP POLICY IF EXISTS "smart_tags_insert" ON smart_tags;
DROP POLICY IF EXISTS "smart_tags_update" ON smart_tags;
DROP POLICY IF EXISTS "smart_tags_delete" ON smart_tags;
CREATE POLICY "smart_tags_select" ON smart_tags FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "smart_tags_insert" ON smart_tags FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "smart_tags_update" ON smart_tags FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "smart_tags_delete" ON smart_tags FOR DELETE TO authenticated USING (user_id = auth.uid());

-- FK-scoped tables. EXISTS subqueries on the parent table enforce the
-- ownership chain.

-- linked_accounts via profiles
DROP POLICY IF EXISTS "linked_accounts_select" ON linked_accounts;
DROP POLICY IF EXISTS "linked_accounts_insert" ON linked_accounts;
DROP POLICY IF EXISTS "linked_accounts_update" ON linked_accounts;
CREATE POLICY "linked_accounts_select" ON linked_accounts FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = linked_accounts.profile_id AND p.user_id = auth.uid()));
CREATE POLICY "linked_accounts_insert" ON linked_accounts FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = linked_accounts.profile_id AND p.user_id = auth.uid()));
CREATE POLICY "linked_accounts_update" ON linked_accounts FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = linked_accounts.profile_id AND p.user_id = auth.uid()));

-- comments via profiles (profile_id was added in 014; allow NULL profile_id only for admin-owned legacy rows)
DROP POLICY IF EXISTS "comments_select" ON comments;
DROP POLICY IF EXISTS "comments_insert" ON comments;
DROP POLICY IF EXISTS "comments_update" ON comments;
CREATE POLICY "comments_select" ON comments FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = comments.profile_id AND p.user_id = auth.uid()));
CREATE POLICY "comments_insert" ON comments FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = comments.profile_id AND p.user_id = auth.uid()));
CREATE POLICY "comments_update" ON comments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = comments.profile_id AND p.user_id = auth.uid()));

-- replies via comments
DROP POLICY IF EXISTS "replies_select" ON replies;
DROP POLICY IF EXISTS "replies_insert" ON replies;
DROP POLICY IF EXISTS "replies_update" ON replies;
CREATE POLICY "replies_select" ON replies FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM comments c JOIN profiles p ON p.id = c.profile_id WHERE c.id = replies.comment_id AND p.user_id = auth.uid()));
CREATE POLICY "replies_insert" ON replies FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM comments c JOIN profiles p ON p.id = c.profile_id WHERE c.id = replies.comment_id AND p.user_id = auth.uid()));
CREATE POLICY "replies_update" ON replies FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM comments c JOIN profiles p ON p.id = c.profile_id WHERE c.id = replies.comment_id AND p.user_id = auth.uid()));

-- customers via profiles
DROP POLICY IF EXISTS "customers_select" ON customers;
DROP POLICY IF EXISTS "customers_insert" ON customers;
DROP POLICY IF EXISTS "customers_update" ON customers;
DROP POLICY IF EXISTS "customers_delete" ON customers;
CREATE POLICY "customers_select" ON customers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = customers.profile_id AND p.user_id = auth.uid()));
CREATE POLICY "customers_insert" ON customers FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p WHERE p.id = customers.profile_id AND p.user_id = auth.uid()));
CREATE POLICY "customers_update" ON customers FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = customers.profile_id AND p.user_id = auth.uid()));
CREATE POLICY "customers_delete" ON customers FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p WHERE p.id = customers.profile_id AND p.user_id = auth.uid()));

-- voice_documents via voice_settings
DROP POLICY IF EXISTS "voice_documents_select" ON voice_documents;
DROP POLICY IF EXISTS "voice_documents_insert" ON voice_documents;
DROP POLICY IF EXISTS "voice_documents_delete" ON voice_documents;
CREATE POLICY "voice_documents_select" ON voice_documents FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM voice_settings v WHERE v.id = voice_documents.voice_settings_id AND v.user_id = auth.uid()));
CREATE POLICY "voice_documents_insert" ON voice_documents FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM voice_settings v WHERE v.id = voice_documents.voice_settings_id AND v.user_id = auth.uid()));
CREATE POLICY "voice_documents_delete" ON voice_documents FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM voice_settings v WHERE v.id = voice_documents.voice_settings_id AND v.user_id = auth.uid()));

-- voice_examples via voice_settings
DROP POLICY IF EXISTS "voice_examples_select" ON voice_examples;
DROP POLICY IF EXISTS "voice_examples_insert" ON voice_examples;
DROP POLICY IF EXISTS "voice_examples_delete" ON voice_examples;
CREATE POLICY "voice_examples_select" ON voice_examples FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM voice_settings v WHERE v.id = voice_examples.voice_settings_id AND v.user_id = auth.uid()));
CREATE POLICY "voice_examples_insert" ON voice_examples FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM voice_settings v WHERE v.id = voice_examples.voice_settings_id AND v.user_id = auth.uid()));
CREATE POLICY "voice_examples_delete" ON voice_examples FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM voice_settings v WHERE v.id = voice_examples.voice_settings_id AND v.user_id = auth.uid()));

-- follower_actions via followers
DROP POLICY IF EXISTS "follower_actions_select" ON follower_actions;
DROP POLICY IF EXISTS "follower_actions_insert" ON follower_actions;
DROP POLICY IF EXISTS "follower_actions_update" ON follower_actions;
CREATE POLICY "follower_actions_select" ON follower_actions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM followers f WHERE f.id = follower_actions.follower_id AND f.user_id = auth.uid()));
CREATE POLICY "follower_actions_insert" ON follower_actions FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM followers f WHERE f.id = follower_actions.follower_id AND f.user_id = auth.uid()));
CREATE POLICY "follower_actions_update" ON follower_actions FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM followers f WHERE f.id = follower_actions.follower_id AND f.user_id = auth.uid()));

-- subscriptions (already had user_id; replace permissive policies)
DROP POLICY IF EXISTS "subscriptions_all" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_select_auth" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_insert_auth" ON subscriptions;
DROP POLICY IF EXISTS "subscriptions_update_auth" ON subscriptions;
CREATE POLICY "subscriptions_select" ON subscriptions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "subscriptions_service_role" ON subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

-- usage_tracking (already had user_id; replace permissive policies)
DROP POLICY IF EXISTS "usage_tracking_all" ON usage_tracking;
DROP POLICY IF EXISTS "usage_tracking_select_auth" ON usage_tracking;
DROP POLICY IF EXISTS "usage_tracking_insert_auth" ON usage_tracking;
DROP POLICY IF EXISTS "usage_tracking_update_auth" ON usage_tracking;
CREATE POLICY "usage_tracking_select" ON usage_tracking FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "usage_tracking_service_role" ON usage_tracking FOR ALL TO service_role USING (true) WITH CHECK (true);
