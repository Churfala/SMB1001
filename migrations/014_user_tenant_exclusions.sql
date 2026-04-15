-- Migration 014: repurpose user_tenant_access as an exclusions (deny) list.
-- Auditors see ALL tenants by default; this table records which tenants
-- a specific user is explicitly EXCLUDED from.

ALTER TABLE user_tenant_access RENAME TO user_tenant_exclusions;
ALTER TABLE user_tenant_exclusions RENAME COLUMN granted_at TO excluded_at;
ALTER TABLE user_tenant_exclusions RENAME COLUMN granted_by TO excluded_by;

ALTER INDEX IF EXISTS idx_uta_user_id   RENAME TO idx_ute_user_id;
ALTER INDEX IF EXISTS idx_uta_tenant_id RENAME TO idx_ute_tenant_id;
