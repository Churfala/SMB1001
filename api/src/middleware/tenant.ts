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

  // Non-admin: check home tenant shortcut OR an explicit grant in user_tenant_access
  const access = await queryOne<{ ok: boolean }>(
    `SELECT TRUE AS ok
     FROM tenants t
     WHERE t.id = $1
       AND t.status != 'suspended'
       AND (
         t.id = $2
         OR EXISTS (
           SELECT 1 FROM user_tenant_access
           WHERE user_id = $3 AND tenant_id = t.id
         )
       )`,
    [tenantId, user.tenant_id, user.sub],
  );

  if (!access) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'You do not have access to this tenant',
    });
  }
}
