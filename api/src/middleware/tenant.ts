import { FastifyRequest, FastifyReply } from 'fastify';
import { queryOne } from '../config/database';

/**
 * Ensure the requesting user belongs to the :tenantId in the URL.
 * Admins may access any tenant; auditors and read-only users are
 * restricted to their own tenant.
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

  // Non-admin users may only access their own tenant
  if (user.role !== 'admin' && user.tenant_id !== tenantId) {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'You do not have access to this tenant',
    });
  }

  // Verify the tenant exists and is active
  const tenant = await queryOne(
    'SELECT id FROM tenants WHERE id = $1 AND status != $2',
    [tenantId, 'suspended'],
  );

  if (!tenant) {
    return reply.status(404).send({ error: 'Not Found', message: 'Tenant not found' });
  }
}
