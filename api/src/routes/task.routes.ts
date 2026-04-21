import { FastifyInstance } from 'fastify';
import { taskController } from '../controllers/task.controller';
import { authenticate, requireRole } from '../middleware/authenticate';
import { validateTenantAccess } from '../middleware/tenant';

export async function taskRoutes(app: FastifyInstance) {
  app.addHook('preHandler', authenticate);

  app.get(
    '/:tenantId/tasks',
    { preHandler: [validateTenantAccess] as any },
    taskController.list,
  );

  app.get(
    '/:tenantId/tasks/summary',
    { preHandler: [validateTenantAccess] as any },
    taskController.summary,
  );

  app.post(
    '/:tenantId/tasks',
    { preHandler: [validateTenantAccess, requireRole('admin', 'auditor')] as any },
    taskController.create,
  );

  app.put(
    '/:tenantId/tasks/:taskId',
    { preHandler: [validateTenantAccess, requireRole('admin', 'auditor')] as any },
    taskController.update,
  );

  app.delete(
    '/:tenantId/tasks/:taskId',
    { preHandler: [validateTenantAccess, requireRole('admin', 'auditor')] as any },
    taskController.remove,
  );
}
