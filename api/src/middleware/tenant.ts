import { FastifyRequest, FastifyReply } from 'fastify';
import { queryOne } from '../config/database';

/**
 * Ensure the requesting user has access to the :tenantId in the URL.
 * Admins may access any tenant.
 * Non-admins may access their home tenant plus any tenants in user_tenant_access.
 */
export async function validateTenantAccess(
  request: FastifyRequest<{ Params: { tenantId: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const { tenantId } = request.params;
  const user = request.user;

  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized' });
  }

  if (user.role === 'admin') {
    // Admins: just verify tenant exists and is not suspended
    const tenant = await queryOne(
      'SELECT id FROM tenants WHERE id = $1 AND status != $2',
      [tenantId, 'suspended'],
    );
    if (!tenant) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tenant not found' });
    }
    return;
  }

  if (user.role === 'client') {
    // Clients may only access the tenant their account belongs to
    if (tenantId !== user.tenant_id) {
      return reply.status(403).send({ error: 'Forbidden', message: 'You do not have access to this tenant' });
    }
    const tenant = await queryOne(
      'SELECT id FROM tenants WHERE id = $1 AND status != $2',
      [tenantId, 'suspended'],
    );
    if (!tenant) {
      return reply.status(404).send({ error: 'Not Found', message: 'Tenant not found' });
    }
    return;
  }

  // Non-admin/non-client: access any non-suspended tenant UNLESS explicitly excluded
  const access = await queryOne<{ ok: boolean }>(
    `SELECT TRUE AS ok
     FROM tenants t
     WHERE t.id = $1
       AND t.status != 'suspended'
       AND NOT EXISTS (
         SELECT 1 FROM user_tenant_exclusions
         WHERE user_id = $2 AND tenant_id = t.id
       )`,
    [tenantId, user.sub],
  );

  if (!access) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'You do not have access to this tenant',
    });
  }
}
