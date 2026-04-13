import { FastifyInstance } from 'fastify';
import { settingsController } from '../controllers/settings.controller';
import { authenticate, requireRole } from '../middleware/authenticate';

export async function settingsRoutes(app: FastifyInstance) {
  // Public — login page uses this to show provider name/button
  app.get('/sso/public', settingsController.getSsoPublic);

  // Admin only
  app.get('/sso', { preHandler: [authenticate, requireRole('admin')] }, settingsController.getSso);
  app.put('/sso', { preHandler: [authenticate, requireRole('admin')] }, settingsController.updateSso);
}
