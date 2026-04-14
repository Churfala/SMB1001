import path from 'path';
import fs from 'fs';
import { FastifyRequest, FastifyReply } from 'fastify';
import { query, queryOne } from '../config/database';
import { env } from '../config/env';

export const assessmentController = {
  // GET /tenants/:tenantId/assessments
  // Returns all 39 controls joined with this tenant's assessment data (null fields if not yet assessed)
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
       LEFT JOIN control_assessments a
         ON a.control_id = c.id AND a.tenant_id = $1
       WHERE c.is_active = true
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
        : 'SELECT id FROM controls WHERE control_id = $1',
      [controlId],
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
       RETURNING *`,
      [tenantId, control.id, status, notes, reviewDate, request.user.sub],
    );

    return reply.send(row);
  },

  // GET /tenants/:tenantId/assessments/:controlId/evidence
  async listEvidence(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, controlId } = request.params as { tenantId: string; controlId: string };

    const isUUID = /^[0-9a-f-]{36}$/.test(controlId);
    const control = await queryOne<{ id: string }>(
      isUUID
        ? 'SELECT id FROM controls WHERE id = $1'
        : 'SELECT id FROM controls WHERE control_id = $1',
      [controlId],
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
        : 'SELECT id FROM controls WHERE control_id = $1',
      [controlId],
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

  // POST /tenants/:tenantId/assessments/:controlId/evidence/file
  async uploadFileEvidence(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, controlId } = request.params as { tenantId: string; controlId: string };

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'Bad Request', message: 'No file provided' });

    const isUUID = /^[0-9a-f-]{36}$/.test(controlId);
    const control = await queryOne<{ id: string }>(
      isUUID
        ? 'SELECT id FROM controls WHERE id = $1'
        : 'SELECT id FROM controls WHERE control_id = $1',
      [controlId],
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
