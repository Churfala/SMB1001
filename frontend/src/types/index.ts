export type UserRole = 'admin' | 'auditor' | 'readonly' | 'client';
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
  has_password?: boolean;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
}

export interface TierInfo {
  tier: number;
  name: string;
  color: string;
  bg: string;
  maxControls: number;
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  framework_id: string | null;
  resolved_framework_id: string;
  framework_code: string;
  framework_name: string;
  framework_tier_config: TierInfo[];
  framework_domain_label: string;
}


export interface Control {
  id: string;
  control_id: string;
  name: string;
  description: string;
  category: string;
  severity: ControlSeverity;
  tier: number;
  validation_type: 'automated' | 'manual' | 'hybrid';
  integration_type: string;
  evidence_requirements: string | null;
  remediation_guidance: string | null;
  references: string[];
  framework_id: string;
}

export type AssessmentStatus = 'pass' | 'fail' | 'partial' | 'not_applicable' | 'not_assessed';

export interface Assessment {
  control_db_id: string;
  control_id: string;
  control_name: string;
  category: string;
  tier: number;
  assessment_id: string | null;
  status: AssessmentStatus;
  notes: string | null;
  review_date: string | null;
  reviewed_by: string | null;
}

export interface AssessmentEvidence {
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

export type TaskStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Task {
  id: string;
  tenant_id: string;
  control_id: string | null;
  control_ref: string | null;
  control_code: string | null;   // joined from controls table
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  assigned_to: string | null;
  assigned_to_email: string | null;
  assigned_to_name: string | null;
  due_date: string | null;
  created_by: string;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
  resolution_notes: string | null;
}

export interface AuditLogEntry {
  id: string;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_email: string | null;
  user_name: string | null;
  created_at: string;
}

