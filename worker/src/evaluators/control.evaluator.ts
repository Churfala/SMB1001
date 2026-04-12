import type { M365Data } from '../services/m365.service';
import type { GoogleData } from '../services/google.service';

export type ResultStatus = 'pass' | 'fail' | 'partial' | 'not_applicable' | 'manual_review';

export interface EvaluationResult {
  status: ResultStatus;
  score: number; // 0–100
  rawData: Record<string, unknown>;
  notes: string;
}

export type EvaluatorFn = (
  m365Data: M365Data | null,
  googleData: GoogleData | null,
) => EvaluationResult;

const manual = (notes: string): EvaluationResult => ({
  status: 'manual_review', score: 0, rawData: {}, notes,
});

const na = (notes: string): EvaluationResult => ({
  status: 'not_applicable', score: 0, rawData: {}, notes,
});

/** Detect MFA from M365 authentication methods array */
function hasMfa(methods: Record<string, unknown>[]): boolean {
  return methods.some((m) => {
    const t = String(m['@odata.type'] ?? '');
    return (
      t.includes('microsoftAuthenticator') ||
      t.includes('phoneAuthentication') ||
      t.includes('fido2') ||
      t.includes('softwareOath') ||
      t.includes('windowsHelloForBusiness')
    );
  });
}

