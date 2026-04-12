import { FastifyInstance } from 'fastify';
import { auditController } from '../controllers/audit.controller';
import { authenticate, requireRole } from '../middleware/authenticate';
import { validateTenantAccess } from '../middleware/tenant';

export async function auditRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // ------------------------------------------------------------------
  // Audits
  // ------------------------------------------------------------------
  app.get('/:tenantId/audits', {
    preHandler: [validateTenantAccess],
  }, auditController.list);

  app.post('/:tenantId/audits', {
    preHandler: [validateTenantAccess, requireRole('admin', 'auditor')],
  }, auditController.create);

  app.get('/:tenantId/audits/:auditId', {
    preHandler: [validateTenantAccess],
  }, auditController.getOne);

  app.get('/:tenantId/audits/:auditId/progress', {
    preHandler: [validateTenantAccess],
  }, auditController.getProgress);

  app.post('/:tenantId/audits/:auditId/run', {
    preHandler: [validateTenantAccess, requireRole('admin', 'auditor')],
  }, auditController.run);

  app.post('/:tenantId/audits/:auditId/finalise', {
    preHandler: [validateTenantAccess, requireRole('admin', 'auditor')],
  }, auditController.finalise);

  app.post('/:tenantId/audits/:auditId/cancel', {
    preHandler: [validateTenantAccess, requireRole('admin', 'auditor')],
  }, auditController.cancel);

  // ------------------------------------------------------------------
  // Results
  // ------------------------------------------------------------------
  app.put('/:tenantId/audits/:auditId/results/:controlId', {
    preHandler: [validateTenantAccess, requireRole('admin', 'auditor')],
  }, auditController.updateResult);

  // ------------------------------------------------------------------
  // Evidence
  // ------------------------------------------------------------------
  app.get('/:tenantId/audits/:auditId/results/:controlId/evidence', {
    preHandler: [validateTenantAccess],
  }, auditController.listEvidence);

  app.post('/:tenantId/audits/:auditId/results/:controlId/evidence/text', {
    preHandler: [validateTenantAccess, requireRole('admin', 'auditor')],
  }, auditController.addTextEvidence);

  app.post('/:tenantId/audits/:auditId/results/:controlId/evidence/file', {
    preHandler: [validateTenantAccess, requireRole('admin', 'auditor')],
  }, auditController.uploadFileEvidence);

  // ------------------------------------------------------------------
  // Schedules
  // ------------------------------------------------------------------
  app.get('/:tenantId/schedules', {
    preHandler: [validateTenantAccess],
  }, auditController.listSchedules);

  app.post('/:tenantId/schedules', {
    preHandler: [validateTenantAccess, requireRole('admin')],
  }, auditController.createSchedule);

  app.put('/:tenantId/schedules/:scheduleId', {
    preHandler: [validateTenantAccess, requireRole('admin')],
  }, auditController.updateSchedule);

  app.delete('/:tenantId/schedules/:scheduleId', {
    preHandler: [validateTenantAccess, requireRole('admin')],
  }, auditController.deleteSchedule);
}
