import { FastifyRequest, FastifyReply } from 'fastify';
import { tenantService } from '../services/tenant.service';
import { integrationService } from '../services/integration.service';
import { auditLogService } from '../services/audit-log.service';
import { UserRole, IntegrationType } from '../types';

export const tenantController = {
  // ------------------------------------------------------------------
  // Tenants
  // ------------------------------------------------------------------
  async list(request: FastifyRequest, reply: FastifyReply) {
    const { limit = 50, offset = 0 } = request.query as { limit?: number; offset?: number };
    const result = await tenantService.list(limit, offset);
    return reply.send(result);
  },

  async getOne(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const tenant = await tenantService.getById(id);
    if (!tenant) return reply.status(404).send({ error: 'Tenant not found' });
    return reply.send(tenant);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const { name, slug } = request.body as { name: string; slug: string };
    if (!name || !slug) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name and slug are required' });
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'slug must be lowercase alphanumeric with hyphens only' });
    }

    try {
      const tenant = await tenantService.create(name, slug);
      await auditLogService.log({
        tenantId: request.user.tenant_id,
        userId: request.user.sub,
        action: 'tenant.created',
        resourceType: 'tenant',
        resourceId: tenant.id,
        details: { name, slug },
      });
      return reply.status(201).send(tenant);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create tenant';
      return reply.status(400).send({ error: 'Bad Request', message });
    }
  },

  async update(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };
    const body = request.body as { name?: string; status?: string; settings?: Record<string, unknown> };

    try {
      const tenant = await tenantService.update(id, body);
      await auditLogService.log({
        tenantId: request.user.tenant_id,
        userId: request.user.sub,
        action: 'tenant.updated',
        resourceType: 'tenant',
        resourceId: id,
      });
      return reply.send(tenant);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update tenant';
      return reply.status(400).send({ error: 'Bad Request', message });
    }
  },

  async delete(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    // Prevent admins from deleting the tenant their own account belongs to
    if (id === request.user.tenant_id) {
      return reply.status(400).send({ error: 'Bad Request', message: 'You cannot delete the tenant your account belongs to' });
    }

    try {
      await tenantService.delete(id);
      await auditLogService.log({
        tenantId: request.user.tenant_id,
        userId: request.user.sub,
        action: 'tenant.deleted',
        resourceType: 'tenant',
        resourceId: id,
      });
      return reply.status(204).send();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete tenant';
      return reply.status(400).send({ error: 'Bad Request', message });
    }
  },

  // ------------------------------------------------------------------
  // Users within a tenant
  // ------------------------------------------------------------------
  async listUsers(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId } = request.params as { tenantId: string };
    const users = await tenantService.listUsers(tenantId);
    return reply.send({ users });
  },

  async createUser(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId } = request.params as { tenantId: string };
    const { email, password, role, firstName, lastName } = request.body as {
      email: string;
      password: string;
      role: UserRole;
      firstName?: string;
      lastName?: string;
    };

    if (!email || !password || !role) {
      return reply.status(400).send({ error: 'Bad Request', message: 'email, password, and role are required' });
    }

    if (!['admin', 'auditor', 'readonly'].includes(role)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'role must be admin, auditor, or readonly' });
    }

    if (password.length < 12) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Password must be at least 12 characters' });
    }

    try {
      const user = await tenantService.createUser(tenantId, { email, password, role, firstName, lastName });
      await auditLogService.log({
        tenantId,
        userId: request.user.sub,
        action: 'user.created',
        resourceType: 'user',
        resourceId: user.id,
        details: { email, role },
      });
      return reply.status(201).send(user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create user';
      return reply.status(400).send({ error: 'Bad Request', message });
    }
  },

  async updateUser(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, userId } = request.params as { tenantId: string; userId: string };
    const body = request.body as {
      role?: UserRole;
      firstName?: string;
      lastName?: string;
      isActive?: boolean;
      password?: string;
    };

    try {
      const user = await tenantService.updateUser(tenantId, userId, body);
      await auditLogService.log({
        tenantId,
        userId: request.user.sub,
        action: 'user.updated',
        resourceType: 'user',
        resourceId: userId,
      });
      return reply.send(user);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update user';
      return reply.status(400).send({ error: 'Bad Request', message });
    }
  },

  async deleteUser(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, userId } = request.params as { tenantId: string; userId: string };

    // Prevent self-deletion
    if (userId === request.user.sub) {
      return reply.status(400).send({ error: 'Bad Request', message: 'You cannot delete your own account' });
    }

    try {
      await tenantService.deleteUser(tenantId, userId);
      await auditLogService.log({
        tenantId,
        userId: request.user.sub,
        action: 'user.deleted',
        resourceType: 'user',
        resourceId: userId,
      });
      return reply.status(204).send();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to delete user';
      return reply.status(400).send({ error: 'Bad Request', message });
    }
  },

  // ------------------------------------------------------------------
  // Integrations
  // ------------------------------------------------------------------
  async listIntegrations(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId } = request.params as { tenantId: string };
    const integrations = await integrationService.getIntegrations(tenantId);
    return reply.send({ integrations });
  },

  async upsertIntegration(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId } = request.params as { tenantId: string };
    const { type, client_id, client_secret, access_token, refresh_token, token_expires_at, scopes, metadata } =
      request.body as {
        type: IntegrationType;
        client_id: string;
        client_secret?: string;
        access_token?: string;
        refresh_token?: string;
        token_expires_at?: string;
        scopes?: string[];
        metadata?: Record<string, unknown>;
      };

    if (!type || !client_id) {
      return reply.status(400).send({ error: 'Bad Request', message: 'type and client_id are required' });
    }

    if (!['m365', 'google'].includes(type)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'type must be m365 or google' });
    }

    try {
      const integration = await integrationService.upsert(tenantId, type, {
        client_id,
        client_secret,
        access_token,
        refresh_token,
        token_expires_at: token_expires_at ? new Date(token_expires_at) : undefined,
        scopes,
        metadata,
      });
      await auditLogService.log({
        tenantId,
        userId: request.user.sub,
        action: 'integration.upserted',
        resourceType: 'integration',
        resourceId: integration.id,
        details: { type },
      });
      return reply.status(201).send(integration);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save integration';
      return reply.status(400).send({ error: 'Bad Request', message });
    }
  },

  async deleteIntegration(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, integrationId } = request.params as { tenantId: string; integrationId: string };

    await integrationService.delete(tenantId, integrationId);
    await auditLogService.log({
      tenantId,
      userId: request.user.sub,
      action: 'integration.deleted',
      resourceType: 'integration',
      resourceId: integrationId,
    });
    return reply.status(204).send();
  },

  async getSecureScore(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId } = request.params as { tenantId: string };
    try {
      const score = await integrationService.getM365SecureScore(tenantId);
      if (!score) return reply.status(404).send({ error: 'Not Found', message: 'No M365 integration or score unavailable' });
      return reply.send(score);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch Secure Score';
      return reply.status(502).send({ error: 'Bad Gateway', message });
    }
  },
};
