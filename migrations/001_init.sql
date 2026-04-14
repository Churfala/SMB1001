-- ControlCheck – Database Schema
-- Migration 001: Initial schema

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TENANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  slug        VARCHAR(100) UNIQUE NOT NULL,
  status      VARCHAR(20)  NOT NULL DEFAULT 'active'
                CHECK (status IN ('active', 'inactive', 'suspended')),
  settings    JSONB        NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email         VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role          VARCHAR(20)  NOT NULL DEFAULT 'readonly'
                  CHECK (role IN ('admin', 'auditor', 'readonly')),
  first_name    VARCHAR(100),
  last_name     VARCHAR(100),
  is_active     BOOLEAN      NOT NULL DEFAULT true,
  last_login    TIMESTAMPTZ,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, email)
);

-- ============================================================
-- INTEGRATIONS
-- Stores OAuth credentials (tokens encrypted at app level)
-- ============================================================
CREATE TABLE IF NOT EXISTS integrations (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type                    VARCHAR(20) NOT NULL CHECK (type IN ('m365', 'google')),
  client_id               VARCHAR(500),
  encrypted_client_secret TEXT,
  encrypted_access_token  TEXT,
  encrypted_refresh_token TEXT,
  token_expires_at        TIMESTAMPTZ,
  scopes                  TEXT[],
  status                  VARCHAR(20) NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'connected', 'error', 'revoked')),
  last_sync               TIMESTAMPTZ,
  metadata                JSONB       NOT NULL DEFAULT '{}',
  error_message           TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, type)
);

-- ============================================================
-- CONTROLS
-- SMB1001 control catalogue (seeded in migration 002/009)
-- ============================================================
CREATE TABLE IF NOT EXISTS controls (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  control_id           VARCHAR(50) UNIQUE NOT NULL,
  name                 VARCHAR(255) NOT NULL,
  description          TEXT         NOT NULL,
  category             VARCHAR(100) NOT NULL,
  severity             VARCHAR(20)  NOT NULL
                         CHECK (severity IN ('critical', 'high', 'medium', 'low')),
  validation_type      VARCHAR(20)  NOT NULL DEFAULT 'manual'
                         CHECK (validation_type IN ('automated', 'manual', 'hybrid')),
  integration_type     VARCHAR(20)
                         CHECK (integration_type IN ('m365', 'google', 'both', 'none')),
  evidence_requirements TEXT,
  remediation_guidance  TEXT,
  "references"          TEXT[],
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDITS
-- One audit record per audit run per tenant
-- ============================================================
CREATE TABLE IF NOT EXISTS audits (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id    UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name         VARCHAR(255) NOT NULL,
  status       VARCHAR(20)  NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending','queued','running','completed','failed','cancelled')),
  created_by   UUID        NOT NULL REFERENCES users(id),
  job_id       VARCHAR(255),
  started_at   TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  score        DECIMAL(5,2),
  summary      JSONB NOT NULL DEFAULT '{}',
  metadata     JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT RESULTS
-- One row per (audit, control) pair
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_results (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id    UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  control_id  UUID NOT NULL REFERENCES controls(id),
  status      VARCHAR(20) NOT NULL DEFAULT 'not_applicable'
                CHECK (status IN ('pass','fail','partial','not_applicable','manual_review')),
  score       DECIMAL(5,2),
  raw_data    JSONB NOT NULL DEFAULT '{}',
  notes       TEXT,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (audit_id, control_id)
);

-- ============================================================
-- EVIDENCE
-- Attached to a specific audit result
-- ============================================================
CREATE TABLE IF NOT EXISTS evidence (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_result_id  UUID REFERENCES audit_results(id) ON DELETE CASCADE,
  audit_id         UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  control_id       UUID NOT NULL REFERENCES controls(id),
  type             VARCHAR(10) NOT NULL CHECK (type IN ('text', 'file')),
  content          TEXT,
  file_path        VARCHAR(500),
  file_name        VARCHAR(255),
  file_size        INTEGER,
  mime_type        VARCHAR(100),
  uploaded_by      UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT SCHEDULES
-- Cron-based recurring audit schedules per tenant
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_schedules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  cron_expression VARCHAR(100) NOT NULL,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  last_run        TIMESTAMPTZ,
  next_run        TIMESTAMPTZ,
  created_by      UUID NOT NULL REFERENCES users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOGS
-- Immutable event log for user actions and system events
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID REFERENCES tenants(id) ON DELETE SET NULL,
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  action        VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50),
  resource_id   UUID,
  details       JSONB NOT NULL DEFAULT '{}',
  ip_address    INET,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_users_tenant_id          ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email              ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_tenant_email       ON users(tenant_id, email);

CREATE INDEX IF NOT EXISTS idx_integrations_tenant_id   ON integrations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_integrations_type        ON integrations(tenant_id, type);

CREATE INDEX IF NOT EXISTS idx_audits_tenant_id         ON audits(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audits_status            ON audits(status);
CREATE INDEX IF NOT EXISTS idx_audits_created_at        ON audits(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_results_audit_id   ON audit_results(audit_id);
CREATE INDEX IF NOT EXISTS idx_audit_results_tenant_id  ON audit_results(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_results_control_id ON audit_results(control_id);
CREATE INDEX IF NOT EXISTS idx_audit_results_status     ON audit_results(status);

CREATE INDEX IF NOT EXISTS idx_evidence_audit_id        ON evidence(audit_id);
CREATE INDEX IF NOT EXISTS idx_evidence_result_id       ON evidence(audit_result_id);

CREATE INDEX IF NOT EXISTS idx_schedules_tenant_id      ON audit_schedules(tenant_id);
CREATE INDEX IF NOT EXISTS idx_schedules_next_run       ON audit_schedules(next_run) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant_id     ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id       ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action        ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at    ON audit_logs(created_at DESC);

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tenants_updated_at ON tenants;
CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_users_updated_at ON users;
CREATE TRIGGER trg_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_integrations_updated_at ON integrations;
CREATE TRIGGER trg_integrations_updated_at
  BEFORE UPDATE ON integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_controls_updated_at ON controls;
CREATE TRIGGER trg_controls_updated_at
  BEFORE UPDATE ON controls
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_audits_updated_at ON audits;
CREATE TRIGGER trg_audits_updated_at
  BEFORE UPDATE ON audits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_audit_results_updated_at ON audit_results;
CREATE TRIGGER trg_audit_results_updated_at
  BEFORE UPDATE ON audit_results
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_audit_schedules_updated_at ON audit_schedules;
CREATE TRIGGER trg_audit_schedules_updated_at
  BEFORE UPDATE ON audit_schedules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
