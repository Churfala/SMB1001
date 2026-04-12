import { FastifyRequest, FastifyReply } from 'fastify';
import { reportService } from '../services/report.service';
import { auditLogService } from '../services/audit-log.service';

export const reportController = {
  async getReport(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, auditId } = request.params as { tenantId: string; auditId: string };

    try {
      const data = await reportService.getData(auditId, tenantId);
      return reply.send(data);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate report';
      return reply.status(404).send({ error: 'Not Found', message });
    }
  },

  async exportCSV(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, auditId } = request.params as { tenantId: string; auditId: string };

    try {
      const data = await reportService.getData(auditId, tenantId);
      const csv = reportService.generateCSV(data);

      await auditLogService.log({
        tenantId,
        userId: request.user.sub,
        action: 'report.exported.csv',
        resourceType: 'audit',
        resourceId: auditId,
      });

      return reply
        .header('Content-Type', 'text/csv')
        .header('Content-Disposition', `attachment; filename="audit-${auditId}-${Date.now()}.csv"`)
        .send(csv);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to export CSV';
      return reply.status(404).send({ error: 'Not Found', message });
    }
  },

  async exportPDF(request: FastifyRequest, reply: FastifyReply) {
    const { tenantId, auditId } = request.params as { tenantId: string; auditId: string };

    try {
      const data = await reportService.getData(auditId, tenantId);
      const docDefinition = reportService.generatePDFDefinition(data);

      // Dynamic import to avoid loading pdfmake at startup
      const pdfmake = await import('pdfmake/build/pdfmake');
      const pdfFonts = await import('pdfmake/build/vfs_fonts');

      const PdfPrinter = (pdfmake as unknown as { default: { createPdf: (def: unknown, tableLayouts: unknown, fonts: unknown, vfs: unknown) => { getBuffer: (cb: (buf: Buffer) => void) => void } } }).default;

      // Use a simpler approach with pdfmake
      const fontsObj = (pdfFonts as any)?.default?.vfs || {};
      const printer = new (require('pdfmake'))({
        Roboto: {
          normal: Buffer.from(fontsObj['Roboto-Regular.ttf'] ?? '', 'base64'),
          bold: Buffer.from(fontsObj['Roboto-Medium.ttf'] ?? '', 'base64'),
          italics: Buffer.from(fontsObj['Roboto-Italic.ttf'] ?? '', 'base64'),
          bolditalics: Buffer.from(fontsObj['Roboto-MediumItalic.ttf'] ?? '', 'base64'),
        },
      });

      const pdfDoc = printer.createPdfKitDocument(docDefinition as any);
      const chunks: Array<Buffer> = [];

      await new Promise<void>((resolve, reject) => {
        pdfDoc.on('data', (chunk: Buffer) => chunks.push(chunk));
        pdfDoc.on('end', resolve);
        pdfDoc.on('error', reject);
        pdfDoc.end();
      });

      const pdfBuffer = Buffer.concat(chunks);

      await auditLogService.log({
        tenantId,
        userId: request.user.sub,
        action: 'report.exported.pdf',
        resourceType: 'audit',
        resourceId: auditId,
      });

      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="audit-${auditId}-${Date.now()}.pdf"`)
        .send(pdfBuffer);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to generate PDF';
      return reply.status(500).send({ error: 'Internal Server Error', message });
    }
  },
};
