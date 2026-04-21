-- Remediation tasks / action items
CREATE TABLE IF NOT EXISTS tasks (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  control_id       UUID REFERENCES controls(id) ON DELETE SET NULL,
  control_ref      TEXT,    -- human-readable copy (e.g. "1.2") preserved if control row is deleted
  title            TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  priority         TEXT NOT NULL DEFAULT 'medium'
                     CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  assigned_to      UUID REFERENCES users(id) ON DELETE SET NULL,
  due_date         DATE,
  created_by       UUID NOT NULL REFERENCES users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at      TIMESTAMPTZ,
  resolution_notes TEXT
);

CREATE INDEX IF NOT EXISTS tasks_tenant_idx        ON tasks(tenant_id);
CREATE INDEX IF NOT EXISTS tasks_tenant_status_idx ON tasks(tenant_id, status);
CREATE INDEX IF NOT EXISTS tasks_assigned_idx      ON tasks(assigned_to) WHERE assigned_to IS NOT NULL;
CREATE INDEX IF NOT EXISTS tasks_due_date_idx      ON tasks(tenant_id, due_date) WHERE due_date IS NOT NULL;
