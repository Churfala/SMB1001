export type UserRole = 'admin' | 'auditor' | 'readonly';
export type IntegrationType = 'm365';
export type ControlSeverity = 'critical' | 'high' | 'medium' | 'low';
export type ValidationType = 'automated' | 'manual' | 'hybrid';
export type IntegrationScopeType = 'm365' | 'none';
export type AuditStatus = 'pending' | 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';
export type ResultStatus = 'pass' | 'fail' | 'partial' | 'not_applicable' | 'manual_review';
export type EvidenceType = 'text' | 'file';
export type IntegrationStatus = 'pending' | 'connected' | 'error' | 'revoked';

export interface Framework {
  id: string;
  code: string;
  name: string;
  version: string | null;
  description: string | null;
  tier_config: object[];
  domain_label: string;
  is_active: boolean;
  created_at: Date;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  settings: Record<string, unknown>;
  framework_id: string | null;
  created_at: Date;
  updated_at: Date;
  // Joined from frameworks table (always resolved — never null)
  resolved_framework_id: string;
  framework_code: string;
  framework_name: string;
  framework_tier_config: object[];
  framework_domain_label: string;
}

export interface User {
  id: string;
  tenant_id: string;
  email: string;
  password_hash: string;
  role: UserRole;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  last_login: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Integration {
  id: string;
  tenant_id: string;
  type: IntegrationType;
  client_id: string | null;
  encrypted_client_secret: string | null;
  encrypted_access_token: string | null;
  encrypted_refresh_token: string | null;
  token_expires_at: Date | null;
  scopes: string[];
  status: IntegrationStatus;
  last_sync: Date | null;
  metadata: Record<string, unknown>;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface Control {
  id: string;
  control_id: string;
  name: string;
  description: string;
  category: string;
  severity: ControlSeverity;
  tier: number;
  validation_type: ValidationType;
  integration_type: IntegrationScopeType | null;
  evidence_requirements: string | null;
  remediation_guidance: string | null;
  references: string[];
  framework_id: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface Audit {
  id: string;
  tenant_id: string;
  name: string;
  status: AuditStatus;
  created_by: string;
  job_id: string | null;
  started_at: Date | null;
  completed_at: Date | null;
  score: number | null;
  summary: Record<string, unknown>;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface AuditResult {
  id: string;
  audit_id: string;
  tenant_id: string;
  control_id: string;
  status: ResultStatus;
  score: number | null;
  raw_data: Record<string, unknown>;
  notes: string | null;
  reviewed_by: string | null;
  reviewed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Evidence {
  id: string;
  audit_result_id: string | null;
  audit_id: string;
  tenant_id: string;
  control_id: string;
  type: EvidenceType;
  content: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by: string;
  created_at: Date;
}

export interface AuditSchedule {
  id: string;
  tenant_id: string;
  name: string;
  cron_expression: string;
  is_active: boolean;
  last_run: Date | null;
  next_run: Date | null;
  created_by: string;
  created_at: Date;
  updated_at: Date;
}

/** JWT access token payload */
export interface JwtPayload {
  sub: string;       // user id
  tenant_id: string;
  role: UserRole;
  email: string;
  iat?: number;
  exp?: number;
}

/** Fastify request extension */
declare module 'fastify' {
  interface FastifyRequest {
    user: JwtPayload;
  }
}
