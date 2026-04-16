import { FastifyRequest, FastifyReply } from 'fastify';
import { tenantService } from '../services/tenant.service';
import { auditLogService } from '../services/audit-log.service';
import { UserRole } from '../types';

export const tenantController = {
  // ------------------------------------------------------------------
  // Tenants
  // ------------------------------------------------------------------
  async list(request: FastifyRequest, reply: FastifyReply) {
    if (request.user.role === 'admin') {
      const { limit = 50, offset = 0 } = request.query as { limit?: number; offset?: number };
      const result = await tenantService.list(limit, offset);
      return reply.send(result);
    }
    // Non-admin: all tenants except those explicitly excluded for this user
    const tenants = await tenantService.listForUser(request.user.sub);
    return reply.send({ tenants, total: tenants.length });
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
      password?: string;
      role: UserRole;
      firstName?: string;
      lastName?: string;
    };

    if (!email || !role) {
      return reply.status(400).send({ error: 'Bad Request', message: 'email and role are required' });
    }

    if (!['admin', 'auditor', 'readonly'].includes(role)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'role must be admin, auditor, or readonly' });
    }

    if (password && password.length < 12) {
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
  // Per-user tenant access grants
  // ------------------------------------------------------------------
  async listUserExclusions(request: FastifyRequest, reply: FastifyReply) {
    const { userId } = request.params as { userId: string };
    const exclusions = await tenantService.listUserExclusions(userId);
    return reply.send({ exclusions });
  },

  async excludeTenant(request: FastifyRequest, reply: FastifyReply) {
    const { userId, targetTenantId } = request.params as { userId: string; targetTenantId: string };
    await tenantService.excludeTenant(userId, targetTenantId, request.user.sub);
    await auditLogService.log({
      tenantId: request.user.tenant_id,
      userId: request.user.sub,
      action: 'user.tenant_access.excluded',
      resourceType: 'user',
      resourceId: userId,
      details: { target_tenant_id: targetTenantId },
    });
    return reply.status(204).send();
  },

  async includeTenant(request: FastifyRequest, reply: FastifyReply) {
    const { userId, targetTenantId } = request.params as { userId: string; targetTenantId: string };
    await tenantService.includeTenant(userId, targetTenantId);
    await auditLogService.log({
      tenantId: request.user.tenant_id,
      userId: request.user.sub,
      action: 'user.tenant_access.included',
      resourceType: 'user',
      resourceId: userId,
      details: { target_tenant_id: targetTenantId },
    });
    return reply.status(204).send();
  },

};
