import { Job } from 'bullmq';
import { query, queryOne } from '../config/database';
import { m365Service, M365Data } from '../services/m365.service';
import { googleService, GoogleData } from '../services/google.service';
import { controlEvaluators, EvaluationResult, ResultStatus } from '../evaluators/control.evaluator';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

interface AuditJobData {
  auditId: string;
  tenantId: string;
}

interface ControlRow {
  id: string;
  control_id: string;
  name: string;
  category: string;
  severity: string;
  validation_type: string;
  integration_type: string;
}

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export async function processAuditJob(
  job: Job<AuditJobData>,
): Promise<{ auditId: string; score: number; summary: Record<string, number> }> {
  const { auditId, tenantId } = job.data;
  logger.info({ auditId, tenantId }, 'Starting audit job');

  await query('UPDATE audits SET status = $1, started_at = NOW(), updated_at = NOW() WHERE id = $2', ['running', auditId]);

  try {
    await job.updateProgress(5);

    const [m365Row, googleRow] = await Promise.all([
      queryOne('SELECT * FROM integrations WHERE tenant_id = $1 AND type = $2 AND status = $3', [tenantId, 'm365', 'connected']),
      queryOne('SELECT * FROM integrations WHERE tenant_id = $1 AND type = $2 AND status = $3', [tenantId, 'google', 'connected']),
    ]);

    let m365Data: M365Data | null = null;
    let googleData: GoogleData | null = null;

    if (m365Row) {
      try {
        logger.info({ auditId }, 'Collecting M365 data');
        m365Data = await m365Service.collectData(m365Row as Parameters<typeof m365Service.collectData>[0]);
        await query('UPDATE integrations SET last_sync = NOW(), status = $1, error_message = NULL WHERE id = $2', ['connected', (m365Row as Record<string, string>).id]);
        logger.info({ auditId, users: m365Data.users.length }, 'M365 data collected');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error({ err: msg, auditId }, 'M365 data collection failed');
        await query('UPDATE integrations SET status = $1, error_message = $2 WHERE id = $3', ['error', msg.slice(0, 500), (m365Row as Record<string, string>).id]);
      }
    }

    await job.updateProgress(35);

    if (googleRow) {
      try {
        logger.info({ auditId }, 'Collecting Google Workspace data');
        googleData = await googleService.collectData(googleRow as Parameters<typeof googleService.collectData>[0]);
        await query('UPDATE integrations SET last_sync = NOW(), status = $1, error_message = NULL WHERE id = $2', ['connected', (googleRow as Record<string, string>).id]);
        logger.info({ auditId, users: googleData.users.length }, 'Google data collected');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        logger.error({ err: msg, auditId }, 'Google data collection failed');
        await query('UPDATE integrations SET status = $1, error_message = $2 WHERE id = $3', ['error', msg.slice(0, 500), (googleRow as Record<string, string>).id]);
      }
    }

    await job.updateProgress(65);

    const controls = await query<ControlRow>('SELECT * FROM controls WHERE is_active = true ORDER BY control_id');
    logger.info({ auditId, controls: controls.length }, 'Evaluating controls');

    const results: Array<{ control_id: string; status: ResultStatus; score: number; rawData: Record<string, unknown>; notes: string }> = [];

    for (let i = 0; i < controls.length; i++) {
      const control = controls[i];
      const evaluator = controlEvaluators.get(control.control_id);
      let evalResult: EvaluationResult;

      if (evaluator) {
        try {
          evalResult = evaluator(m365Data, googleData);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          logger.error({ err: msg, controlId: control.control_id }, 'Control evaluation error');
          evalResult = { status: 'manual_review', score: 0, rawData: { error: msg }, notes: `Evaluation error: ${msg}` };
        }
      } else {
        evalResult = { status: 'manual_review', score: 0, rawData: {}, notes: 'No automated evaluator available' };
      }

      results.push({ control_id: control.id, ...evalResult });
      await job.updateProgress(65 + Math.round(((i + 1) / controls.length) * 25));
    }

    // Persist to audit_results
    for (const result of results) {
      await query(
        `INSERT INTO audit_results (audit_id, tenant_id, control_id, status, score, raw_data, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (audit_id, control_id) DO UPDATE SET
           status = EXCLUDED.status, score = EXCLUDED.score,
           raw_data = EXCLUDED.raw_data, notes = EXCLUDED.notes, updated_at = NOW()`,
        [auditId, tenantId, result.control_id, result.status, result.score, JSON.stringify(result.rawData), result.notes],
      );
    }

    await job.updateProgress(95);

    // Weighted score calculation
    let totalWeight = 0;
    let earnedWeight = 0;
    const summary: Record<string, number> = { pass: 0, fail: 0, partial: 0, not_applicable: 0, manual_review: 0 };

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const weight = SEVERITY_WEIGHTS[controls[i].severity?.toLowerCase()] ?? 1;
      summary[r.status] = (summary[r.status] ?? 0) + 1;
      if (r.status !== 'not_applicable' && r.status !== 'manual_review') {
        totalWeight += weight;
        if (r.status === 'pass') earnedWeight += weight;
        else if (r.status === 'partial') earnedWeight += weight * 0.5;
      }
    }

    const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 10000) / 100 : 0;

    await query(
      `UPDATE audits SET status = 'completed', completed_at = NOW(), score = $1, summary = $2, updated_at = NOW() WHERE id = $3`,
      [score, JSON.stringify(summary), auditId],
    );

    await job.updateProgress(100);
    logger.info({ auditId, score, summary }, 'Audit completed successfully');
    return { auditId, score, summary };

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    logger.error({ err: msg, auditId }, 'Audit job failed');
    await query(
      `UPDATE audits SET status = 'failed', metadata = COALESCE(metadata,'{}') || jsonb_build_object('error',$1::text), updated_at = NOW() WHERE id = $2`,
      [msg, auditId],
    );
    throw err;
  }
}
