import { FastifyInstance } from 'fastify';
import { settingsController } from '../controllers/settings.controller';
import { authenticate, requireRole } from '../middleware/authenticate';

export async function settingsRoutes(app: FastifyInstance) {
  // Public — login page uses this to show provider name/button
  app.get('/sso/public', settingsController.getSsoPublic);

  // Admin only — SSO
  app.get('/sso',  { preHandler: [authenticate, requireRole('admin')] }, settingsController.getSso);
  app.put('/sso',  { preHandler: [authenticate, requireRole('admin')] }, settingsController.updateSso);

  // Admin only — SMTP
  app.get('/smtp',       { preHandler: [authenticate, requireRole('admin')] }, settingsController.getSmtp);
  app.put('/smtp',       { preHandler: [authenticate, requireRole('admin')] }, settingsController.updateSmtp);
  app.post('/smtp/test', { preHandler: [authenticate, requireRole('admin')] }, settingsController.testSmtpConnection);
}
