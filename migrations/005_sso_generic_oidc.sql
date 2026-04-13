-- Migrate sso_config from Entra-specific to generic OIDC
ALTER TABLE sso_config
  ADD COLUMN IF NOT EXISTS provider        TEXT NOT NULL DEFAULT 'custom',
  ADD COLUMN IF NOT EXISTS provider_label  TEXT NOT NULL DEFAULT 'SSO',
  ADD COLUMN IF NOT EXISTS authorization_url TEXT,
  ADD COLUMN IF NOT EXISTS token_url       TEXT,
  ADD COLUMN IF NOT EXISTS client_id       TEXT,
  ADD COLUMN IF NOT EXISTS scopes          TEXT NOT NULL DEFAULT 'openid email profile';

-- Migrate any existing Entra data into the generic columns
UPDATE sso_config SET
  provider       = 'entra',
  provider_label = 'Microsoft Entra',
  client_id      = entra_client_id,
  authorization_url = CASE
    WHEN entra_tenant_id IS NOT NULL AND entra_tenant_id != ''
    THEN 'https://login.microsoftonline.com/' || entra_tenant_id || '/oauth2/v2.0/authorize'
    ELSE NULL
  END,
  token_url = CASE
    WHEN entra_tenant_id IS NOT NULL AND entra_tenant_id != ''
    THEN 'https://login.microsoftonline.com/' || entra_tenant_id || '/oauth2/v2.0/token'
    ELSE NULL
  END
WHERE id = 1 AND (entra_client_id IS NOT NULL OR entra_tenant_id IS NOT NULL);

-- Remove Entra-specific columns
ALTER TABLE sso_config
  DROP COLUMN IF EXISTS entra_tenant_id,
  DROP COLUMN IF EXISTS entra_client_id;
