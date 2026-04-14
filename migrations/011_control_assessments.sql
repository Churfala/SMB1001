-- Migration 011: Control Assessments (compliance register)
-- Per-tenant, per-control assessment record with review dates and attached evidence.
-- Separate from audit runs — allows persistent compliance tracking.

CREATE TABLE IF NOT EXISTS control_assessments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  control_id  UUID NOT NULL REFERENCES controls(id),
  status      VARCHAR(20) NOT NULL DEFAULT 'not_assessed'
              CHECK (status IN ('pass','fail','partial','not_applicable','not_assessed')),
  notes       TEXT,
  review_date DATE,
  reviewed_by UUID REFERENCES users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, control_id)
);

CREATE TABLE IF NOT EXISTS assessment_evidence (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES control_assessments(id) ON DELETE CASCADE,
  tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  control_id    UUID NOT NULL REFERENCES controls(id),
  type          VARCHAR(10) NOT NULL CHECK (type IN ('text', 'file')),
  content       TEXT,
  file_path     VARCHAR(500),
  file_name     VARCHAR(255),
  file_size     INTEGER,
  mime_type     VARCHAR(100),
  uploaded_by   UUID NOT NULL REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_control_assessments_tenant        ON control_assessments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_control_assessments_tenant_ctrl   ON control_assessments(tenant_id, control_id);
CREATE INDEX IF NOT EXISTS idx_control_assessments_review_date   ON control_assessments(review_date) WHERE review_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assessment_evidence_assessment     ON assessment_evidence(assessment_id);
CREATE INDEX IF NOT EXISTS idx_assessment_evidence_tenant         ON assessment_evidence(tenant_id);

DROP TRIGGER IF EXISTS trg_assessments_updated_at ON control_assessments;
CREATE TRIGGER trg_assessments_updated_at
  BEFORE UPDATE ON control_assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
