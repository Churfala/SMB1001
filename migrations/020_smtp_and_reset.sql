-- SMTP configuration (single-row, same pattern as sso_config)
CREATE TABLE IF NOT EXISTS smtp_config (
  id                       INTEGER PRIMARY KEY DEFAULT 1,
  host                     TEXT,
  port                     INTEGER NOT NULL DEFAULT 587,
  secure                   BOOLEAN NOT NULL DEFAULT false,
  username                 TEXT,
  encrypted_password       TEXT,
  from_address             TEXT NOT NULL DEFAULT 'ControlCheck <noreply@controlcheck.app>',
  is_enabled               BOOLEAN NOT NULL DEFAULT false,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT smtp_config_single_row CHECK (id = 1)
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS prt_token_idx   ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS prt_user_idx    ON password_reset_tokens(user_id);
