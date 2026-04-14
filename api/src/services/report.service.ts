import { query, queryOne } from '../config/database';

interface ReportData {
  tenant: Record<string, unknown>;
  audit: Record<string, unknown>;
  results: Record<string, unknown>[];
  summary: Record<string, unknown>;
  score: number;
  failedControls: Record<string, unknown>[];
  criticalFailures: Record<string, unknown>[];
  recommendations: string[];
}

const BRAND_BLUE = '#2563eb';

const STATUS_COLORS: Record<string, string> = {
  pass: '#27ae60',
  fail: '#e74c3c',
  partial: '#f39c12',
  not_applicable: '#95a5a6',
  manual_review: '#3498db',
};

const TIER_NAMES: Record<number, string> = { 1: 'Bronze', 2: 'Silver', 3: 'Gold', 4: 'Platinum', 5: 'Diamond' };
const TIER_PDF_COLORS: Record<number, string> = { 1: '#92400e', 2: '#374151', 3: '#854d0e', 4: '#1e3a5f', 5: '#5b21b6' };
const TIER_PDF_BG: Record<number, string> = { 1: '#fef3c7', 2: '#f3f4f6', 3: '#fef08a', 4: '#dbeafe', 5: '#ede9fe' };

function computeTierAchievement(results: Record<string, unknown>[]): Record<number, boolean> {
  const tiers: Record<number, boolean> = {};
  for (const maxTier of [1, 2, 3, 4, 5]) {
    const relevant = results.filter((r) => (r.tier as number ?? 99) <= maxTier);
    tiers[maxTier] = relevant.length > 0 &&
      relevant.every((r) => r.status === 'pass' || r.status === 'not_applicable');
  }
  return tiers;
}

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
              c.tier,
              c.description,
              c.remediation_guidance,
              c."references",
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
      summary: ((audit as Record<string, unknown>).summary as Record<string, unknown>) ?? {},
      score: Number((audit as Record<string, unknown>).score ?? 0),
      failedControls,
      criticalFailures,
      recommendations,
    };
  },

  generateCSV(reportData: ReportData): string {
    const headers = [
      'Control ID', 'Name', 'Category', 'Tier', 'Severity', 'Status',
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
      TIER_NAMES[r.tier as number] ?? '',
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

    const tiers = computeTierAchievement(results);

    // Tier certification row for PDF
    const tierRow = [1, 2, 3, 4, 5].map((n) => {
      const achieved = tiers[n] ?? false;
      const name = TIER_NAMES[n];
      const color = achieved ? TIER_PDF_COLORS[n] : '#9ca3af';
      const fillColor = achieved ? TIER_PDF_BG[n] : '#f9fafb';
      const star = n === 3 ? ' ★' : '';
      return {
        text: `${achieved ? '✓' : '○'} ${name}${star}`,
        alignment: 'center',
        fontSize: 9,
        bold: true,
        color,
        fillColor,
        margin: [2, 4, 2, 4],
      };
    });

    return {
      pageSize: 'A4',
      pageMargins: [40, 60, 40, 60],
      footer: (currentPage: number, pageCount: number) => ({
        text: `Global Technology NZ — ControlCheck  |  SMB1001:2026 Compliance Platform  |  Confidential  |  Page ${currentPage} of ${pageCount}`,
        fontSize: 8,
        color: '#9ca3af',
        alignment: 'center',
        margin: [40, 8, 40, 0],
      }),
      content: [
        // Cover
        { text: 'ControlCheck', style: 'title' },
        { text: 'Powered by Global Technology', style: 'brandSubtitle' },
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 2, lineColor: BRAND_BLUE }], margin: [0, 6, 0, 10] },
        { text: String((tenant as Record<string, string>).name ?? ''), style: 'tenantName' },
        { text: `SMB1001:2026 Compliance Audit Report`, style: 'auditLabel', margin: [0, 2, 0, 0] },
        { text: `Audit: ${String((audit as Record<string, string>).name ?? '')}`, style: 'auditName' },
        { text: `Generated: ${new Date().toLocaleDateString('en-AU')}`, style: 'date', margin: [0, 4, 0, 16] },

        // Certification Level
        { text: 'Certification Level', style: 'sectionHeader' },
        {
          table: {
            widths: ['*', '*', '*', '*', '*'],
            body: [tierRow],
          },
          layout: {
            hLineWidth: () => 0,
            vLineWidth: () => 0,
            paddingLeft: () => 0,
            paddingRight: () => 0,
          },
          margin: [0, 0, 0, 16],
        },

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
                { text: String((summary.pass as number) ?? 0), color: '#27ae60', bold: true },
                { text: String((summary.fail as number) ?? 0), color: '#e74c3c', bold: true },
                { text: String((summary.partial as number) ?? 0), color: '#f39c12', bold: true },
                { text: String((summary.not_applicable as number) ?? 0), color: '#95a5a6', bold: true },
                { text: String((summary.manual_review as number) ?? 0), color: '#3498db', bold: true },
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
            widths: [45, '*', 40, 40, 50, 45],
            body: [
              ['Control ID', 'Name', 'Tier', 'Severity', 'Status', 'Score'].map((h) => ({ text: h, style: 'tableHeader' })),
              ...results.map((r) => [
                { text: String(r.control_code ?? ''), fontSize: 8 },
                { text: String(r.control_name ?? ''), fontSize: 8 },
                { text: TIER_NAMES[r.tier as number] ?? '', fontSize: 8, color: TIER_PDF_COLORS[r.tier as number] ?? '#374151' },
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
        title: { fontSize: 26, bold: true, color: BRAND_BLUE },
        brandSubtitle: { fontSize: 11, color: '#6b7280', margin: [0, 2, 0, 0] },
        tenantName: { fontSize: 16, bold: true, color: '#111827' },
        auditLabel: { fontSize: 11, color: '#6b7280' },
        auditName: { fontSize: 11, color: '#6b7280', margin: [0, 2, 0, 0] },
        date: { fontSize: 9, color: '#9ca3af' },
        sectionHeader: { fontSize: 14, bold: true, margin: [0, 16, 0, 8], color: BRAND_BLUE },
        subsectionHeader: { fontSize: 11, bold: true, margin: [0, 8, 0, 6], color: '#374151' },
        statLabel: { fontSize: 9, color: '#7f8c8d', margin: [0, 0, 0, 2] },
        statValue: { fontSize: 18, bold: true, color: '#2c3e50' },
        tableHeader: { bold: true, fontSize: 9, fillColor: '#eff6ff', color: BRAND_BLUE },
      },
      defaultStyle: { fontSize: 10, font: 'Roboto' },
    };
  },
};
