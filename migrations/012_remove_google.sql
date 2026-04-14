-- Remove Google Workspace integration support
-- Google integration has been removed; only M365 is supported going forward.

-- Delete any existing Google integrations
DELETE FROM integrations WHERE type = 'google';

-- Update CHECK constraint on integrations.type to only allow 'm365'
ALTER TABLE integrations DROP CONSTRAINT IF EXISTS integrations_type_check;
ALTER TABLE integrations ADD CONSTRAINT integrations_type_check
  CHECK (type IN ('m365'));