export const controlEvaluators = new Map<string, EvaluatorFn>([
  // -------------------------------------------------------------------
  // GOVERN – manual controls
  // -------------------------------------------------------------------
  ['GOV-001', () => manual('Security policy documentation requires manual review')],
  ['GOV-002', () => manual('Risk assessment requires manual review')],
  ['GOV-003', () => manual('Security roles documentation requires manual review')],
  ['GOV-004', () => manual('Security awareness training records require manual review')],
  ['GOV-005', () => manual('Incident response plan requires manual review')],

  // -------------------------------------------------------------------
  // IAM-001: MFA for admin accounts
  // -------------------------------------------------------------------
  ['IAM-001', (m365, google) => {
    if (m365) {
      const adminIds = new Set<string>();
      for (const role of m365.adminRoles) {
        for (const member of (role.members as Record<string, unknown>[] ?? [])) {
          adminIds.add(String(member.id));
        }
      }
      if (adminIds.size === 0) return na('No admin users found in directory roles');

      let withMFA = 0;
      for (const id of adminIds) {
        if (hasMfa(m365.mfaMethods.get(id) ?? [])) withMFA++;
      }
      const pct = Math.round((withMFA / adminIds.size) * 100);
      return {
        status: pct === 100 ? 'pass' : pct >= 80 ? 'partial' : 'fail',
        score: pct,
        rawData: { totalAdmins: adminIds.size, withMFA },
        notes: `${withMFA}/${adminIds.size} admin accounts have MFA enrolled`,
      };
    }
    if (google) {
      const admins = google.adminUsers;
      if (admins.length === 0) return na('No admin users found');
      const withMFA = admins.filter((u) => u.isEnrolledIn2Sv).length;
      const pct = Math.round((withMFA / admins.length) * 100);
      return {
        status: pct === 100 ? 'pass' : pct >= 80 ? 'partial' : 'fail',
        score: pct,
        rawData: { totalAdmins: admins.length, withMFA },
        notes: `${withMFA}/${admins.length} admin accounts have 2FA enrolled`,
      };
    }
    return na('No integration data available');
  }],

  // -------------------------------------------------------------------
  // IAM-002: MFA for all users
  // -------------------------------------------------------------------
  ['IAM-002', (m365, google) => {
    if (m365) {
      const active = m365.users.filter((u) => u.accountEnabled);
      if (active.length === 0) return na('No active users found');
      let withMFA = 0;
      for (const u of active) {
        if (hasMfa(m365.mfaMethods.get(String(u.id)) ?? [])) withMFA++;
      }
      const pct = Math.round((withMFA / active.length) * 100);
      return {
        status: pct >= 98 ? 'pass' : pct >= 85 ? 'partial' : 'fail',
        score: pct,
        rawData: { totalUsers: active.length, withMFA },
        notes: `${withMFA}/${active.length} active users have MFA enrolled (${pct}%)`,
      };
    }
    if (google) {
      const active = google.users.filter((u) => !u.suspended);
      if (active.length === 0) return na('No active users found');
      const withMFA = active.filter((u) => u.isEnrolledIn2Sv).length;
      const pct = Math.round((withMFA / active.length) * 100);
      return {
        status: pct >= 98 ? 'pass' : pct >= 85 ? 'partial' : 'fail',
        score: pct,
        rawData: { totalUsers: active.length, withMFA },
        notes: `${withMFA}/${active.length} users have 2FA enrolled`,
      };
    }
    return na('No integration data available');
  }],

  // -------------------------------------------------------------------
  // IAM-003: Privileged access restricted
  // -------------------------------------------------------------------
  ['IAM-003', (m365, google) => {
    if (m365) {
      const adminIds = new Set<string>();
      for (const role of m365.adminRoles) {
        for (const m of (role.members as Record<string, unknown>[] ?? [])) adminIds.add(String(m.id));
      }
      const total = m365.users.filter((u) => u.accountEnabled).length;
      const globalAdmin = m365.adminRoles.find((r) => r.displayName === 'Global Administrator');
      const globalCount = (globalAdmin?.members as unknown[] ?? []).length;
      const ratio = total > 0 ? adminIds.size / total : 0;
      const status: ResultStatus = globalCount <= 3 && ratio <= 0.05 ? 'pass'
        : globalCount <= 5 && ratio <= 0.10 ? 'partial' : 'fail';
      return {
        status,
        score: status === 'pass' ? 100 : status === 'partial' ? 60 : 20,
        rawData: { totalUsers: total, adminCount: adminIds.size, globalAdminCount: globalCount },
        notes: `${adminIds.size} total admins (${globalCount} Global Admins) out of ${total} users`,
      };
    }
    if (google) {
      const ac = google.adminUsers.length;
      const total = google.users.length;
      const ratio = total > 0 ? ac / total : 0;
      const status: ResultStatus = ratio <= 0.05 ? 'pass' : ratio <= 0.10 ? 'partial' : 'fail';
      return {
        status,
        score: status === 'pass' ? 100 : status === 'partial' ? 60 : 20,
        rawData: { adminCount: ac, totalUsers: total },
        notes: `${ac} admin users out of ${total} total users`,
      };
    }
    return na('No integration data');
  }],

  // -------------------------------------------------------------------
  // IAM-004: Password policy
  // -------------------------------------------------------------------
  ['IAM-004', (m365) => {
    if (!m365) return na('No M365 integration data');
    const sd = m365.legacyAuthPolicies[0];
    if (sd?.isEnabled) return { status: 'pass', score: 100, rawData: sd, notes: 'Security Defaults enforce password policies' };
    const mfaCA = m365.conditionalAccessPolicies.filter(
      (p) => p.state === 'enabled' && Array.isArray((p.grantControls as Record<string, unknown>)?.builtInControls) &&
        ((p.grantControls as Record<string, string[]>).builtInControls).includes('mfa'),
    );
    if (mfaCA.length > 0) return { status: 'partial', score: 70, rawData: { caPolicies: mfaCA.length }, notes: 'CA MFA policies partially address password requirements' };
    return manual('Password policy configuration requires manual verification in Entra ID');
  }],

  // -------------------------------------------------------------------
  // IAM-005: Legacy authentication blocked
  // -------------------------------------------------------------------
  ['IAM-005', (m365) => {
    if (!m365) return na('No M365 integration');
    const sd = m365.legacyAuthPolicies[0];
    if (sd?.isEnabled) return { status: 'pass', score: 100, rawData: sd, notes: 'Security Defaults block legacy authentication' };
    const blocked = m365.conditionalAccessPolicies.filter((p) => {
      const ct = (p.conditions as Record<string, unknown>)?.clientAppTypes as string[] ?? [];
      const bc = ((p.grantControls as Record<string, unknown>)?.builtInControls as string[] ?? []);
      return p.state === 'enabled' && (ct.includes('exchangeActiveSync') || ct.includes('other')) && bc.includes('block');
    });
    if (blocked.length > 0) return { status: 'pass', score: 100, rawData: { policies: blocked.length }, notes: 'Conditional Access blocks legacy authentication' };
    return { status: 'fail', score: 0, rawData: { securityDefaults: false, caPolicy: false }, notes: 'Legacy authentication is NOT blocked. Enable Security Defaults or a CA block policy.' };
  }],

  // -------------------------------------------------------------------
  // IAM-006: Google 2SV enforcement
  // -------------------------------------------------------------------
  ['IAM-006', (_m365, google) => {
    if (!google) return na('No Google Workspace integration');
    return {
      status: google.twoSVEnforced ? 'pass' : 'fail',
      score: google.twoSVEnforced ? 100 : 0,
      rawData: { twoSVEnforced: google.twoSVEnforced },
      notes: google.twoSVEnforced
        ? '2-Step Verification is enforced for the organisation'
        : '2SV is not enforced. Enable in Admin Console > Security > 2-Step Verification.',
    };
  }],

  // -------------------------------------------------------------------
  // EMAIL controls
  // -------------------------------------------------------------------
  ['EMAIL-001', (m365) => {
    if (!m365) return na('No M365 integration');
    if (m365.antiPhishingPolicies.length === 0) return { status: 'fail', score: 0, rawData: {}, notes: 'No anti-phishing policies found. Configure Defender for Office 365.' };
    const enabled = m365.antiPhishingPolicies.filter((p) => p.enabled !== false).length;
    return { status: enabled > 0 ? 'pass' : 'fail', score: enabled > 0 ? 100 : 0, rawData: { total: m365.antiPhishingPolicies.length, enabled }, notes: `${enabled}/${m365.antiPhishingPolicies.length} anti-phishing policies enabled` };
  }],

  ['EMAIL-002', (m365) => {
    if (!m365) return na('No M365 integration');
    if (m365.safeAttachmentPolicies.length === 0) return manual('Safe Attachments config requires verification in Microsoft Defender portal. Requires Defender for Office 365 Plan 1.');
    const enabled = m365.safeAttachmentPolicies.filter((p) => p.enable !== false && p.action !== 'Off').length;
    return { status: enabled > 0 ? 'pass' : 'fail', score: enabled > 0 ? 100 : 0, rawData: { count: enabled }, notes: `${enabled} Safe Attachments policies enabled` };
  }],

  ['EMAIL-003', (m365) => {
    if (!m365) return na('No M365 integration');
    if (m365.safeLinksPolices.length === 0) return manual('Safe Links config requires verification in Microsoft Defender portal. Requires Defender for Office 365 Plan 1.');
    const enabled = m365.safeLinksPolices.filter((p) => p.enable !== false).length;
    return { status: enabled > 0 ? 'pass' : 'fail', score: enabled > 0 ? 100 : 0, rawData: { count: enabled }, notes: `${enabled} Safe Links policies enabled` };
  }],

  ['EMAIL-004', (m365) => {
    if (!m365) return na('No M365 integration');
    if (m365.dkimSettings.length === 0) return manual('DKIM settings could not be retrieved. Verify in Exchange admin centre or Microsoft Defender portal.');
    const enabled = m365.dkimSettings.filter((d) => d.enabled).length;
    const pct = Math.round((enabled / m365.dkimSettings.length) * 100);
    return { status: pct === 100 ? 'pass' : pct > 0 ? 'partial' : 'fail', score: pct, rawData: { total: m365.dkimSettings.length, enabled }, notes: `DKIM enabled for ${enabled}/${m365.dkimSettings.length} domains` };
  }],

  ['EMAIL-005', (m365) => {
    if (!m365) return na('No M365 integration');
    if (m365.dmarcRecords.length === 0) return manual('DMARC cannot be verified automatically via Graph API. Check DNS TXT records for _dmarc subdomain on each accepted domain.');
    const enforced = m365.dmarcRecords.filter((d) => d.policy === 'reject' || d.policy === 'quarantine').length;
    const pct = Math.round((enforced / m365.dmarcRecords.length) * 100);
    return { status: pct === 100 ? 'pass' : pct > 0 ? 'partial' : 'fail', score: pct, rawData: { total: m365.dmarcRecords.length, enforced }, notes: `DMARC policy enforced for ${enforced}/${m365.dmarcRecords.length} domains` };
  }],

  ['EMAIL-006', (m365) => {
    if (!m365) return na('No M365 integration');
    if (m365.mailboxAuditSettings.length === 0) return manual('Mailbox audit settings require verification in Exchange admin centre. Run: Get-OrganizationConfig | Select AuditDisabled');
    const audited = m365.mailboxAuditSettings.filter((s) => s.auditEnabled !== false).length;
    const pct = Math.round((audited / m365.mailboxAuditSettings.length) * 100);
    return { status: pct === 100 ? 'pass' : pct > 0 ? 'partial' : 'fail', score: pct, rawData: { total: m365.mailboxAuditSettings.length, audited }, notes: `Mailbox auditing enabled for ${audited}/${m365.mailboxAuditSettings.length} mailboxes` };
  }],

  // -------------------------------------------------------------------
  // CA controls
  // -------------------------------------------------------------------
  ['CA-001', (m365) => {
    if (!m365) return na('No M365 integration');
    const sd = m365.legacyAuthPolicies[0];
    if (sd?.isEnabled) return { status: 'pass', score: 100, rawData: sd, notes: 'Security Defaults enforce MFA for all users' };
    const mfaCA = m365.conditionalAccessPolicies.filter((p) =>
      p.state === 'enabled' &&
      ((p.grantControls as Record<string, string[]>)?.builtInControls ?? []).includes('mfa') &&
      ((p.conditions as Record<string, Record<string, string[]>>)?.users?.includeUsers ?? []).includes('All'),
    );
    return { status: mfaCA.length > 0 ? 'pass' : 'fail', score: mfaCA.length > 0 ? 100 : 0, rawData: { mfaPolicies: mfaCA.length }, notes: `${mfaCA.length} CA policies require MFA for all users` };
  }],

  ['CA-002', (m365) => {
    if (!m365) return na('No M365 integration');
    const risk = m365.signInRiskPolicies.filter((p) =>
      p.state === 'enabled' && ((p.conditions as Record<string, string[]>)?.signInRiskLevels ?? []).some((l: string) => l === 'high' || l === 'medium'),
    );
    return { status: risk.length > 0 ? 'pass' : 'fail', score: risk.length > 0 ? 100 : 0, rawData: { policies: risk.length }, notes: risk.length > 0 ? 'High-risk sign-in policies configured' : 'No high-risk sign-in policies. Requires Entra ID P2.' };
  }],

  ['CA-003', (m365) => {
    if (!m365) return na('No M365 integration');
    const comp = m365.deviceCompliancePolicies.filter((p) => p.state === 'enabled');
    return { status: comp.length > 0 ? 'pass' : 'fail', score: comp.length > 0 ? 100 : 0, rawData: { policies: comp.length }, notes: comp.length > 0 ? 'Device compliance required by CA policies' : 'No CA policies requiring device compliance. Configure Intune.' };
  }],

  // -------------------------------------------------------------------
  // DATA controls
  // -------------------------------------------------------------------
  ['DATA-001', (m365, google) => {
    if (m365) {
      if (m365.sharingPolicies.length === 0) return manual('SharePoint sharing settings could not be retrieved. Verify in SharePoint admin centre.');
      const restricted = m365.sharingPolicies.some((p) => p.sharingCapability === 'Disabled' || p.sharingCapability === 'ExternalUserSharingOnly');
      return { status: restricted ? 'pass' : 'partial', score: restricted ? 100 : 50, rawData: { sharingPolicies: m365.sharingPolicies }, notes: restricted ? 'External sharing restricted' : 'External sharing may allow anonymous access. Review SharePoint sharing settings.' };
    }
    if (google) {
      if (google.sharingSettings.length === 0) return manual('Google sharing settings could not be retrieved. Verify in Admin Console > Drive.');
      const restricted = google.sharingSettings.some((s) => s.sharingPolicy === 'ALLOWED_FOR_DOMAIN' || s.sharingPolicy === 'NOT_ALLOWED');
      return { status: restricted ? 'pass' : 'fail', score: restricted ? 100 : 30, rawData: { sharingSettings: google.sharingSettings }, notes: restricted ? 'Sharing restricted to trusted domains' : 'External sharing not restricted. Review Drive settings.' };
    }
    return na('No integration data');
  }],

  ['DATA-002', () => manual('DLP policy configuration requires manual review in Microsoft Purview Compliance Center or Google Workspace DLP settings')],

  ['DATA-003', (m365, google) => {
    const apps = m365?.oauthApps ?? google?.oauthApps ?? [];
    return { status: 'manual_review', score: 0, rawData: { totalApps: apps.length }, notes: `${apps.length} third-party OAuth applications detected. Review permissions and revoke unnecessary access.` };
  }],

  // -------------------------------------------------------------------
  // DET controls
  // -------------------------------------------------------------------
  ['DET-001', (m365) => {
    if (!m365) return na('No M365 integration');
    if (!m365.secureScore) return manual('Could not retrieve Secure Score. Requires SecurityEvents.Read.All permission.');
    const current = Number(m365.secureScore.currentScore ?? 0);
    const max = Number(m365.secureScore.maxScore ?? 1);
    const pct = max > 0 ? Math.round((current / max) * 100) : 0;
    return { status: pct >= 70 ? 'pass' : pct >= 50 ? 'partial' : 'fail', score: pct, rawData: { currentScore: current, maxScore: max }, notes: `Microsoft Secure Score: ${current}/${max} (${pct}%)` };
  }],

  ['DET-002', (m365) => {
    if (!m365) return na('No M365 integration');
    if (!m365.auditLogConfig) return manual('Audit log retention requires manual verification in Microsoft Purview Compliance Center');
    const cfg = m365.auditLogConfig;
    if (cfg.enabled === null) return manual(`Audit log status could not be confirmed: ${String(cfg.error ?? 'insufficient permissions')}`);
    return { status: cfg.enabled ? 'pass' : 'fail', score: cfg.enabled ? 100 : 0, rawData: cfg, notes: cfg.enabled ? 'Unified audit log is enabled' : 'Unified audit log is NOT enabled. Enable in Microsoft Purview > Audit.' };
  }],

  ['DET-003', (m365) => {
    if (!m365) return na('No M365 integration');
    const crit = m365.alertPolicies.filter((p) => p.severity === 'High' || p.severity === 'Medium' || p.severity === 'high' || p.severity === 'medium' || p.category === 'ThreatManagement');
    return { status: crit.length >= 3 ? 'pass' : crit.length > 0 ? 'partial' : 'fail', score: crit.length >= 3 ? 100 : crit.length > 0 ? 50 : 0, rawData: { total: m365.alertPolicies.length, critical: crit.length }, notes: `${crit.length} critical/high severity alert policies configured` };
  }],

  // -------------------------------------------------------------------
  // REC controls
  // -------------------------------------------------------------------
  ['REC-001', () => manual('Backup strategy and recovery tests require manual verification')],
  ['REC-002', () => manual('Recovery time objectives and BCP/DRP require manual verification')],
]);
