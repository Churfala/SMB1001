-- Migration 013: per-user tenant access grants
-- Grants a non-admin user explicit access to additional tenants beyond their home tenant.
-- A user's home tenant (users.tenant_id) is ALWAYS accessible and does NOT
-- need a row here. This table only stores *additional* grants.

CREATE TABLE IF NOT EXISTS user_tenant_access (
  user_id    UUID NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID         REFERENCES users(id)    ON DELETE SET NULL,
  PRIMARY KEY (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_uta_user_id   ON user_tenant_access(user_id);
CREATE INDEX IF NOT EXISTS idx_uta_tenant_id ON user_tenant_access(tenant_id);
