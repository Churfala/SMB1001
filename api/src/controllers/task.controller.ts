import { FastifyRequest, FastifyReply } from 'fastify';
import { query, queryOne } from '../config/database';
import { auditLogService } from '../services/audit-log.service';
import { emailService } from '../services/email.service';

// Shared JOIN query for list / get
const TASK_SELECT = `
  SELECT t.*,
         c.control_id                                               AS control_code,
         u.email                                                    AS assigned_to_email,
         COALESCE(u.first_name || ' ' || u.last_name, u.email)     AS assigned_to_name,
         cb.email                                                   AS created_by_email
  FROM tasks t
  LEFT JOIN controls c  ON c.id  = t.control_id
  LEFT JOIN users    u  ON u.id  = t.assigned_to
  LEFT JOIN users    cb ON cb.id = t.created_by
`;

export const taskController = {

  // GET /tenants/:tenantId/tasks
  async list(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId } = request.params as { tenantId: string };
    const { status, priority, assigned_to } = request.query as {
      status?: string;
      priority?: string;
      assigned_to?: string;
    };

    const conditions: string[] = ['t.tenant_id = $1'];
    const values: unknown[] = [tenantId];
    let i = 2;

    if (status)      { conditions.push(`t.status = $${i++}`);       values.push(status); }
    if (priority)    { conditions.push(`t.priority = $${i++}`);     values.push(priority); }
    if (assigned_to) { conditions.push(`t.assigned_to = $${i++}`);  values.push(assigned_to); }

    const tasks = await query(
      `${TASK_SELECT}
       WHERE ${conditions.join(' AND ')}
       ORDER BY
         CASE t.status WHEN 'closed' THEN 2 ELSE 1 END,
         CASE t.priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END,
         t.due_date ASC NULLS LAST,
         t.created_at DESC`,
      values,
    );

    return reply.send({ tasks });
  },

  // GET /tenants/:tenantId/tasks/summary
  async summary(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId } = request.params as { tenantId: string };

    const row = await queryOne<{ open: number; in_progress: number; overdue: number; total: number }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'open')                                          AS open,
         COUNT(*) FILTER (WHERE status = 'in_progress')                                   AS in_progress,
         COUNT(*) FILTER (WHERE status NOT IN ('resolved','closed') AND due_date < CURRENT_DATE) AS overdue,
         COUNT(*) FILTER (WHERE status NOT IN ('resolved','closed'))                       AS total
       FROM tasks
       WHERE tenant_id = $1`,
      [tenantId],
    );

    return reply.send(row ?? { open: 0, in_progress: 0, overdue: 0, total: 0 });
  },

  // POST /tenants/:tenantId/tasks
  async create(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId } = request.params as { tenantId: string };
    const body = request.body as {
      title: string;
      description?: string;
      priority?: string;
      assigned_to?: string | null;
      due_date?: string | null;
      control_id?: string | null;
      control_ref?: string | null;
    };

    if (!body.title?.trim()) {
      return reply.status(400).send({ error: 'Bad Request', message: 'title is required' });
    }

    const task = await queryOne<{ id: string; assigned_to: string | null; title: string }>(
      `INSERT INTO tasks (tenant_id, control_id, control_ref, title, description, priority, assigned_to, due_date, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        tenantId,
        body.control_id   ?? null,
        body.control_ref  ?? null,
        body.title.trim(),
        body.description  ?? null,
        body.priority     ?? 'medium',
        body.assigned_to  ?? null,
        body.due_date     ?? null,
        request.user.sub,
      ],
    );

    auditLogService.log({
      tenantId,
      userId: request.user.sub,
      action: 'task.created',
      resourceType: 'task',
      resourceId: task!.id,
      details: { title: task!.title, priority: body.priority ?? 'medium' },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    // Notify assignee if set
    if (task!.assigned_to) {
      const assignee = await queryOne<{ email: string; first_name: string | null }>(
        'SELECT email, first_name FROM users WHERE id = $1',
        [task!.assigned_to],
      );
      if (assignee) {
        const creator = await queryOne<{ email: string }>(
          'SELECT email FROM users WHERE id = $1',
          [request.user.sub],
        );
        emailService.sendTaskAssigned({
          to: assignee.email,
          assigneeName: assignee.first_name ?? assignee.email,
          taskTitle: task!.title,
          assignedBy: creator?.email ?? 'ControlCheck',
          dueDate: body.due_date ?? null,
        });
      }
    }

    return reply.status(201).send(task);
  },

  // PUT /tenants/:tenantId/tasks/:taskId
  async update(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, taskId } = request.params as { tenantId: string; taskId: string };
    const body = request.body as {
      title?: string;
      description?: string;
      status?: string;
      priority?: string;
      assigned_to?: string | null;
      due_date?: string | null;
      resolution_notes?: string;
    };

    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (body.title            !== undefined) { fields.push(`title = $${i++}`);             values.push(body.title); }
    if (body.description      !== undefined) { fields.push(`description = $${i++}`);       values.push(body.description); }
    if (body.priority         !== undefined) { fields.push(`priority = $${i++}`);          values.push(body.priority); }
    if (body.assigned_to      !== undefined) { fields.push(`assigned_to = $${i++}`);       values.push(body.assigned_to); }
    if (body.due_date         !== undefined) { fields.push(`due_date = $${i++}`);          values.push(body.due_date); }
    if (body.resolution_notes !== undefined) { fields.push(`resolution_notes = $${i++}`);  values.push(body.resolution_notes); }

    if (body.status !== undefined) {
      fields.push(`status = $${i++}`);
      values.push(body.status);
      if (body.status === 'resolved' || body.status === 'closed') {
        fields.push('resolved_at = NOW()');
      }
    }

    if (fields.length === 0) {
      return reply.status(400).send({ error: 'Bad Request', message: 'No fields to update' });
    }

    fields.push('updated_at = NOW()');
    values.push(taskId, tenantId);

    const task = await queryOne(
      `UPDATE tasks SET ${fields.join(', ')}
       WHERE id = $${i++} AND tenant_id = $${i}
       RETURNING *`,
      values,
    );

    if (!task) return reply.status(404).send({ error: 'Not Found', message: 'Task not found' });

    auditLogService.log({
      tenantId,
      userId: request.user.sub,
      action: 'task.updated',
      resourceType: 'task',
      resourceId: taskId,
      details: { changes: Object.keys(body) },
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    // Notify new assignee if assignment changed
    if (body.assigned_to) {
      const [assignee, creator] = await Promise.all([
        queryOne<{ email: string; first_name: string | null }>('SELECT email, first_name FROM users WHERE id = $1', [body.assigned_to]),
        queryOne<{ email: string }>('SELECT email FROM users WHERE id = $1', [request.user.sub]),
      ]);
      if (assignee) {
        emailService.sendTaskAssigned({
          to: assignee.email,
          assigneeName: assignee.first_name ?? assignee.email,
          taskTitle: (task as { title: string }).title,
          assignedBy: creator?.email ?? 'ControlCheck',
          dueDate: body.due_date ?? null,
        });
      }
    }

    return reply.send(task);
  },

  // DELETE /tenants/:tenantId/tasks/:taskId
  async remove(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, taskId } = request.params as { tenantId: string; taskId: string };

    const result = await query('DELETE FROM tasks WHERE id = $1 AND tenant_id = $2', [taskId, tenantId]);

    if ((result as unknown as { rowCount: number }).rowCount === 0) {
      return reply.status(404).send({ error: 'Not Found', message: 'Task not found' });
    }

    auditLogService.log({
      tenantId,
      userId: request.user.sub,
      action: 'task.deleted',
      resourceType: 'task',
      resourceId: taskId,
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'],
    });

    return reply.status(204).send();
  },
};
