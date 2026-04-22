import { env } from '../config/env';
import { queryOne } from '../config/database';
import { decrypt } from './encryption.service';

// Lazy require so the API starts even if nodemailer isn't installed yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let nm: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  nm = require('nodemailer');
} catch {
  // nodemailer not installed — all sends are no-ops
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  username: string;
  password: string;
  from: string;
}

/**
 * Load SMTP config: DB row takes priority, falls back to env vars.
 * Returns null if neither source has a usable config.
 */
async function loadConfig(): Promise<SmtpConfig | null> {
  if (!nm) return null;

  try {
    const row = await queryOne<{
      host: string | null;
      port: number;
      secure: boolean;
      username: string | null;
      encrypted_password: string | null;
      from_address: string;
      is_enabled: boolean;
    }>('SELECT * FROM smtp_config WHERE id = 1');

    if (row?.is_enabled && row.host && row.username && row.encrypted_password) {
      return {
        host:     row.host,
        port:     row.port,
        secure:   row.secure,
        username: row.username,
        password: decrypt(row.encrypted_password),
        from:     row.from_address,
      };
    }
  } catch {
    // DB not ready yet — fall through to env vars
  }

  // Fall back to env vars
  if (env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD) {
    return {
      host:     env.SMTP_HOST,
      port:     env.SMTP_PORT,
      secure:   env.SMTP_SECURE,
      username: env.SMTP_USER,
      password: env.SMTP_PASSWORD,
      from:     env.SMTP_FROM,
    };
  }

  return null;
}

async function send(opts: { to: string; subject: string; html: string }): Promise<void> {
  const config = await loadConfig();
  if (!config) return;

  try {
    const transporter = nm.createTransport({
      host:   config.host,
      port:   config.port,
      secure: config.secure,
      auth:   { user: config.username, pass: config.password },
    });
    await transporter.sendMail({ from: config.from, ...opts });
  } catch (err) {
    console.error('[email] send failed to', opts.to, err);
  }
}

/**
 * Send a test email. Returns an error message string on failure, null on success.
 */
export async function testSmtp(to: string): Promise<string | null> {
  const config = await loadConfig();
  if (!config) return 'SMTP is not configured';

  try {
    const transporter = nm.createTransport({
      host:   config.host,
      port:   config.port,
      secure: config.secure,
      auth:   { user: config.username, pass: config.password },
    });
    await transporter.sendMail({
      from:    config.from,
      to,
      subject: 'ControlCheck — SMTP test',
      html:    baseHtml('<p>SMTP is configured correctly. This is a test email from ControlCheck.</p>'),
    });
    return null;
  } catch (err) {
    return (err as Error).message ?? 'Unknown error';
  }
}

function baseHtml(content: string): string {
  return `
    <div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111827">
      <p style="font-size:18px;font-weight:700;margin:0 0 20px;color:#111827">ControlCheck</p>
      ${content}
      <p style="font-size:12px;color:#9ca3af;margin-top:32px;border-top:1px solid #f3f4f6;padding-top:16px">
        This is an automated message from ControlCheck. Do not reply.
      </p>
    </div>`;
}

export const emailService = {

  sendTaskAssigned(opts: {
    to: string;
    assigneeName: string;
    taskTitle: string;
    assignedBy: string;
    dueDate: string | null;
  }): void {
    const dueLine = opts.dueDate
      ? `<p style="margin:0 0 8px"><strong>Due:</strong> ${opts.dueDate}</p>`
      : '';
    send({
      to:      opts.to,
      subject: `ControlCheck: Task assigned — ${opts.taskTitle}`,
      html:    baseHtml(`
        <p>Hi ${opts.assigneeName},</p>
        <p>A remediation task has been assigned to you by <strong>${opts.assignedBy}</strong>.</p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:16px 0">
          <p style="margin:0 0 8px;font-weight:600">${opts.taskTitle}</p>
          ${dueLine}
        </div>
        <p>Log in to ControlCheck to view details and update the task status.</p>
      `),
    });
  },

  sendWelcome(opts: { to: string; name: string; loginUrl: string }): void {
    send({
      to:      opts.to,
      subject: 'Welcome to ControlCheck',
      html:    baseHtml(`
        <p>Hi ${opts.name},</p>
        <p>Your ControlCheck account has been created. Sign in at:</p>
        <p><a href="${opts.loginUrl}" style="color:#2563eb">${opts.loginUrl}</a></p>
        <p>If you were not expecting this email, please contact your administrator.</p>
      `),
    });
  },

  sendPasswordReset(opts: { to: string; name: string; resetUrl: string }): void {
    send({
      to:      opts.to,
      subject: 'ControlCheck — Reset your password',
      html:    baseHtml(`
        <p>Hi ${opts.name},</p>
        <p>A password reset was requested for your ControlCheck account.</p>
        <p style="margin:24px 0">
          <a href="${opts.resetUrl}"
             style="background:#2563eb;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
            Reset Password
          </a>
        </p>
        <p style="color:#6b7280;font-size:13px">This link expires in 1 hour. If you did not request a reset, you can safely ignore this email.</p>
      `),
    });
  },
};
