-- Allow upsert of a single weekly schedule per tenant
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'audit_schedules_tenant_unique'
  ) THEN
    ALTER TABLE audit_schedules ADD CONSTRAINT audit_schedules_tenant_unique UNIQUE (tenant_id);
  END IF;
END$$;
