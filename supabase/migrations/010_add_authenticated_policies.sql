-- Add RLS policies for the "authenticated" role.
-- Previously only "anon" policies existed, so any Supabase client
-- with a valid JWT (authenticated role) got zero results.

-- Comments
CREATE POLICY "comments_select_auth" ON comments FOR SELECT TO authenticated USING (true);
CREATE POLICY "comments_insert_auth" ON comments FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "comments_update_auth" ON comments FOR UPDATE TO authenticated USING (true);

-- Replies
CREATE POLICY "replies_select_auth" ON replies FOR SELECT TO authenticated USING (true);
CREATE POLICY "replies_insert_auth" ON replies FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "replies_update_auth" ON replies FOR UPDATE TO authenticated USING (true);

-- Profiles
CREATE POLICY "profiles_select_auth" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_insert_auth" ON profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "profiles_update_auth" ON profiles FOR UPDATE TO authenticated USING (true);
CREATE POLICY "profiles_delete_auth" ON profiles FOR DELETE TO authenticated USING (true);

-- Linked accounts
CREATE POLICY "linked_accounts_select_auth" ON linked_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "linked_accounts_insert_auth" ON linked_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "linked_accounts_update_auth" ON linked_accounts FOR UPDATE TO authenticated USING (true);

-- Voice settings
CREATE POLICY "voice_settings_select_auth" ON voice_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "voice_settings_update_auth" ON voice_settings FOR UPDATE TO authenticated USING (true);
CREATE POLICY "voice_settings_insert_auth" ON voice_settings FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "voice_settings_delete_auth" ON voice_settings FOR DELETE TO authenticated USING (true);

-- Agent runs
CREATE POLICY "agent_runs_select_auth" ON agent_runs FOR SELECT TO authenticated USING (true);
CREATE POLICY "agent_runs_insert_auth" ON agent_runs FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "agent_runs_update_auth" ON agent_runs FOR UPDATE TO authenticated USING (true);

-- Voice documents
CREATE POLICY "voice_documents_select_auth" ON voice_documents FOR SELECT TO authenticated USING (true);
CREATE POLICY "voice_documents_insert_auth" ON voice_documents FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "voice_documents_delete_auth" ON voice_documents FOR DELETE TO authenticated USING (true);

-- Voice examples
CREATE POLICY "voice_examples_select_auth" ON voice_examples FOR SELECT TO authenticated USING (true);
CREATE POLICY "voice_examples_insert_auth" ON voice_examples FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "voice_examples_delete_auth" ON voice_examples FOR DELETE TO authenticated USING (true);

-- Commenter profiles
CREATE POLICY "commenter_profiles_select_auth" ON commenter_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "commenter_profiles_insert_auth" ON commenter_profiles FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "commenter_profiles_update_auth" ON commenter_profiles FOR UPDATE TO authenticated USING (true);

-- Smart tags
CREATE POLICY "smart_tags_select_auth" ON smart_tags FOR SELECT TO authenticated USING (true);
CREATE POLICY "smart_tags_insert_auth" ON smart_tags FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "smart_tags_update_auth" ON smart_tags FOR UPDATE TO authenticated USING (true);
CREATE POLICY "smart_tags_delete_auth" ON smart_tags FOR DELETE TO authenticated USING (true);

-- Customers
CREATE POLICY "customers_select_auth" ON customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "customers_insert_auth" ON customers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "customers_update_auth" ON customers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "customers_delete_auth" ON customers FOR DELETE TO authenticated USING (true);

-- Automation rules
CREATE POLICY "automation_rules_select_auth" ON automation_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "automation_rules_insert_auth" ON automation_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "automation_rules_update_auth" ON automation_rules FOR UPDATE TO authenticated USING (true);
CREATE POLICY "automation_rules_delete_auth" ON automation_rules FOR DELETE TO authenticated USING (true);

-- Followers
CREATE POLICY "followers_select_auth" ON followers FOR SELECT TO authenticated USING (true);
CREATE POLICY "followers_insert_auth" ON followers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "followers_update_auth" ON followers FOR UPDATE TO authenticated USING (true);

-- Follower action rules
CREATE POLICY "follower_action_rules_select_auth" ON follower_action_rules FOR SELECT TO authenticated USING (true);
CREATE POLICY "follower_action_rules_insert_auth" ON follower_action_rules FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "follower_action_rules_update_auth" ON follower_action_rules FOR UPDATE TO authenticated USING (true);
CREATE POLICY "follower_action_rules_delete_auth" ON follower_action_rules FOR DELETE TO authenticated USING (true);

-- Follower actions
CREATE POLICY "follower_actions_select_auth" ON follower_actions FOR SELECT TO authenticated USING (true);
CREATE POLICY "follower_actions_insert_auth" ON follower_actions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "follower_actions_update_auth" ON follower_actions FOR UPDATE TO authenticated USING (true);

-- Subscriptions (from migration 008)
CREATE POLICY "subscriptions_select_auth" ON subscriptions FOR SELECT TO authenticated USING (true);
CREATE POLICY "subscriptions_insert_auth" ON subscriptions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "subscriptions_update_auth" ON subscriptions FOR UPDATE TO authenticated USING (true);

-- Usage tracking (from migration 008)
CREATE POLICY "usage_tracking_select_auth" ON usage_tracking FOR SELECT TO authenticated USING (true);
CREATE POLICY "usage_tracking_insert_auth" ON usage_tracking FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "usage_tracking_update_auth" ON usage_tracking FOR UPDATE TO authenticated USING (true);
