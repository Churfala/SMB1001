export type UserRole = 'admin' | 'auditor' | 'readonly';
export type AuditStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ResultStatus = 'pass' | 'fail' | 'partial' | 'not_applicable' | 'manual_review';
export type ControlSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  firstName: string | null;
  lastName: string | null;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
}

export interface Integration {
  id: string;
  tenant_id: string;
  type: 'm365' | 'google';
  client_id: string | null;
  status: 'pending' | 'connected' | 'error' | 'revoked';
  scopes: string[];
  last_sync: string | null;
  error_message: string | null;
  token_expires_at: string | null;
  created_at: string;
}

export interface Control {
  id: string;
  control_id: string;
  name: string;
  description: string;
  category: string;
  severity: ControlSeverity;
  validation_type: 'automated' | 'manual' | 'hybrid';
  integration_type: string;
  evidence_requirements: string | null;
  remediation_guidance: string | null;
  references: string[];
}

export interface AuditResult {
  id: string;
  audit_id: string;
  control_id: string;
  control_code: string;
  control_name: string;
  category: string;
  severity: ControlSeverity;
  description: string;
  remediation_guidance: string | null;
  evidence_requirements: string | null;
  status: ResultStatus;
  score: number | null;
  notes: string | null;
  reviewer_name: string | null;
  reviewed_at: string | null;
}

export interface Audit {
  id: string;
  tenant_id: string;
  name: string;
  status: AuditStatus;
  score: number | null;
  job_id: string | null;
  started_at: string | null;
  completed_at: string | null;
  summary: {
    pass?: number;
    fail?: number;
    partial?: number;
    not_applicable?: number;
    manual_review?: number;
  };
  created_at: string;
  results?: AuditResult[];
}

export interface Evidence {
  id: string;
  type: 'text' | 'file';
  content: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  uploader_email: string;
  uploader_name: string;
  created_at: string;
}

export interface AuditSchedule {
  id: string;
  name: string;
  cron_expression: string;
  is_active: boolean;
  last_run: string | null;
  next_run: string | null;
  created_at: string;
}
