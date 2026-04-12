import cron from 'node-cron';
import { Queue } from 'bullmq';
import { query } from '../config/database';
import { redis } from '../config/redis';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const auditQueue = new Queue('audit:run', { connection: redis });

interface AuditSchedule {
  id: string;
  tenant_id: string;
  name: string;
  cron_expression: string;
  created_by: string;
}

/** Returns the next fire date for common cron patterns. Fallback: +24h. */
function nextRun(expression: string, from: Date = new Date()): Date {
  const intervals: Record<string, number> = {
    '0 0 * * *': 86400,           // daily midnight
    '0 8 * * *': 86400,           // daily 8am
    '0 9 * * 1': 604800,          // weekly Monday 9am
    '0 0 * * 1': 604800,          // weekly Monday midnight
    '0 0 1 * *': 2592000,         // monthly
  };
  const sec = intervals[expression] ?? 86400;
  return new Date(from.getTime() + sec * 1000);
}

export function startScheduler(): void {
  cron.schedule('* * * * *', async () => {
    const now = new Date();
    try {
      const due = await query<AuditSchedule>(
        `SELECT * FROM audit_schedules WHERE is_active = true AND (next_run IS NULL OR next_run <= $1)`,
        [now],
      );

      for (const schedule of due) {
        try {
          const dateStr = now.toISOString().split('T')[0];
          const [audit] = await query<{ id: string }>(
            `INSERT INTO audits (tenant_id, name, status, created_by)
             VALUES ($1, $2, 'queued', $3) RETURNING id`,
            [schedule.tenant_id, `Scheduled: ${schedule.name} — ${dateStr}`, schedule.created_by],
          );

          const job = await auditQueue.add(
            'run-audit',
            { auditId: audit.id, tenantId: schedule.tenant_id },
            { attempts: 3, backoff: { type: 'exponential', delay: 5000 } },
          );

          await query('UPDATE audits SET job_id = $1 WHERE id = $2', [job.id, audit.id]);
          await query(
            'UPDATE audit_schedules SET last_run = $1, next_run = $2 WHERE id = $3',
            [now, nextRun(schedule.cron_expression, now), schedule.id],
          );

          logger.info({ scheduleId: schedule.id, auditId: audit.id, jobId: job.id }, 'Scheduled audit enqueued');
        } catch (err: unknown) {
          logger.error({ err: (err as Error).message, scheduleId: schedule.id }, 'Failed to enqueue scheduled audit');
        }
      }
    } catch (err: unknown) {
      logger.error({ err: (err as Error).message }, 'Scheduler tick error');
    }
  });

  logger.info('Audit scheduler started');
}
