import path from 'path';
import fs from 'fs';
import { FastifyRequest, FastifyReply } from 'fastify';
import { query, queryOne } from '../config/database';
import { env } from '../config/env';

export const assessmentController = {
  // GET /tenants/:tenantId/assessments
  // Returns all controls for the tenant's framework joined with this tenant's assessment data
  async list(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId } = request.params as { tenantId: string };

    const rows = await query<{
      control_db_id: string;
      control_id: string;
      control_name: string;
      category: string;
      tier: number;
      assessment_id: string | null;
      status: string;
      notes: string | null;
      review_date: string | null;
      reviewed_by: string | null;
    }>(
      `SELECT
         c.id              AS control_db_id,
         c.control_id,
         c.name            AS control_name,
         c.category,
         c.tier,
         a.id              AS assessment_id,
         COALESCE(a.status, 'not_assessed') AS status,
         a.notes,
         a.review_date::text,
         a.reviewed_by
       FROM controls c
       JOIN tenants t ON t.id = $1
       LEFT JOIN control_assessments a
         ON a.control_id = c.id AND a.tenant_id = $1
       WHERE c.is_active = true
         AND c.framework_id = COALESCE(t.framework_id, (SELECT id FROM frameworks WHERE code = 'SMB1001:2026'))
       ORDER BY
         SPLIT_PART(c.control_id, '.', 1)::INTEGER,
         SPLIT_PART(c.control_id, '.', 2)::INTEGER`,
      [tenantId],
    );

    return reply.send({ assessments: rows });
  },

  // PUT /tenants/:tenantId/assessments/:controlId
  // Upsert assessment for a control (accepts UUID or control_id string like "1.2")
  async upsert(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, controlId } = request.params as { tenantId: string; controlId: string };
    const body = request.body as {
      status?: string;
      notes?: string;
      review_date?: string | null;
    };

    const isUUID = /^[0-9a-f-]{36}$/.test(controlId);
    const control = await queryOne<{ id: string }>(
      isUUID
        ? 'SELECT id FROM controls WHERE id = $1'
        : `SELECT c.id FROM controls c
           JOIN tenants t ON t.id = $2
           WHERE c.control_id = $1
             AND c.framework_id = COALESCE(t.framework_id, (SELECT id FROM frameworks WHERE code = 'SMB1001:2026'))`,
      isUUID ? [controlId] : [controlId, tenantId],
    );
    if (!control) return reply.status(404).send({ error: 'Not Found', message: 'Control not found' });

    const status = body.status ?? 'not_assessed';
    const notes = body.notes ?? null;
    const reviewDate = body.review_date || null;

    const row = await queryOne(
      `INSERT INTO control_assessments (tenant_id, control_id, status, notes, review_date, reviewed_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tenant_id, control_id) DO UPDATE SET
         status      = EXCLUDED.status,
         notes       = EXCLUDED.notes,
         review_date = EXCLUDED.review_date,
         reviewed_by = EXCLUDED.reviewed_by,
         updated_at  = NOW()
       RETURNING id, tenant_id, control_id, status, notes, review_date::text, reviewed_by, created_at, updated_at`,
      [tenantId, control.id, status, notes, reviewDate, request.user.sub],
    );

    return reply.send(row);
  },

  // GET /tenants/:tenantId/assessments/summary
  async summary(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId } = request.params as { tenantId: string };

    const [row, latestAudit] = await Promise.all([
      queryOne<{
        pass: number; fail: number; partial: number;
        not_applicable: number; not_assessed: number;
        total: number; overdue: number;
        tier1_fail: number; tier2_fail: number; tier3_fail: number;
        tier4_fail: number; tier5_fail: number;
      }>(
        `SELECT
           COUNT(*) FILTER (WHERE COALESCE(a.status, 'not_assessed') = 'pass')            AS pass,
           COUNT(*) FILTER (WHERE COALESCE(a.status, 'not_assessed') = 'fail')            AS fail,
           COUNT(*) FILTER (WHERE COALESCE(a.status, 'not_assessed') = 'partial')         AS partial,
           COUNT(*) FILTER (WHERE COALESCE(a.status, 'not_assessed') = 'not_applicable')  AS not_applicable,
           COUNT(*) FILTER (WHERE a.id IS NULL)                                            AS not_assessed,
           COUNT(*)                                                                         AS total,
           COUNT(*) FILTER (WHERE a.review_date IS NOT NULL AND a.review_date < CURRENT_DATE) AS overdue,
           COUNT(*) FILTER (WHERE c.tier <= 1 AND COALESCE(a.status, 'not_assessed') NOT IN ('pass', 'not_applicable')) AS tier1_fail,
           COUNT(*) FILTER (WHERE c.tier <= 2 AND COALESCE(a.status, 'not_assessed') NOT IN ('pass', 'not_applicable')) AS tier2_fail,
           COUNT(*) FILTER (WHERE c.tier <= 3 AND COALESCE(a.status, 'not_assessed') NOT IN ('pass', 'not_applicable')) AS tier3_fail,
           COUNT(*) FILTER (WHERE c.tier <= 4 AND COALESCE(a.status, 'not_assessed') NOT IN ('pass', 'not_applicable')) AS tier4_fail,
           COUNT(*) FILTER (WHERE c.tier <= 5 AND COALESCE(a.status, 'not_assessed') NOT IN ('pass', 'not_applicable')) AS tier5_fail
         FROM controls c
         JOIN tenants t ON t.id = $1
         LEFT JOIN control_assessments a ON a.control_id = c.id AND a.tenant_id = $1
         WHERE c.is_active = true
           AND c.framework_id = COALESCE(t.framework_id, (SELECT id FROM frameworks WHERE code = 'SMB1001:2026'))`,
        [tenantId],
      ),
      queryOne<{ id: string; score: number | null; summary: Record<string, unknown>; completed_at: string }>(
        `SELECT id, score, summary, completed_at
         FROM audits
         WHERE tenant_id = $1 AND status = 'completed'
         ORDER BY completed_at DESC
         LIMIT 1`,
        [tenantId],
      ),
    ]);

    const base = row ?? { pass: 0, fail: 0, partial: 0, not_applicable: 0, not_assessed: 0, total: 0, overdue: 0, tier1_fail: 1, tier2_fail: 1, tier3_fail: 1, tier4_fail: 1, tier5_fail: 1 };
    const achievedTier = Number(base.total) > 0
      ? ([5, 4, 3, 2, 1].find((n) => Number(base[`tier${n}_fail` as keyof typeof base]) === 0) ?? 0)
      : 0;
    const { tier1_fail: _t1, tier2_fail: _t2, tier3_fail: _t3, tier4_fail: _t4, tier5_fail: _t5, ...summary } = base;
    return reply.send({
      ...summary,
      achieved_tier: achievedTier,
      latest_audit: latestAudit
        ? { id: latestAudit.id, score: latestAudit.score, tiers: latestAudit.summary?.tiers ?? null, completed_at: latestAudit.completed_at }
        : null,
    });
  },

  // GET /tenants/:tenantId/assessments/overdue
  async overdueCount(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId } = request.params as { tenantId: string };
    const row = await queryOne<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM control_assessments a
       JOIN controls c ON c.id = a.control_id
       JOIN tenants t ON t.id = $1
       WHERE a.tenant_id = $1
         AND a.review_date < CURRENT_DATE
         AND c.framework_id = COALESCE(t.framework_id, (SELECT id FROM frameworks WHERE code = 'SMB1001:2026'))`,
      [tenantId],
    );
    return reply.send({ count: row?.count ?? 0 });
  },

  // GET /tenants/:tenantId/assessments/:controlId/evidence
  async listEvidence(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, controlId } = request.params as { tenantId: string; controlId: string };

    const isUUID = /^[0-9a-f-]{36}$/.test(controlId);
    const control = await queryOne<{ id: string }>(
      isUUID
        ? 'SELECT id FROM controls WHERE id = $1'
        : `SELECT c.id FROM controls c
           JOIN tenants t ON t.id = $2
           WHERE c.control_id = $1
             AND c.framework_id = COALESCE(t.framework_id, (SELECT id FROM frameworks WHERE code = 'SMB1001:2026'))`,
      isUUID ? [controlId] : [controlId, tenantId],
    );
    if (!control) return reply.status(404).send({ error: 'Not Found', message: 'Control not found' });

    const assessment = await queryOne<{ id: string }>(
      'SELECT id FROM control_assessments WHERE tenant_id = $1 AND control_id = $2',
      [tenantId, control.id],
    );

    if (!assessment) return reply.send({ evidence: [] });

    const evidence = await query(
      `SELECT ae.*,
              u.email                                           AS uploader_email,
              COALESCE(u.first_name || ' ' || u.last_name, u.email) AS uploader_name
       FROM assessment_evidence ae
       JOIN users u ON u.id = ae.uploaded_by
       WHERE ae.assessment_id = $1
       ORDER BY ae.created_at ASC`,
      [assessment.id],
    );

    return reply.send({ evidence });
  },

  // POST /tenants/:tenantId/assessments/:controlId/evidence/text
  async addTextEvidence(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, controlId } = request.params as { tenantId: string; controlId: string };
    const { content } = request.body as { content: string };

    if (!content?.trim()) {
      return reply.status(400).send({ error: 'Bad Request', message: 'content is required' });
    }

    const isUUID = /^[0-9a-f-]{36}$/.test(controlId);
    const control = await queryOne<{ id: string }>(
      isUUID
        ? 'SELECT id FROM controls WHERE id = $1'
        : `SELECT c.id FROM controls c
           JOIN tenants t ON t.id = $2
           WHERE c.control_id = $1
             AND c.framework_id = COALESCE(t.framework_id, (SELECT id FROM frameworks WHERE code = 'SMB1001:2026'))`,
      isUUID ? [controlId] : [controlId, tenantId],
    );
    if (!control) return reply.status(404).send({ error: 'Not Found', message: 'Control not found' });

    // Ensure assessment row exists (create a skeleton if needed)
    const assessment = await queryOne<{ id: string }>(
      `INSERT INTO control_assessments (tenant_id, control_id, reviewed_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, control_id) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [tenantId, control.id, request.user.sub],
    );

    const evidence = await queryOne(
      `INSERT INTO assessment_evidence (assessment_id, tenant_id, control_id, type, content, uploaded_by)
       VALUES ($1, $2, $3, 'text', $4, $5)
       RETURNING *`,
      [assessment!.id, tenantId, control.id, content.trim(), request.user.sub],
    );

    return reply.status(201).send(evidence);
  },

  // GET /tenants/:tenantId/assessments/:controlId/evidence/:evidenceId/download
  async downloadEvidence(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, evidenceId } = request.params as { tenantId: string; evidenceId: string };

    const ev = await queryOne<{ id: string; file_path: string; file_name: string; mime_type: string; type: string }>(
      'SELECT id, file_path, file_name, mime_type, type FROM assessment_evidence WHERE id = $1 AND tenant_id = $2',
      [evidenceId, tenantId],
    );

    if (!ev || ev.type !== 'file') return reply.status(404).send({ error: 'Not Found', message: 'Evidence file not found' });

    const absPath = path.join(env.UPLOAD_DIR, ev.file_path);
    if (!fs.existsSync(absPath)) return reply.status(404).send({ error: 'Not Found', message: 'File missing from storage' });

    return reply
      .header('Content-Disposition', `attachment; filename="${ev.file_name}"`)
      .header('Content-Type', ev.mime_type || 'application/octet-stream')
      .send(fs.createReadStream(absPath));
  },

  // POST /tenants/:tenantId/assessments/:controlId/evidence/file
  async uploadFileEvidence(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, controlId } = request.params as { tenantId: string; controlId: string };

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'Bad Request', message: 'No file provided' });

    const isUUID = /^[0-9a-f-]{36}$/.test(controlId);
    const control = await queryOne<{ id: string }>(
      isUUID
        ? 'SELECT id FROM controls WHERE id = $1'
        : `SELECT c.id FROM controls c
           JOIN tenants t ON t.id = $2
           WHERE c.control_id = $1
             AND c.framework_id = COALESCE(t.framework_id, (SELECT id FROM frameworks WHERE code = 'SMB1001:2026'))`,
      isUUID ? [controlId] : [controlId, tenantId],
    );
    if (!control) return reply.status(404).send({ error: 'Not Found', message: 'Control not found' });

    const uploadDir = path.join(env.UPLOAD_DIR, tenantId, 'assessments');
    fs.mkdirSync(uploadDir, { recursive: true });

    const safeFilename = `${Date.now()}_${data.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(uploadDir, safeFilename);
    const fileBuffer = await data.toBuffer();

    if (fileBuffer.length > env.MAX_FILE_SIZE_MB * 1024 * 1024) {
      return reply.status(400).send({ error: 'Bad Request', message: `File exceeds ${env.MAX_FILE_SIZE_MB}MB limit` });
    }

    fs.writeFileSync(filePath, fileBuffer);

    // Ensure assessment row exists
    const assessment = await queryOne<{ id: string }>(
      `INSERT INTO control_assessments (tenant_id, control_id, reviewed_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (tenant_id, control_id) DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [tenantId, control.id, request.user.sub],
    );

    const evidence = await queryOne(
      `INSERT INTO assessment_evidence
         (assessment_id, tenant_id, control_id, type, file_path, file_name, file_size, mime_type, uploaded_by)
       VALUES ($1, $2, $3, 'file', $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        assessment!.id, tenantId, control.id,
        filePath.replace(env.UPLOAD_DIR, ''),
        data.filename,
        fileBuffer.length,
        data.mimetype,
        request.user.sub,
      ],
    );

    return reply.status(201).send(evidence);
  },
};
