import nodemailer from 'nodemailer';
import { env } from '../config/env';
import pino from 'pino';

const logger = pino({ level: env.LOG_LEVEL });

const TIER_NAMES: Record<string, string> = {
  '1': 'Bronze', '2': 'Silver', '3': 'Gold', '4': 'Platinum', '5': 'Diamond',
};

const TIER_COLORS: Record<string, string> = {
  '1': '#92400e', '2': '#374151', '3': '#854d0e', '4': '#1e3a5f', '5': '#5b21b6',
};

const TIER_BG: Record<string, string> = {
  '1': '#fef3c7', '2': '#f3f4f6', '3': '#fef08a', '4': '#dbeafe', '5': '#ede9fe',
};

function getTransport() {
  if (!env.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
  });
}

function tierBadges(tiers: Record<string, boolean>): string {
  return [1, 2, 3, 4, 5].map((n) => {
    const key = String(n);
    const achieved = tiers[key] ?? false;
    const name = TIER_NAMES[key];
    const color = achieved ? TIER_COLORS[key] : '#9ca3af';
    const bg = achieved ? TIER_BG[key] : '#f9fafb';
    const check = achieved ? '✓' : '○';
    const star = n === 3 ? ' ★' : '';
    return `<span style="display:inline-block;padding:4px 10px;margin:0 4px;border-radius:12px;font-size:12px;font-weight:600;color:${color};background:${bg};border:1px solid ${color};">${check} ${name}${star}</span>`;
  }).join('');
}

export const emailService = {
  async sendAuditComplete(options: {
    to: string[];
    tenantName: string;
    auditName: string;
    score: number;
    tiers: Record<string, boolean>;
  }): Promise<void> {
    const transport = getTransport();
    if (!transport || options.to.length === 0) return;

    const { to, tenantName, auditName, score, tiers } = options;
    const scoreColor = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626';
    const dashboardUrl = 'https://controlcheck.globaltechnology.nz/dashboard';

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;box-shadow:0 2px 12px rgba(0,0,0,0.08);overflow:hidden;">
        <!-- Header -->
        <tr>
          <td style="background:#2563eb;padding:20px 32px;">
            <span style="font-size:18px;font-weight:700;color:#fff;letter-spacing:-0.3px;">ControlCheck</span>
            <span style="font-size:12px;color:#bfdbfe;margin-left:8px;">by Global Technology</span>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:28px 32px;">
            <h2 style="margin:0 0 6px;font-size:18px;font-weight:700;color:#111827;">Audit Complete</h2>
            <p style="margin:0 0 20px;font-size:14px;color:#6b7280;">${tenantName} — ${auditName}</p>

            <!-- Score -->
            <div style="background:#f9fafb;border-radius:8px;padding:16px 20px;margin-bottom:20px;text-align:center;">
              <div style="font-size:42px;font-weight:800;color:${scoreColor};line-height:1;">${score}%</div>
              <div style="font-size:12px;color:#9ca3af;margin-top:4px;">Compliance Score</div>
            </div>

            <!-- Tier achievement -->
            <p style="font-size:12px;font-weight:600;color:#374151;margin:0 0 8px;text-transform:uppercase;letter-spacing:0.05em;">Certification Level</p>
            <div style="margin-bottom:20px;line-height:2.2;">${tierBadges(tiers)}</div>

            <!-- CTA -->
            <a href="${dashboardUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:10px 22px;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;">
              View Full Report →
            </a>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px;border-top:1px solid #f3f4f6;background:#f9fafb;">
            <p style="margin:0;font-size:11px;color:#9ca3af;">
              Global Technology NZ — ControlCheck | SMB1001:2026 Compliance Platform<br>
              This email was sent because you are a user of a ControlCheck tenant.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

    try {
      await transport.sendMail({
        from: env.SMTP_FROM,
        to: to.join(', '),
        subject: `Audit Complete: ${auditName} — ${score}% | ${tenantName}`,
        html,
      });
      logger.info({ recipients: to.length, tenantName, score }, 'Audit completion email sent');
    } catch (err: unknown) {
      logger.error({ err: err instanceof Error ? err.message : err }, 'Failed to send audit completion email');
    }
  },
};
