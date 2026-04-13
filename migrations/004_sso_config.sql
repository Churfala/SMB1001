-- SSO configuration (singleton row, id is always 1)
CREATE TABLE IF NOT EXISTS sso_config (
  id               INT PRIMARY KEY DEFAULT 1,
  entra_tenant_id        TEXT,
  entra_client_id        TEXT,
  encrypted_client_secret TEXT,
  redirect_uri           TEXT,
  sso_tenant_slug        TEXT NOT NULL DEFAULT 'msp-admin',
  auto_provision         BOOLEAN NOT NULL DEFAULT TRUE,
  is_enabled             BOOLEAN NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT sso_config_singleton CHECK (id = 1)
);

-- Seed the single config row so GET always returns something
INSERT INTO sso_config (id) VALUES (1) ON CONFLICT DO NOTHING;
