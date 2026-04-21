import { FastifyRequest, FastifyReply } from 'fastify';
import { query, queryOne } from '../config/database';

export const auditLogController = {

  // GET /tenants/:tenantId/audit-logs
  async list(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId } = request.params as { tenantId: string };
    const { action, limit = '50', offset = '0' } = request.query as {
      action?: string;
      limit?: string;
      offset?: string;
    };

    const lim = Math.min(parseInt(limit, 10) || 50, 200);
    const off = parseInt(offset, 10) || 0;

    const conditions: string[] = ['al.tenant_id = $1'];
    const values: unknown[] = [tenantId];
    let i = 2;

    if (action) {
      conditions.push(`al.action ILIKE $${i++}`);
      values.push(`%${action}%`);
    }

    const where = conditions.join(' AND ');

    const [logs, countRow] = await Promise.all([
      query(
        `SELECT al.id, al.action, al.resource_type, al.resource_id, al.details,
                al.ip_address, al.user_agent, al.created_at,
                u.email                                                AS user_email,
                COALESCE(u.first_name || ' ' || u.last_name, u.email) AS user_name
         FROM audit_logs al
         LEFT JOIN users u ON u.id = al.user_id
         WHERE ${where}
         ORDER BY al.created_at DESC
         LIMIT $${i++} OFFSET $${i}`,
        [...values, lim, off],
      ),
      queryOne<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM audit_logs al WHERE ${where}`,
        values,
      ),
    ]);

    return reply.send({ logs, total: parseInt(countRow?.count ?? '0', 10) });
  },
};
