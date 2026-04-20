export type UserRole = 'admin' | 'auditor' | 'readonly';
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


