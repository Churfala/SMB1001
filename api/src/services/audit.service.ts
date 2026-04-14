import { Queue } from 'bullmq';
import { query, queryOne } from '../config/database';
import { redis } from '../config/redis';
import { Audit, AuditResult, Control, ResultStatus, AuditSchedule } from '../types';

const auditQueue = new Queue('audit_run', { connection: redis });

const SEVERITY_WEIGHTS: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export const auditService = {
  // ---------------------------------------------------------------
  // Audits
  // ---------------------------------------------------------------
  async list(tenantId: string, limit = 20, offset = 0): Promise<{ audits: Audit[]; total: number }> {
    const [audits, countRow] = await Promise.all([
      query<Audit>(
        'SELECT * FROM audits WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
        [tenantId, limit, offset],
      ),
      queryOne<{ count: string }>('SELECT COUNT(*)::text FROM audits WHERE tenant_id = $1', [tenantId]),
    ]);
    return { audits, total: parseInt(countRow?.count ?? '0', 10) };
  },

  async create(tenantId: string, name: string, userId: string): Promise<Audit> {
    const audit = await queryOne<Audit>(
      'INSERT INTO audits (tenant_id, name, status, created_by) VALUES ($1, $2, $3, $4) RETURNING *',
      [tenantId, name, 'pending', userId],
    );
    if (!audit) throw new Error('Failed to create audit');
    return audit;
  },

  async getById(auditId: string, tenantId: string): Promise<Audit | null> {
    return queryOne<Audit>('SELECT * FROM audits WHERE id = $1 AND tenant_id = $2', [auditId, tenantId]);
  },

  async getWithResults(auditId: string, tenantId: string) {
    const audit = await this.getById(auditId, tenantId);
    if (!audit) return null;

    const results = await query(
      `SELECT ar.*,
              c.control_id AS control_code,
              c.name       AS control_name,
              c.category,
              c.severity,
              c.tier,
              c.description,
              c.remediation_guidance,
              c.evidence_requirements,
              c.validation_type,
              c.integration_type,
              u.first_name || ' ' || u.last_name AS reviewer_name
       FROM audit_results ar
       JOIN controls c ON c.id = ar.control_id
       LEFT JOIN users u ON u.id = ar.reviewed_by
       WHERE ar.audit_id = $1
       ORDER BY
         SPLIT_PART(c.control_id, '.', 1)::INTEGER,
         SPLIT_PART(c.control_id, '.', 2)::INTEGER`,
      [auditId],
    );

    const evidence = await query(
      'SELECT * FROM evidence WHERE audit_id = $1 ORDER BY created_at DESC',
      [auditId],
    );

    return { ...audit, results, evidence };
  },

  async queueRun(auditId: string, tenantId: string): Promise<string> {
    const job = await auditQueue.add(
      'run-audit',
      { auditId, tenantId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { age: 7 * 24 * 3600, count: 200 },
        removeOnFail: { age: 30 * 24 * 3600 },
      },
    );
    await query(
      'UPDATE audits SET status = $1, job_id = $2, updated_at = NOW() WHERE id = $3',
      ['queued', job.id, auditId],
    );
    return job.id!;
  },

  async getJobProgress(jobId: string): Promise<{ progress: number; state: string } | null> {
    const job = await auditQueue.getJob(jobId);
    if (!job) return null;
    const state = await job.getState();
    return { progress: job.progress as number ?? 0, state };
  },

  async updateResult(
    auditId: string,
    controlId: string,
    tenantId: string,
    updates: { status?: ResultStatus; notes?: string },
    userId: string,
  ): Promise<AuditResult | null> {
    return queryOne<AuditResult>(
      `UPDATE audit_results
       SET status      = COALESCE($1, status),
           notes       = COALESCE($2, notes),
           reviewed_by = $3,
           reviewed_at = NOW(),
           updated_at  = NOW()
       WHERE audit_id = $4 AND control_id = $5 AND tenant_id = $6
       RETURNING *`,
      [updates.status ?? null, updates.notes ?? null, userId, auditId, controlId, tenantId],
    );
  },

  async finalise(auditId: string, tenantId: string): Promise<Audit> {
    const [results, controls] = await Promise.all([
      query<AuditResult>('SELECT * FROM audit_results WHERE audit_id = $1', [auditId]),
      query<Control>('SELECT * FROM controls WHERE is_active = true'),
    ]);

    const controlMap = new Map(controls.map((c) => [c.id, c]));
    let totalWeight = 0;
    let earnedWeight = 0;
    const summary: Record<string, number> = { pass: 0, fail: 0, partial: 0, not_applicable: 0, manual_review: 0 };

    for (const result of results) {
      const control = controlMap.get(result.control_id);
      const weight = SEVERITY_WEIGHTS[control?.severity ?? 'low'] ?? 1;
      summary[result.status] = (summary[result.status] ?? 0) + 1;

      if (result.status !== 'not_applicable' && result.status !== 'manual_review') {
        totalWeight += weight;
        if (result.status === 'pass') earnedWeight += weight;
        else if (result.status === 'partial') earnedWeight += weight * 0.5;
      }
    }

    const score = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 10000) / 100 : 0;

    const audit = await queryOne<Audit>(
      `UPDATE audits
       SET status = 'completed', completed_at = NOW(), score = $1, summary = $2, updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4
       RETURNING *`,
      [score, JSON.stringify(summary), auditId, tenantId],
    );
    if (!audit) throw new Error('Audit not found');
    return audit;
  },

  async cancel(auditId: string, tenantId: string): Promise<void> {
    const audit = await this.getById(auditId, tenantId);
    if (!audit) throw new Error('Audit not found');
    if (!['pending', 'queued'].includes(audit.status)) {
      throw new Error('Only pending or queued audits can be cancelled');
    }
    await query(
      'UPDATE audits SET status = $1, updated_at = NOW() WHERE id = $2',
      ['cancelled', auditId],
    );
    if (audit.job_id) {
      const job = await auditQueue.getJob(audit.job_id);
      await job?.remove().catch(() => {});
    }
  },

  // ---------------------------------------------------------------
  // Evidence
  // ---------------------------------------------------------------
  async listEvidence(auditId: string, controlId: string) {
    return query(
      `SELECT e.*, u.email as uploader_email, u.first_name || ' ' || u.last_name as uploader_name
       FROM evidence e
       JOIN users u ON u.id = e.uploaded_by
       WHERE e.audit_id = $1 AND e.control_id = $2
       ORDER BY e.created_at DESC`,
      [auditId, controlId],
    );
  },

  async addTextEvidence(data: {
    auditId: string;
    auditResultId: string;
    tenantId: string;
    controlId: string;
    content: string;
    uploadedBy: string;
  }) {
    return queryOne(
      `INSERT INTO evidence (audit_result_id, audit_id, tenant_id, control_id, type, content, uploaded_by)
       VALUES ($1, $2, $3, $4, 'text', $5, $6) RETURNING *`,
      [data.auditResultId, data.auditId, data.tenantId, data.controlId, data.content, data.uploadedBy],
    );
  },

  async addFileEvidence(data: {
    auditId: string;
    auditResultId: string;
    tenantId: string;
    controlId: string;
    filePath: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    uploadedBy: string;
  }) {
    return queryOne(
      `INSERT INTO evidence
         (audit_result_id, audit_id, tenant_id, control_id, type, file_path, file_name, file_size, mime_type, uploaded_by)
       VALUES ($1, $2, $3, $4, 'file', $5, $6, $7, $8, $9) RETURNING *`,
      [data.auditResultId, data.auditId, data.tenantId, data.controlId,
       data.filePath, data.fileName, data.fileSize, data.mimeType, data.uploadedBy],
    );
  },

  // ---------------------------------------------------------------
  // Schedules
  // ---------------------------------------------------------------
  async listSchedules(tenantId: string): Promise<AuditSchedule[]> {
    return query<AuditSchedule>(
      'SELECT * FROM audit_schedules WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId],
    );
  },

  async createSchedule(tenantId: string, data: {
    name: string;
    cronExpression: string;
    createdBy: string;
  }): Promise<AuditSchedule> {
    const schedule = await queryOne<AuditSchedule>(
      `INSERT INTO audit_schedules (tenant_id, name, cron_expression, is_active, created_by)
       VALUES ($1, $2, $3, true, $4) RETURNING *`,
      [tenantId, data.name, data.cronExpression, data.createdBy],
    );
    if (!schedule) throw new Error('Failed to create schedule');
    return schedule;
  },

  async updateSchedule(tenantId: string, scheduleId: string, updates: {
    name?: string;
    cronExpression?: string;
    isActive?: boolean;
  }): Promise<AuditSchedule> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (updates.name !== undefined) { fields.push(`name = $${i++}`); values.push(updates.name); }
    if (updates.cronExpression !== undefined) { fields.push(`cron_expression = $${i++}`); values.push(updates.cronExpression); }
    if (updates.isActive !== undefined) { fields.push(`is_active = $${i++}`); values.push(updates.isActive); }

    if (fields.length === 0) throw new Error('No fields to update');

    values.push(scheduleId, tenantId);
    const schedule = await queryOne<AuditSchedule>(
      `UPDATE audit_schedules SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${i++} AND tenant_id = $${i} RETURNING *`,
      values,
    );
    if (!schedule) throw new Error('Schedule not found');
    return schedule;
  },

  async deleteSchedule(tenantId: string, scheduleId: string): Promise<void> {
    await query('DELETE FROM audit_schedules WHERE id = $1 AND tenant_id = $2', [scheduleId, tenantId]);
  },

  // ---------------------------------------------------------------
  // Run-now + weekly schedule helpers
  // ---------------------------------------------------------------

  /** Create and immediately queue an audit with an auto-generated name. */
  async runNow(tenantId: string, userId: string): Promise<Audit> {
    const date = new Date();
    const name = `Manual Audit — ${date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    const audit = await this.create(tenantId, name, userId);
    await this.queueRun(audit.id, tenantId);
    return this.getById(audit.id, tenantId) as Promise<Audit>;
  },

  /** Enable or disable the weekly (Monday 9am) auto-run for a tenant. */
  async setWeeklySchedule(tenantId: string, enabled: boolean, userId: string): Promise<{ enabled: boolean; next_run: string | null }> {
    if (enabled) {
      const nextMonday = new Date();
      nextMonday.setDate(nextMonday.getDate() + ((8 - nextMonday.getDay()) % 7 || 7));
      nextMonday.setHours(9, 0, 0, 0);

      await query(
        `INSERT INTO audit_schedules (tenant_id, name, cron_expression, is_active, created_by, next_run)
         VALUES ($1, 'Weekly Audit', '0 9 * * 1', true, $2, $3)
         ON CONFLICT (tenant_id) DO UPDATE SET
           is_active = true, next_run = EXCLUDED.next_run, updated_at = NOW()`,
        [tenantId, userId, nextMonday],
      );
      return { enabled: true, next_run: nextMonday.toISOString() };
    } else {
      await query('DELETE FROM audit_schedules WHERE tenant_id = $1', [tenantId]);
      return { enabled: false, next_run: null };
    }
  },

  /** Get the weekly schedule state for a tenant. */
  async getWeeklySchedule(tenantId: string): Promise<{ enabled: boolean; next_run: string | null }> {
    const row = await queryOne<{ is_active: boolean; next_run: string | null }>(
      'SELECT is_active, next_run FROM audit_schedules WHERE tenant_id = $1',
      [tenantId],
    );
    return { enabled: row?.is_active ?? false, next_run: row?.next_run ?? null };
  },
};
