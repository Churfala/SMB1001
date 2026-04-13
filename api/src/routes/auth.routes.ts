import { FastifyInstance } from 'fastify';
import { authController } from '../controllers/auth.controller';
import { authenticate } from '../middleware/authenticate';

export async function authRoutes(app: FastifyInstance) {
  // POST /auth/login
  app.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 1 },
        },
      },
    },
  }, authController.login);

  // POST /auth/refresh
  app.post('/refresh', {
    schema: {
      body: {
        type: 'object',
        required: ['refreshToken'],
        properties: {
          refreshToken: { type: 'string' },
        },
      },
    },
  }, authController.refresh);

  // GET /auth/me  (requires auth)
  app.get('/me', { preHandler: [authenticate] }, authController.me);

  // GET /auth/sso  — redirect to configured OIDC provider (redirect flow only)
  app.get('/sso', authController.ssoLogin);

  // GET /auth/sso/callback  — OIDC provider redirects back here
  app.get('/sso/callback', authController.ssoCallback);

  // POST /auth/change-password
  app.post('/change-password', { preHandler: [authenticate] }, authController.changePassword);
}
