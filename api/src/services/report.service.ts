import { query, queryOne } from '../config/database';

interface ReportData {
  tenant: Record<string, unknown>;
  audit: Record<string, unknown>;
  results: Record<string, unknown>[];
  summary: Record<string, number>;
  score: number;
  failedControls: Record<string, unknown>[];
  criticalFailures: Record<string, unknown>[];
  recommendations: string[];
}

const STATUS_COLORS: Record<string, string> = {
  pass: '#27ae60',
  fail: '#e74c3c',
  partial: '#f39c12',
  not_applicable: '#95a5a6',
  manual_review: '#3498db',
};

export const reportService = {
  async getData(auditId: string, tenantId: string): Promise<ReportData> {
    const tenant = await queryOne('SELECT * FROM tenants WHERE id = $1', [tenantId]);
    const audit = await queryOne('SELECT * FROM audits WHERE id = $1 AND tenant_id = $2', [auditId, tenantId]);
    if (!audit) throw new Error('Audit not found');

    const results = await query(
      `SELECT ar.*,
              c.control_id AS control_code,
              c.name       AS control_name,
              c.category,
              c.severity,
              c.description,
              c.remediation_guidance,
              c."references",
              u.first_name || ' ' || u.last_name AS reviewer_name
       FROM audit_results ar
       JOIN controls c ON c.id = ar.control_id
       LEFT JOIN users u ON u.id = ar.reviewed_by
       WHERE ar.audit_id = $1
       ORDER BY
         CASE c.severity WHEN 'critical' THEN 1 WHEN 'high' THEN 2
                         WHEN 'medium' THEN 3   WHEN 'low' THEN 4 ELSE 5 END,
         c.category, c.control_id`,
      [auditId],
    );

    const failedControls = results.filter((r) => r.status === 'fail' || r.status === 'partial');
    const criticalFailures = results.filter((r) => r.status === 'fail' && r.severity === 'critical');
    const recommendations = failedControls
      .filter((r) => r.remediation_guidance)
      .slice(0, 10)
      .map((r) => `[${r.control_code}] ${r.control_name}: ${r.remediation_guidance}`);

    return {
      tenant: tenant as Record<string, unknown>,
      audit: audit as Record<string, unknown>,
      results,
      summary: (audit as Record<string, unknown>).summary as Record<string, number> ?? {},
      score: Number((audit as Record<string, unknown>).score ?? 0),
      failedControls,
      criticalFailures,
      recommendations,
    };
  },

  generateCSV(reportData: ReportData): string {
    const headers = [
      'Control ID', 'Name', 'Category', 'Severity', 'Status',
      'Score', 'Notes', 'Reviewer', 'Reviewed At',
    ];

    const escape = (v: unknown): string => {
      const s = String(v ?? '');
      if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
      }
      return s;
    };

    const rows = reportData.results.map((r) => [
      r.control_code,
      r.control_name,
      r.category,
      r.severity,
      r.status,
      r.score ?? '',
      r.notes ?? '',
      r.reviewer_name ?? '',
      r.reviewed_at ? new Date(r.reviewed_at as string).toLocaleDateString('en-AU') : '',
    ]);

    return [headers, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
  },

  generatePDFDefinition(reportData: ReportData): Record<string, unknown> {
    const { tenant, audit, results, score, criticalFailures, recommendations, summary, failedControls } = reportData;
    const scoreColor = score >= 80 ? '#27ae60' : score >= 60 ? '#f39c12' : '#e74c3c';

    const completedAt = (audit.completed_at as Date | null)
      ? new Date(audit.completed_at as string).toLocaleDateString('en-AU')
      : 'In Progress';

    return {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      content: [
        // Cover
        { text: 'SMB1001 Compliance Audit Report', style: 'title' },
        { text: String((tenant as Record<string, string>).name ?? ''), style: 'tenantName', margin: [0, 8, 0, 0] },
        { text: `Audit: ${String((audit as Record<string, string>).name ?? '')}`, style: 'auditName' },
        { text: `Generated: ${new Date().toLocaleDateString('en-AU')}`, style: 'date', margin: [0, 4, 0, 20] },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#e0e0e0' }] },

        // Executive Summary
        { text: 'Executive Summary', style: 'sectionHeader' },
        {
          columns: [
            {
              width: '25%',
              stack: [
                { text: 'Compliance Score', style: 'statLabel' },
                { text: `${score}%`, style: 'statValue', color: scoreColor },
              ],
            },
            {
              width: '25%',
              stack: [
                { text: 'Status', style: 'statLabel' },
                { text: String((audit as Record<string, string>).status ?? '').toUpperCase(), style: 'statValue' },
              ],
            },
            {
              width: '25%',
              stack: [
                { text: 'Completed', style: 'statLabel' },
                { text: completedAt, style: 'statValue' },
              ],
            },
            {
              width: '25%',
              stack: [
                { text: 'Critical Failures', style: 'statLabel' },
                {
                  text: String(criticalFailures.length),
                  style: 'statValue',
                  color: criticalFailures.length > 0 ? '#e74c3c' : '#27ae60',
                },
              ],
            },
          ],
          margin: [0, 0, 0, 16],
        },

        // Summary table
        { text: 'Results by Status', style: 'subsectionHeader' },
        {
          table: {
            widths: ['*', '*', '*', '*', '*'],
            body: [
              ['Pass', 'Fail', 'Partial', 'Not Applicable', 'Manual Review'].map((h) => ({ text: h, style: 'tableHeader' })),
              [
                { text: String(summary.pass ?? 0), color: '#27ae60', bold: true },
                { text: String(summary.fail ?? 0), color: '#e74c3c', bold: true },
                { text: String(summary.partial ?? 0), color: '#f39c12', bold: true },
                { text: String(summary.not_applicable ?? 0), color: '#95a5a6', bold: true },
                { text: String(summary.manual_review ?? 0), color: '#3498db', bold: true },
              ],
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 16],
        },

        // Critical failures
        ...(criticalFailures.length > 0 ? [
          { text: 'Critical Failures Requiring Immediate Action', style: 'sectionHeader' },
          { ul: criticalFailures.map((c) => `[${c.control_code}] ${c.control_name}`), margin: [0, 0, 0, 16] },
        ] : []),

        // Recommendations
        ...(recommendations.length > 0 ? [
          { text: 'Top Remediation Recommendations', style: 'sectionHeader' },
          { ol: recommendations.map((r) => ({ text: r, fontSize: 9 })), margin: [0, 0, 0, 16] },
        ] : []),

        // Detailed results
        { text: 'Detailed Control Results', style: 'sectionHeader', pageBreak: 'before' as const },
        {
          table: {
            headerRows: 1,
            widths: [55, '*', 50, 55, 55],
            body: [
              ['Control ID', 'Name', 'Severity', 'Status', 'Score'].map((h) => ({ text: h, style: 'tableHeader' })),
              ...results.map((r) => [
                { text: String(r.control_code ?? ''), fontSize: 8 },
                { text: String(r.control_name ?? ''), fontSize: 8 },
                {
                  text: String(r.severity ?? '').toUpperCase(),
                  fontSize: 8,
                  color: r.severity === 'critical' ? '#e74c3c' : r.severity === 'high' ? '#e67e22' : '#7f8c8d',
                  bold: r.severity === 'critical',
                },
                {
                  text: String(r.status ?? '').replace('_', ' ').toUpperCase(),
                  fontSize: 8,
                  color: STATUS_COLORS[String(r.status ?? '')] ?? '#000',
                },
                { text: r.score != null ? `${r.score}%` : '–', fontSize: 8 },
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
        },
      ],
      styles: {
        title: { fontSize: 22, bold: true, color: '#2c3e50' },
        tenantName: { fontSize: 16, bold: true, color: '#2c3e50' },
        auditName: { fontSize: 11, color: '#7f8c8d', margin: [0, 4, 0, 0] },
        date: { fontSize: 9, color: '#95a5a6' },
        sectionHeader: { fontSize: 14, bold: true, margin: [0, 16, 0, 8], color: '#2c3e50' },
        subsectionHeader: { fontSize: 11, bold: true, margin: [0, 8, 0, 6], color: '#34495e' },
        statLabel: { fontSize: 9, color: '#7f8c8d', margin: [0, 0, 0, 2] },
        statValue: { fontSize: 18, bold: true, color: '#2c3e50' },
        tableHeader: { bold: true, fontSize: 9, fillColor: '#f5f5f5', color: '#2c3e50' },
      },
      defaultStyle: { fontSize: 10, font: 'Roboto' },
    };
  },
};
