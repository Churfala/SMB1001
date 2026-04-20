-- Migration 016: Add framework_id to controls
-- Backfills all existing controls to SMB1001:2026, then replaces single-column
-- unique constraint with a composite (framework_id, control_id) constraint.

ALTER TABLE controls ADD COLUMN IF NOT EXISTS framework_id UUID REFERENCES frameworks(id);

-- Backfill existing SMB1001 controls
UPDATE controls
SET framework_id = (SELECT id FROM frameworks WHERE code = 'SMB1001:2026')
WHERE framework_id IS NULL;

ALTER TABLE controls ALTER COLUMN framework_id SET NOT NULL;

-- Replace single-column unique constraint with composite
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'controls_control_id_key') THEN
    ALTER TABLE controls DROP CONSTRAINT controls_control_id_key;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'controls_framework_control_unique') THEN
    ALTER TABLE controls ADD CONSTRAINT controls_framework_control_unique
      UNIQUE (framework_id, control_id);
  END IF;
END $$;
