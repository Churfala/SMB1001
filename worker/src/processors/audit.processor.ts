import { Job } from 'bullmq';
import { query } from '../config/database';
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
    await job.updateProgress(50);

    const controls = await query<ControlRow>('SELECT * FROM controls WHERE is_active = true ORDER BY control_id');
    logger.info({ auditId, controls: controls.length }, 'Evaluating controls');

    const results: Array<{ control_id: string; status: ResultStatus; score: number; rawData: Record<string, unknown>; notes: string }> = [];

    for (let i = 0; i < controls.length; i++) {
      const control = controls[i];
      const evaluator = controlEvaluators.get(control.control_id);
      let evalResult: EvaluationResult;

      if (evaluator) {
        try {
          evalResult = evaluator();
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          logger.error({ err: msg, controlId: control.control_id }, 'Control evaluation error');
          evalResult = { status: 'manual_review', score: 0, rawData: { error: msg }, notes: `Evaluation error: ${msg}` };
        }
      } else {
        evalResult = { status: 'manual_review', score: 0, rawData: {}, notes: 'No automated evaluator available' };
      }

      results.push({ control_id: control.id, ...evalResult });
      await job.updateProgress(50 + Math.round(((i + 1) / controls.length) * 40));
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
