-- Add auth_flow field to sso_config ('redirect' or 'device_code')
ALTER TABLE sso_config
  ADD COLUMN IF NOT EXISTS auth_flow TEXT NOT NULL DEFAULT 'redirect';
