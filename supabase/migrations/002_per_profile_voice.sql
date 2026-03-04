-- Add name column to voice_settings
ALTER TABLE voice_settings ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT 'Default Voice';

-- Fix auto_threshold CHECK to include 'none' (UI already uses it)
ALTER TABLE voice_settings DROP CONSTRAINT IF EXISTS voice_settings_auto_threshold_check;
ALTER TABLE voice_settings ADD CONSTRAINT voice_settings_auto_threshold_check
  CHECK (auto_threshold IN ('none', 'simple', 'most', 'all'));

-- Add voice_id FK on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS voice_id UUID REFERENCES voice_settings(id) ON DELETE SET NULL;

-- Add voice_settings_id FK on voice_examples and voice_documents
ALTER TABLE voice_examples ADD COLUMN IF NOT EXISTS voice_settings_id UUID REFERENCES voice_settings(id) ON DELETE CASCADE;
ALTER TABLE voice_documents ADD COLUMN IF NOT EXISTS voice_settings_id UUID REFERENCES voice_settings(id) ON DELETE CASCADE;

-- Backfill: link existing data to existing voice_settings row
DO $$ DECLARE _vid UUID;
BEGIN
  SELECT id INTO _vid FROM voice_settings LIMIT 1;
  IF _vid IS NOT NULL THEN
    UPDATE profiles SET voice_id = _vid WHERE voice_id IS NULL;
    UPDATE voice_examples SET voice_settings_id = _vid WHERE voice_settings_id IS NULL;
    UPDATE voice_documents SET voice_settings_id = _vid WHERE voice_settings_id IS NULL;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profiles_voice_id ON profiles(voice_id);
CREATE INDEX IF NOT EXISTS idx_voice_examples_voice_settings_id ON voice_examples(voice_settings_id);
CREATE INDEX IF NOT EXISTS idx_voice_documents_voice_settings_id ON voice_documents(voice_settings_id);

-- RLS: allow delete on voice_settings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'voice_settings' AND policyname = 'voice_settings_delete'
  ) THEN
    CREATE POLICY "voice_settings_delete" ON voice_settings FOR DELETE TO anon USING (true);
  END IF;
END $$;
