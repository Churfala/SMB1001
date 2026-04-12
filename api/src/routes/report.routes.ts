import { FastifyInstance } from 'fastify';
import { reportController } from '../controllers/report.controller';
import { authenticate } from '../middleware/authenticate';
import { validateTenantAccess } from '../middleware/tenant';

export async function reportRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // GET /tenants/:tenantId/reports/:auditId — JSON report
  app.get('/:tenantId/reports/:auditId', {
    preHandler: [validateTenantAccess],
  }, reportController.getReport);

  // GET /tenants/:tenantId/reports/:auditId/csv
  app.get('/:tenantId/reports/:auditId/csv', {
    preHandler: [validateTenantAccess],
  }, reportController.exportCSV);

  // GET /tenants/:tenantId/reports/:auditId/pdf
  app.get('/:tenantId/reports/:auditId/pdf', {
    preHandler: [validateTenantAccess],
  }, reportController.exportPDF);
}
