import { FastifyInstance } from 'fastify';
import { tenantController } from '../controllers/tenant.controller';
import { authenticate, requireRole } from '../middleware/authenticate';
import { validateTenantAccess } from '../middleware/tenant';

export async function tenantRoutes(app: FastifyInstance) {
  // All tenant routes require authentication
  app.addHook('preHandler', authenticate);

  // ------------------------------------------------------------------
  // Tenants (admin only for create/list-all)
  // ------------------------------------------------------------------
  app.get('/', { preHandler: [requireRole('admin')] }, tenantController.list);
  app.post('/', { preHandler: [requireRole('admin')] }, tenantController.create);
  app.get('/:id', tenantController.getOne);
  app.put('/:id', { preHandler: [requireRole('admin')] }, tenantController.update);

  // ------------------------------------------------------------------
  // Users within a tenant
  // ------------------------------------------------------------------
  app.get('/:tenantId/users', {
    preHandler: [validateTenantAccess, requireRole('admin', 'auditor')],
  }, tenantController.listUsers);

  app.post('/:tenantId/users', {
    preHandler: [validateTenantAccess, requireRole('admin')],
  }, tenantController.createUser);

  app.put('/:tenantId/users/:userId', {
    preHandler: [validateTenantAccess, requireRole('admin')],
  }, tenantController.updateUser);

  app.delete('/:tenantId/users/:userId', {
    preHandler: [validateTenantAccess, requireRole('admin')],
  }, tenantController.deleteUser);

  // ------------------------------------------------------------------
  // Integrations
  // ------------------------------------------------------------------
  app.get('/:tenantId/integrations', {
    preHandler: [validateTenantAccess],
  }, tenantController.listIntegrations);

  app.post('/:tenantId/integrations', {
    preHandler: [validateTenantAccess, requireRole('admin')],
  }, tenantController.upsertIntegration);

  app.delete('/:tenantId/integrations/:integrationId', {
    preHandler: [validateTenantAccess, requireRole('admin')],
  }, tenantController.deleteIntegration);
}
