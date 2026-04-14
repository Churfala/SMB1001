import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { redis } from './config/redis';
import { query, queryOne } from './config/database';
import { processAuditJob } from './processors/audit.processor';
import { startScheduler } from './processors/scheduler.processor';
import { emailService } from './services/email.service';
import { env } from './config/env';
import pino from 'pino';

const logger = pino({ level: env.LOG_LEVEL });

logger.info({ concurrency: env.WORKER_CONCURRENCY, env: env.NODE_ENV }, 'Initialising SMB1001 worker');

const auditWorker = new Worker('audit_run', processAuditJob, {
  connection: redis,
  concurrency: env.WORKER_CONCURRENCY,
  removeOnComplete: { age: 7 * 24 * 3600, count: 500 },
  removeOnFail: { age: 30 * 24 * 3600 },
});

auditWorker.on('completed', (job: Job, result: unknown) => {
  logger.info({ jobId: job.id, result }, 'Job completed');

  // Fire-and-forget: send audit completion email to all active auditor+ users
  const { auditId, tenantId } = job.data as { auditId: string; tenantId: string };
  void (async () => {
    try {
      const [audit, tenant, users] = await Promise.all([
        queryOne<{ name: string; score: number; summary: Record<string, unknown> }>(
          'SELECT name, score, summary FROM audits WHERE id = $1', [auditId],
        ),
        queryOne<{ name: string }>('SELECT name FROM tenants WHERE id = $1', [tenantId]),
        query<{ email: string }>(`SELECT email FROM users WHERE tenant_id = $1 AND is_active = true AND role != 'readonly'`, [tenantId]),
      ]);
      if (!audit || !tenant || users.length === 0) return;
      await emailService.sendAuditComplete({
        to: users.map((u) => u.email),
        tenantName: tenant.name,
        auditName: audit.name,
        score: audit.score ?? 0,
        tiers: ((audit.summary as Record<string, unknown>)?.tiers ?? {}) as Record<string, boolean>,
      });
    } catch (err) {
      logger.error({ err: err instanceof Error ? err.message : err }, 'Failed to send post-audit email');
    }
  })();
});

auditWorker.on('failed', (job: Job | undefined, err: Error) => {
  logger.error({ jobId: job?.id, err: err.message }, 'Job failed');
});

auditWorker.on('progress', (job: Job, progress: any) => {
  logger.debug({ jobId: job.id, progress }, 'Job progress');
});

auditWorker.on('error', (err: Error) => {
  logger.error({ err: err.message }, 'Worker error');
});

auditWorker.on('stalled', (jobId: string) => {
  logger.warn({ jobId }, 'Job stalled — will retry');
});

startScheduler();
logger.info('Worker ready');

async function shutdown(sig: string): Promise<void> {
  logger.info({ sig }, 'Shutdown signal received');
  await auditWorker.close();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
