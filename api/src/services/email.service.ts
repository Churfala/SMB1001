import { env } from '../config/env';

// Lazy require so the API starts even if nodemailer isn't yet installed.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let nm: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  nm = require('nodemailer');
} catch {
  // nodemailer not installed — all email sends will be no-ops
}

// If SMTP is not configured, all sends are silent no-ops.
const isConfigured = !!(env.SMTP_HOST && env.SMTP_USER && nm);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let transporter: any = null;
if (isConfigured) {
  transporter = nm.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD },
  });
}

async function send(opts: { to: string; subject: string; html: string }): Promise<void> {
  if (!transporter) return;
  try {
    await transporter.sendMail({ from: env.SMTP_FROM, ...opts });
  } catch (err) {
    console.error('[email] send failed to', opts.to, err);
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

  /** Notify a user they have been assigned a task. */
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
      to: opts.to,
      subject: `ControlCheck: Task assigned — ${opts.taskTitle}`,
      html: baseHtml(`
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

  /** Welcome email sent when a new local-password user is created. */
  sendWelcome(opts: { to: string; name: string; loginUrl: string }): void {
    send({
      to: opts.to,
      subject: 'Welcome to ControlCheck',
      html: baseHtml(`
        <p>Hi ${opts.name},</p>
        <p>Your ControlCheck account has been created. Sign in at:</p>
        <p><a href="${opts.loginUrl}" style="color:#2563eb">${opts.loginUrl}</a></p>
        <p>If you were not expecting this email, please contact your administrator.</p>
      `),
    });
  },
};
