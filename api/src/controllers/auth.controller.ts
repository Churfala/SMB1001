import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services/auth.service';
import { auditLogService } from '../services/audit-log.service';
import { queryOne } from '../config/database';

export const authController = {
  async login(request: FastifyRequest, reply: FastifyReply) {
    const { email, password, tenantSlug } = request.body as {
      email: string;
      password: string;
      tenantSlug: string;
    };

    if (!email || !password || !tenantSlug) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'email, password, and tenantSlug are required',
      });
    }

    try {
      const result = await authService.login(email, password, tenantSlug);

      await auditLogService.log({
        tenantId: result.tenant.id,
        userId: result.user.id,
        action: 'user.login',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return reply.send({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
          firstName: result.user.first_name,
          lastName: result.user.last_name,
          tenantId: result.tenant.id,
          tenantName: result.tenant.name,
          tenantSlug: result.tenant.slug,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      await auditLogService.log({
        action: 'user.login.failed',
        details: { email, tenantSlug },
        ipAddress: request.ip,
      });
      return reply.status(401).send({ error: 'Unauthorized', message });
    }
  },

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const { refreshToken } = request.body as { refreshToken: string };

    if (!refreshToken) {
      return reply.status(400).send({ error: 'Bad Request', message: 'refreshToken is required' });
    }

    try {
      const tokens = await authService.refresh(refreshToken);
      return reply.send(tokens);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Token refresh failed';
      return reply.status(401).send({ error: 'Unauthorized', message });
    }
  },

  async me(request: FastifyRequest, reply: FastifyReply) {
    const user = await queryOne(
      `SELECT u.id, u.email, u.role, u.first_name, u.last_name, u.is_active,
              t.id AS tenant_id, t.name AS tenant_name, t.slug AS tenant_slug
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1`,
      [request.user.sub],
    );

    if (!user) return reply.status(404).send({ error: 'User not found' });
    return reply.send(user);
  },

  async changePassword(request: FastifyRequest, reply: FastifyReply) {
    const { currentPassword, newPassword } = request.body as {
      currentPassword: string;
      newPassword: string;
    };

    if (!currentPassword || !newPassword) {
      return reply.status(400).send({ error: 'Bad Request', message: 'currentPassword and newPassword are required' });
    }

    if (newPassword.length < 12) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Password must be at least 12 characters' });
    }

    try {
      await authService.changePassword(request.user.sub, currentPassword, newPassword);
      await auditLogService.log({
        tenantId: request.user.tenant_id,
        userId: request.user.sub,
        action: 'user.password_changed',
      });
      return reply.send({ message: 'Password changed successfully' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Password change failed';
      return reply.status(400).send({ error: 'Bad Request', message });
    }
  },
};
