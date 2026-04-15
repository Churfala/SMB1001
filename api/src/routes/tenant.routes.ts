import { FastifyInstance } from 'fastify';
import { tenantController } from '../controllers/tenant.controller';
import { authenticate, requireRole } from '../middleware/authenticate';
import { validateTenantAccess } from '../middleware/tenant';

export async function tenantRoutes(app: FastifyInstance) {
  // All tenant routes require authentication
  app.addHook('preHandler', authenticate);

  // ------------------------------------------------------------------
  // Tenants
  // ------------------------------------------------------------------
  // GET / is open to all authenticated users; the controller filters by role
  app.get('/', tenantController.list);
  app.post('/', { preHandler: [requireRole('admin')] as any }, tenantController.create);
  app.get('/:id', tenantController.getOne);
  app.put('/:id', { preHandler: [requireRole('admin')] as any }, tenantController.update);
  app.delete('/:id', { preHandler: [requireRole('admin')] as any }, tenantController.delete);

  // ------------------------------------------------------------------
  // Users within a tenant
  // ------------------------------------------------------------------
  app.get(
    '/:tenantId/users',
    {
      preHandler: [validateTenantAccess, requireRole('admin', 'auditor')] as any,
    },
    tenantController.listUsers,
  );

  app.post(
    '/:tenantId/users',
    {
      preHandler: [validateTenantAccess, requireRole('admin')] as any,
    },
    tenantController.createUser,
  );

  app.put(
    '/:tenantId/users/:userId',
    {
      preHandler: [validateTenantAccess, requireRole('admin')] as any,
    },
    tenantController.updateUser,
  );

  app.delete(
    '/:tenantId/users/:userId',
    {
      preHandler: [validateTenantAccess, requireRole('admin')] as any,
    },
    tenantController.deleteUser,
  );

  // ------------------------------------------------------------------
  // Per-user tenant access grants
  // ------------------------------------------------------------------
  app.get(
    '/:tenantId/users/:userId/exclusions',
    { preHandler: [validateTenantAccess, requireRole('admin')] as any },
    tenantController.listUserExclusions,
  );

  app.put(
    '/:tenantId/users/:userId/exclusions/:targetTenantId',
    { preHandler: [validateTenantAccess, requireRole('admin')] as any },
    tenantController.excludeTenant,
  );

  app.delete(
    '/:tenantId/users/:userId/exclusions/:targetTenantId',
    { preHandler: [validateTenantAccess, requireRole('admin')] as any },
    tenantController.includeTenant,
  );

  // ------------------------------------------------------------------
  // Integrations
  // ------------------------------------------------------------------
  app.get(
    '/:tenantId/integrations',
    {
      preHandler: [validateTenantAccess] as any,
    },
    tenantController.listIntegrations,
  );

  app.post(
    '/:tenantId/integrations',
    {
      preHandler: [validateTenantAccess, requireRole('admin')] as any,
    },
    tenantController.upsertIntegration,
  );

  app.delete(
    '/:tenantId/integrations/:integrationId',
    {
      preHandler: [validateTenantAccess, requireRole('admin')] as any,
    },
    tenantController.deleteIntegration,
  );

  app.get(
    '/:tenantId/secure-score',
    { preHandler: [validateTenantAccess] as any },
    tenantController.getSecureScore,
  );
}
