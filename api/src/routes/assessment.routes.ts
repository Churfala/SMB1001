import { FastifyInstance } from 'fastify';
import { assessmentController } from '../controllers/assessment.controller';
import { authenticate, requireRole } from '../middleware/authenticate';
import { validateTenantAccess } from '../middleware/tenant';

export async function assessmentRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get(
    '/:tenantId/assessments',
    { preHandler: [validateTenantAccess] as any },
    assessmentController.list,
  );

  app.put(
    '/:tenantId/assessments/:controlId',
    { preHandler: [validateTenantAccess, requireRole('admin', 'auditor')] as any },
    assessmentController.upsert,
  );

  app.get(
    '/:tenantId/assessments/:controlId/evidence',
    { preHandler: [validateTenantAccess] as any },
    assessmentController.listEvidence,
  );

  app.post(
    '/:tenantId/assessments/:controlId/evidence/text',
    { preHandler: [validateTenantAccess, requireRole('admin', 'auditor')] as any },
    assessmentController.addTextEvidence,
  );

  app.post(
    '/:tenantId/assessments/:controlId/evidence/file',
    { preHandler: [validateTenantAccess, requireRole('admin', 'auditor')] as any },
    assessmentController.uploadFileEvidence,
  );
}
