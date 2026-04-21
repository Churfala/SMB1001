import { FastifyInstance } from 'fastify';
import { auditLogController } from '../controllers/audit-log.controller';
import { authenticate, requireRole } from '../middleware/authenticate';
import { validateTenantAccess } from '../middleware/tenant';

export async function auditLogRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // Admin-only: view the activity log for a tenant
  app.get(
    '/:tenantId/audit-logs',
    { preHandler: [validateTenantAccess, requireRole('admin')] as any },
    auditLogController.list,
  );
}
