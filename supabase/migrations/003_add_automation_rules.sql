-- Add automation_rules table
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  keywords TEXT[] NOT NULL DEFAULT '{}',
  match_mode TEXT NOT NULL DEFAULT 'any' CHECK (match_mode IN ('any', 'all')),
  action_type TEXT NOT NULL DEFAULT 'ai_instruction' CHECK (action_type IN ('fixed', 'ai_instruction')),
  fixed_template TEXT,
  ai_instruction TEXT,
  auto_send BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  priority INTEGER NOT NULL DEFAULT 0,
  platform TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_priority ON automation_rules(priority DESC);

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "automation_rules_select" ON automation_rules FOR SELECT TO anon USING (true);
CREATE POLICY "automation_rules_insert" ON automation_rules FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "automation_rules_update" ON automation_rules FOR UPDATE TO anon USING (true);
CREATE POLICY "automation_rules_delete" ON automation_rules FOR DELETE TO anon USING (true);

-- Add automation_rule_id to replies
ALTER TABLE replies ADD COLUMN IF NOT EXISTS automation_rule_id UUID REFERENCES automation_rules(id) ON DELETE SET NULL;
