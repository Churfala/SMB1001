import { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.routes';
import { tenantRoutes } from './tenant.routes';
import { auditRoutes } from './audit.routes';
import { assessmentRoutes } from './assessment.routes';
import { controlRoutes } from './control.routes';
import { reportRoutes } from './report.routes';
import { settingsRoutes } from './settings.routes';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(tenantRoutes, { prefix: '/tenants' });
  // Audit, assessment, and report routes are registered under /tenants prefix too
  await app.register(auditRoutes, { prefix: '/tenants' });
  await app.register(assessmentRoutes, { prefix: '/tenants' });
  await app.register(reportRoutes, { prefix: '/tenants' });
  await app.register(controlRoutes, { prefix: '/controls' });
  await app.register(settingsRoutes, { prefix: '/settings' });
}
