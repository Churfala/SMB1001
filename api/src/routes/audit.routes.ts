import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { auditController } from '../controllers/audit.controller';
import { authenticate, requireRole } from '../middleware/authenticate';
import { validateTenantAccess } from '../middleware/tenant';

export async function auditRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  // ------------------------------------------------------------------
  // Audits
  // ------------------------------------------------------------------
  app.get(
    '/:tenantId/audits',
    {
      preHandler: [validateTenantAccess] as any,
    },
    auditController.list,
  );

  app.post(
    '/:tenantId/audits',
    {
      preHandler: [validateTenantAccess, requireRole('admin', 'auditor')] as any,
    },
    auditController.create,
  );

  app.get(
    '/:tenantId/audits/:auditId',
    {
      preHandler: [validateTenantAccess] as any,
    },
    auditController.getOne,
  );

  app.get(
    '/:tenantId/audits/:auditId/progress',
    {
      preHandler: [validateTenantAccess] as any,
    },
    auditController.getProgress,
  );

  app.post(
    '/:tenantId/audits/:auditId/run',
    {
      preHandler: [validateTenantAccess, requireRole('admin', 'auditor')] as any,
    },
    auditController.run,
  );

  app.post(
    '/:tenantId/audits/:auditId/finalise',
    {
      preHandler: [validateTenantAccess, requireRole('admin', 'auditor')] as any,
    },
    auditController.finalise,
  );

  app.post(
    '/:tenantId/audits/:auditId/cancel',
    {
      preHandler: [validateTenantAccess, requireRole('admin', 'auditor')] as any,
    },
    auditController.cancel,
  );

  // ------------------------------------------------------------------
  // Results
  // ------------------------------------------------------------------
  app.put(
    '/:tenantId/audits/:auditId/results/:controlId',
    {
      preHandler: [validateTenantAccess, requireRole('admin', 'auditor')] as any,
    },
    auditController.updateResult,
  );

  // ------------------------------------------------------------------
  // Evidence
  // ------------------------------------------------------------------
  app.get(
    '/:tenantId/audits/:auditId/results/:controlId/evidence',
    {
      preHandler: [validateTenantAccess] as any,
    },
    auditController.listEvidence,
  );

  app.post(
    '/:tenantId/audits/:auditId/results/:controlId/evidence/text',
    {
      preHandler: [validateTenantAccess, requireRole('admin', 'auditor')] as any,
    },
    auditController.addTextEvidence,
  );

  app.post(
    '/:tenantId/audits/:auditId/results/:controlId/evidence/file',
    {
      preHandler: [validateTenantAccess, requireRole('admin', 'auditor')] as any,
    },
    auditController.uploadFileEvidence,
  );

  // ------------------------------------------------------------------
  // Run-now + weekly schedule
  // ------------------------------------------------------------------
  app.post(
    '/:tenantId/audits/run-now',
    { preHandler: [validateTenantAccess, requireRole('admin', 'auditor')] as any },
    auditController.runNow,
  );

  app.get(
    '/:tenantId/weekly-schedule',
    { preHandler: [validateTenantAccess] as any },
    auditController.getWeeklySchedule,
  );

  app.put(
    '/:tenantId/weekly-schedule',
    {
      schema: { body: { type: 'object', required: ['enabled'], properties: { enabled: { type: 'boolean' } } } },
      preHandler: [validateTenantAccess, requireRole('admin')] as any,
    },
    auditController.setWeeklySchedule,
  );

  // ------------------------------------------------------------------
  // Schedules
  // ------------------------------------------------------------------
  app.get(
    '/:tenantId/schedules',
    {
      preHandler: [validateTenantAccess] as any,
    },
    auditController.listSchedules,
  );

  app.post(
    '/:tenantId/schedules',
    {
      preHandler: [validateTenantAccess, requireRole('admin')] as any,
    },
    auditController.createSchedule,
  );

  app.put(
    '/:tenantId/schedules/:scheduleId',
    {
      preHandler: [validateTenantAccess, requireRole('admin')] as any,
    },
    auditController.updateSchedule,
  );

  app.delete(
    '/:tenantId/schedules/:scheduleId',
    {
      preHandler: [validateTenantAccess, requireRole('admin')] as any,
    },
    auditController.deleteSchedule,
  );
}
