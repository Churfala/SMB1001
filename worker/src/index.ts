import 'dotenv/config';
import { Worker, Job } from 'bullmq';
import { redis } from './config/redis';
import { processAuditJob } from './processors/audit.processor';
import { startScheduler } from './processors/scheduler.processor';
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
