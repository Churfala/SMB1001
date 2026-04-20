-- Migration 017: Add framework_id to tenants
-- NULL means "use SMB1001:2026 default" — existing tenants retain their behaviour
-- without a data migration.

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS framework_id UUID REFERENCES frameworks(id);
