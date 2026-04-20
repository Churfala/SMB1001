import { FastifyInstance } from 'fastify';
import { authRoutes } from './auth.routes';
import { tenantRoutes } from './tenant.routes';
import { assessmentRoutes } from './assessment.routes';
import { controlRoutes } from './control.routes';
import { frameworkRoutes } from './framework.routes';
import { settingsRoutes } from './settings.routes';

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(tenantRoutes, { prefix: '/tenants' });
  await app.register(assessmentRoutes, { prefix: '/tenants' });
  await app.register(controlRoutes, { prefix: '/controls' });
  await app.register(frameworkRoutes, { prefix: '/frameworks' });
  await app.register(settingsRoutes, { prefix: '/settings' });
}
