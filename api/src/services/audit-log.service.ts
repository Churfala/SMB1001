import { query } from '../config/database';

interface AuditLogParams {
  tenantId?: string;
  userId?: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Write an immutable audit log entry.
 * Errors are swallowed so that logging never disrupts the request path.
 */
export const auditLogService = {
  async log(params: AuditLogParams): Promise<void> {
    try {
      await query(
        `INSERT INTO audit_logs
           (tenant_id, user_id, action, resource_type, resource_id, details, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5, $6, $7::inet, $8)`,
        [
          params.tenantId ?? null,
          params.userId ?? null,
          params.action,
          params.resourceType ?? null,
          params.resourceId ?? null,
          JSON.stringify(params.details ?? {}),
          params.ipAddress ?? null,
          params.userAgent ?? null,
        ],
      );
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  },
};
