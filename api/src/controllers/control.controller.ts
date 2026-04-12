import { FastifyRequest, FastifyReply } from 'fastify';
import { query, queryOne } from '../config/database';
import { Control } from '../types';

export const controlController = {
  async list(request: FastifyRequest, reply: FastifyReply) {
    const { category, severity, validationType, limit = 100, offset = 0 } = request.query as {
      category?: string;
      severity?: string;
      validationType?: string;
      limit?: number;
      offset?: number;
    };

    const conditions: string[] = ['is_active = true'];
    const values: unknown[] = [];
    let i = 1;

    if (category) { conditions.push(`category = $${i++}`); values.push(category); }
    if (severity) { conditions.push(`severity = $${i++}`); values.push(severity); }
    if (validationType) { conditions.push(`validation_type = $${i++}`); values.push(validationType); }

    const where = conditions.join(' AND ');
    values.push(Number(limit), Number(offset));

    const controls = await query<Control>(
      `SELECT * FROM controls WHERE ${where}
       ORDER BY CASE severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2
                              WHEN 'medium' THEN 3   WHEN 'low' THEN 4 ELSE 5 END,
                category, control_id
       LIMIT $${i++} OFFSET $${i}`,
      values,
    );

    const countValues: unknown[] = [];
    let ci = 1;
    const countConditions: string[] = ['is_active = true'];
    if (category) { countConditions.push(`category = $${ci++}`); countValues.push(category); }
    if (severity) { countConditions.push(`severity = $${ci++}`); countValues.push(severity); }
    if (validationType) { countConditions.push(`validation_type = $${ci++}`); countValues.push(validationType); }

    const countRow = await queryOne<{ count: string }>(
      `SELECT COUNT(*)::text FROM controls WHERE ${countConditions.join(' AND ')}`,
      countValues,
    );

    // Return distinct categories for filtering
    const categories = await query<{ category: string }>(
      'SELECT DISTINCT category FROM controls WHERE is_active = true ORDER BY category',
    );

    return reply.send({
      controls,
      total: parseInt(countRow?.count ?? '0', 10),
      categories: categories.map((c) => c.category),
    });
  },

  async getOne(request: FastifyRequest, reply: FastifyReply) {
    const { id } = request.params as { id: string };

    // Accept either UUID or control_id string (e.g. "IAM-001")
    const isUUID = /^[0-9a-f-]{36}$/.test(id);
    const control = isUUID
      ? await queryOne<Control>('SELECT * FROM controls WHERE id = $1', [id])
      : await queryOne<Control>('SELECT * FROM controls WHERE control_id = $1', [id]);

    if (!control) return reply.status(404).send({ error: 'Control not found' });
    return reply.send(control);
  },
};
