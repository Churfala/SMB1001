import path from 'path';
import fs from 'fs';
import { FastifyRequest, FastifyReply } from 'fastify';
import { auditService } from '../services/audit.service';
import { auditLogService } from '../services/audit-log.service';
import { queryOne } from '../config/database';
import { env } from '../config/env';
import { ResultStatus } from '../types';

export const auditController = {
  // ------------------------------------------------------------------
  // Audits
  // ------------------------------------------------------------------
  async list(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId } = request.params as { tenantId: string };
    const { limit = 20, offset = 0 } = request.query as { limit?: number; offset?: number };
    const result = await auditService.list(tenantId, Number(limit), Number(offset));
    return reply.send(result);
  },

  async create(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId } = request.params as { tenantId: string };
    const { name } = request.body as { name: string };

    if (!name?.trim()) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name is required' });
    }

    const audit = await auditService.create(tenantId, name.trim(), request.user.sub);

    await auditLogService.log({
      tenantId,
      userId: request.user.sub,
      action: 'audit.created',
      resourceType: 'audit',
      resourceId: audit.id,
      details: { name: audit.name },
    });

    return reply.status(201).send(audit);
  },

  async getOne(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, auditId } = request.params as { tenantId: string; auditId: string };
    const audit = await auditService.getWithResults(auditId, tenantId);
    if (!audit) return reply.status(404).send({ error: 'Audit not found' });
    return reply.send(audit);
  },

  async run(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, auditId } = request.params as { tenantId: string; auditId: string };

    const audit = await auditService.getById(auditId, tenantId);
    if (!audit) return reply.status(404).send({ error: 'Audit not found' });

    if (['running', 'queued'].includes(audit.status)) {
      return reply.status(409).send({ error: 'Conflict', message: 'Audit is already running or queued' });
    }

    const jobId = await auditService.queueRun(auditId, tenantId);

    await auditLogService.log({
      tenantId,
      userId: request.user.sub,
      action: 'audit.queued',
      resourceType: 'audit',
      resourceId: auditId,
      details: { jobId },
    });

    return reply.send({ message: 'Audit queued', auditId, jobId });
  },

  async getProgress(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, auditId } = request.params as { tenantId: string; auditId: string };

    const audit = await auditService.getById(auditId, tenantId);
    if (!audit) return reply.status(404).send({ error: 'Audit not found' });

    let jobProgress = null;
    if (audit.job_id) {
      jobProgress = await auditService.getJobProgress(audit.job_id);
    }

    return reply.send({
      auditId,
      status: audit.status,
      score: audit.score,
      progress: jobProgress?.progress ?? (audit.status === 'completed' ? 100 : 0),
      startedAt: audit.started_at,
      completedAt: audit.completed_at,
    });
  },

  async finalise(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, auditId } = request.params as { tenantId: string; auditId: string };

    const audit = await auditService.getById(auditId, tenantId);
    if (!audit) return reply.status(404).send({ error: 'Audit not found' });

    if (!['completed', 'running'].includes(audit.status)) {
      return reply.status(409).send({ error: 'Conflict', message: 'Only running or completed audits can be finalised' });
    }

    try {
      const finalised = await auditService.finalise(auditId, tenantId);
      await auditLogService.log({
        tenantId,
        userId: request.user.sub,
        action: 'audit.finalised',
        resourceType: 'audit',
        resourceId: auditId,
        details: { score: finalised.score },
      });
      return reply.send(finalised);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to finalise audit';
      return reply.status(400).send({ error: 'Bad Request', message });
    }
  },

  async cancel(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, auditId } = request.params as { tenantId: string; auditId: string };
    try {
      await auditService.cancel(auditId, tenantId);
      return reply.send({ message: 'Audit cancelled' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to cancel audit';
      return reply.status(400).send({ error: 'Bad Request', message });
    }
  },

  // ------------------------------------------------------------------
  // Audit Results
  // ------------------------------------------------------------------
  async updateResult(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, auditId, controlId } = request.params as {
      tenantId: string;
      auditId: string;
      controlId: string;
    };

    // controlId in the URL is the controls.id UUID
    const { status, notes } = request.body as { status?: ResultStatus; notes?: string };

    if (status && !['pass', 'fail', 'partial', 'not_applicable', 'manual_review'].includes(status)) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Invalid status value' });
    }

    const result = await auditService.updateResult(auditId, controlId, tenantId, { status, notes }, request.user.sub);

    if (!result) return reply.status(404).send({ error: 'Audit result not found' });

    await auditLogService.log({
      tenantId,
      userId: request.user.sub,
      action: 'audit_result.updated',
      resourceType: 'audit_result',
      resourceId: result.id,
      details: { controlId, status, notes },
    });

    return reply.send(result);
  },

  // ------------------------------------------------------------------
  // Evidence
  // ------------------------------------------------------------------
  async listEvidence(request: FastifyRequest, reply: FastifyReply) {
    const { auditId, controlId } = request.params as { auditId: string; controlId: string };
    const evidence = await auditService.listEvidence(auditId, controlId);
    return reply.send({ evidence });
  },

  async addTextEvidence(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, auditId, controlId } = request.params as {
      tenantId: string;
      auditId: string;
      controlId: string;
    };
    const { content } = request.body as { content: string };

    if (!content?.trim()) {
      return reply.status(400).send({ error: 'Bad Request', message: 'content is required' });
    }

    // Find the audit_result ID for this audit/control pair
    const auditResult = await queryOne<{ id: string }>(
      'SELECT id FROM audit_results WHERE audit_id = $1 AND control_id = $2',
      [auditId, controlId],
    );

    const evidence = await auditService.addTextEvidence({
      auditId,
      auditResultId: auditResult?.id ?? '',
      tenantId,
      controlId,
      content: content.trim(),
      uploadedBy: request.user.sub,
    });

    return reply.status(201).send(evidence);
  },

  async uploadFileEvidence(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, auditId, controlId } = request.params as {
      tenantId: string;
      auditId: string;
      controlId: string;
    };

    // Parse multipart
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: 'Bad Request', message: 'No file provided' });

    const uploadDir = path.join(env.UPLOAD_DIR, tenantId, auditId);
    fs.mkdirSync(uploadDir, { recursive: true });

    const safeFilename = `${Date.now()}_${data.filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const filePath = path.join(uploadDir, safeFilename);

    const fileBuffer = await data.toBuffer();

    if (fileBuffer.length > env.MAX_FILE_SIZE_MB * 1024 * 1024) {
      return reply.status(400).send({ error: 'Bad Request', message: `File exceeds ${env.MAX_FILE_SIZE_MB}MB limit` });
    }

    fs.writeFileSync(filePath, fileBuffer);

    const auditResult = await queryOne<{ id: string }>(
      'SELECT id FROM audit_results WHERE audit_id = $1 AND control_id = $2',
      [auditId, controlId],
    );

    const evidence = await auditService.addFileEvidence({
      auditId,
      auditResultId: auditResult?.id ?? '',
      tenantId,
      controlId,
      filePath: filePath.replace(env.UPLOAD_DIR, ''),
      fileName: data.filename,
      fileSize: fileBuffer.length,
      mimeType: data.mimetype,
      uploadedBy: request.user.sub,
    });

    return reply.status(201).send(evidence);
  },

  // ------------------------------------------------------------------
  // Schedules
  // ------------------------------------------------------------------
  async listSchedules(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId } = request.params as { tenantId: string };
    const schedules = await auditService.listSchedules(tenantId);
    return reply.send({ schedules });
  },

  async createSchedule(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId } = request.params as { tenantId: string };
    const { name, cronExpression } = request.body as { name: string; cronExpression: string };

    if (!name?.trim() || !cronExpression?.trim()) {
      return reply.status(400).send({ error: 'Bad Request', message: 'name and cronExpression are required' });
    }

    try {
      const schedule = await auditService.createSchedule(tenantId, {
        name: name.trim(),
        cronExpression: cronExpression.trim(),
        createdBy: request.user.sub,
      });
      return reply.status(201).send(schedule);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create schedule';
      return reply.status(400).send({ error: 'Bad Request', message });
    }
  },

  async updateSchedule(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, scheduleId } = request.params as { tenantId: string; scheduleId: string };
    const body = request.body as { name?: string; cronExpression?: string; isActive?: boolean };

    try {
      const schedule = await auditService.updateSchedule(tenantId, scheduleId, body);
      return reply.send(schedule);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to update schedule';
      return reply.status(400).send({ error: 'Bad Request', message });
    }
  },

  async deleteSchedule(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, scheduleId } = request.params as { tenantId: string; scheduleId: string };
    await auditService.deleteSchedule(tenantId, scheduleId);
    return reply.status(204).send();
  },
};
