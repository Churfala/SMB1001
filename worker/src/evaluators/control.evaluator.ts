import type { M365Data } from '../services/m365.service';

export type ResultStatus = 'pass' | 'fail' | 'partial' | 'not_applicable' | 'manual_review';

export interface EvaluationResult {
  status: ResultStatus;
  score: number; // 0–100
  rawData: Record<string, unknown>;
  notes: string;
}

export type EvaluatorFn = (
  m365Data: M365Data | null,
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
  // DOMAIN 1: TECHNOLOGY MANAGEMENT — all manual
  // -------------------------------------------------------------------
  ['1.1', () => manual('Provide evidence of IT/MSP support specialist engagement: service contract or SLA. For Level 4+, confirm the SLA includes an 8-working-hour incident response commitment.')],
  ['1.2', () => manual('Provide firewall configuration report or IT provider attestation confirming the firewall is configured securely, default passwords changed, and unnecessary ports closed.')],
  ['1.3', () => manual('Provide antivirus/anti-malware deployment evidence: management console report showing coverage across all endpoints, protection status, and last update dates.')],
  ['1.4', () => manual('Provide evidence of automatic update configuration across all devices: patch management console reports showing OS and application patch compliance.')],
  ['1.5', () => manual('Provide a list of all public-facing websites and SSL checker results (e.g., SSL Labs A rating) confirming valid TLS certificates on each domain.')],
  ['1.6', () => manual('Provide server patching documentation: patch management policy and recent patch reports confirming critical patches applied within 14 days and full cycle within 6 months.')],
  ['1.7', () => manual('Provide vulnerability scan reports for all internet-facing resources from the last 90 days. Include findings summary, risk ratings, and remediation status.')],
  ['1.8', () => manual('Provide evidence of encryption at rest: BitLocker/FileVault activation reports for endpoints, cloud storage encryption configuration screenshots, and database encryption settings.')],
  ['1.9', () => manual('Provide evidence of application control implementation: AppLocker/WDAC policy exports or MDM application control policy configuration, and approved application list.')],
  ['1.10', () => manual('Provide evidence of macro security settings: Group Policy or Intune policy screenshots confirming untrusted Microsoft Office macros are disabled across all devices.')],
  ['1.11', () => manual('Provide penetration test report from a qualified external provider dated within the last 12 months, covering external network, web applications, and social engineering components.')],
  ['1.12', () => manual('Provide EDR deployment evidence: management console screenshots showing coverage across all endpoints. For Level 5, provide the MDR service agreement with SLA response times.')],

  // -------------------------------------------------------------------
  // 2.2: Restrict Administrative Privileges
  // -------------------------------------------------------------------
  ['2.2', (m365) => {
    if (m365) {
      const adminIds = new Set<string>();
      for (const role of m365.adminRoles) {
        for (const member of (role.members as Record<string, unknown>[] ?? [])) {
          adminIds.add(String(member.id));
        }
      }
      const total = m365.users.filter((u) => u.accountEnabled).length;
      const globalAdmin = m365.adminRoles.find((r) => r.displayName === 'Global Administrator');
      const globalCount = (globalAdmin?.members as unknown[] ?? []).length;
      const ratio = total > 0 ? adminIds.size / total : 0;

      const status: ResultStatus =
        globalCount <= 3 && ratio <= 0.05 ? 'pass'
        : globalCount <= 5 && ratio <= 0.10 ? 'partial'
        : 'fail';
      return {
        status,
        score: status === 'pass' ? 100 : status === 'partial' ? 60 : 20,
        rawData: { totalUsers: total, adminCount: adminIds.size, globalAdminCount: globalCount },
        notes: `${adminIds.size} admin users (${globalCount} Global Admins) out of ${total} active users. SMB1001 requires admin privileges limited to those who need them; Global Admin should be 3–5 maximum.`,
      };
    }
    return na('No M365 integration available. Provide manual evidence of admin privilege restrictions.');
  }],

  // -------------------------------------------------------------------
  // 2.3: Individual User Accounts — manual (can't reliably detect shared accounts via API)
  // -------------------------------------------------------------------
  ['2.3', () => manual('Provide evidence that all system access uses individual named accounts: user account listing from your directory and confirmation no shared/generic credentials are in use.')],

  // -------------------------------------------------------------------
  // 2.4: Password Manager — manual
  // -------------------------------------------------------------------
  ['2.4', () => manual('Provide evidence of password manager deployment: management console screenshots showing enrolled users, MFA enforcement on the vault, and audit logging configuration.')],

  // -------------------------------------------------------------------
  // 2.5: MFA on All Employee Email Accounts
  // -------------------------------------------------------------------
  ['2.5', (m365) => {
    if (m365) {
      const active = m365.users.filter((u) => u.accountEnabled);
      if (active.length === 0) return na('No active users found in M365 directory');
      let withMFA = 0;
      for (const u of active) {
        if (hasMfa(m365.mfaMethods.get(String(u.id)) ?? [])) withMFA++;
      }
      const pct = Math.round((withMFA / active.length) * 100);
      return {
        status: pct >= 98 ? 'pass' : pct >= 85 ? 'partial' : 'fail',
        score: pct,
        rawData: { totalUsers: active.length, withMFA },
        notes: `${withMFA}/${active.length} active M365 users have MFA enrolled (${pct}%). SMB1001 requires MFA on all employee email accounts including administrators.`,
      };
    }
    return na('No M365 integration available. Provide manual evidence of MFA enforcement on all email accounts.');
  }],

  // -------------------------------------------------------------------
  // 2.6: MFA on All Business Applications
  // -------------------------------------------------------------------
  ['2.6', (m365) => {
    if (m365) {
      // Check Security Defaults (covers all users and all apps)
      const sd = m365.legacyAuthPolicies[0];
      if (sd?.isEnabled) {
        return {
          status: 'pass', score: 100, rawData: sd,
          notes: 'Microsoft Security Defaults are enabled, enforcing MFA for all users across all Microsoft 365 apps and blocking legacy authentication.',
        };
      }
      // Check for a CA policy requiring MFA for all users / all cloud apps
      // Accepts: state=enabled (full credit) or state=enabledForReportingButNotEnforced (partial credit)
      // For user scope: includeUsers contains 'All' OR includeUsers is empty (some tenants omit it when targeting all)
      const targetsAllUsers = (p: Record<string, unknown>) => {
        const users = (p.conditions as Record<string, Record<string, string[]>>)?.users ?? {};
        const inc = users.includeUsers ?? [];
        return inc.includes('All') || inc.length === 0;
      };
      const mfaForAll = m365.conditionalAccessPolicies.filter((p) =>
        (p.state === 'enabled' || p.state === 'enabledForReportingButNotEnforced') &&
        ((p.grantControls as Record<string, string[]>)?.builtInControls ?? []).includes('mfa') &&
        targetsAllUsers(p as Record<string, unknown>),
      );
      const mfaEnabled = mfaForAll.filter((p) => p.state === 'enabled');
      // Check for legacy auth block
      const legacyBlocked = m365.conditionalAccessPolicies.filter((p) => {
        const ct = (p.conditions as Record<string, unknown>)?.clientAppTypes as string[] ?? [];
        const bc = ((p.grantControls as Record<string, unknown>)?.builtInControls as string[] ?? []);
        return p.state === 'enabled' && (ct.includes('exchangeActiveSync') || ct.includes('other') || ct.includes('mobileAppsAndDesktopClients')) && bc.includes('block');
      });
      const hasMfaPolicy = mfaForAll.length > 0;
      const hasMfaEnforced = mfaEnabled.length > 0;
      const hasLegacyBlock = legacyBlocked.length > 0;
      const status: ResultStatus = hasMfaEnforced && hasLegacyBlock ? 'pass'
        : hasMfaEnforced ? 'partial'
        : hasMfaPolicy ? 'partial'   // report-only mode: some credit
        : 'fail';
      const score = status === 'pass' ? 100 : hasMfaEnforced ? 60 : hasMfaPolicy ? 40 : 0;
      return {
        status,
        score,
        rawData: { mfaPolicies: mfaForAll.length, mfaEnforcedPolicies: mfaEnabled.length, legacyBlockPolicies: legacyBlocked.length },
        notes: hasMfaPolicy
          ? `${mfaForAll.length} Conditional Access policy/policies require MFA for all users${mfaEnabled.length < mfaForAll.length ? ' (some in report-only mode)' : ''}. ${hasLegacyBlock ? 'Legacy authentication is also blocked.' : 'Legacy authentication is NOT blocked — recommend adding a CA block policy for exchangeActiveSync and other legacy clients.'}`
          : 'No Conditional Access policy requiring MFA for all users found, and Security Defaults are not enabled. Enable Security Defaults or create CA policies to enforce MFA across all business applications.',
      };
    }
    return na('No M365 integration available. Provide manual evidence of MFA enforcement across all business applications.');
  }],

  // -------------------------------------------------------------------
  // 2.7: RDP over VPN — manual
  // -------------------------------------------------------------------
  ['2.7', () => manual('Provide evidence that direct RDP (port 3389) is blocked at the firewall and all RDP access routes through VPN or RD Gateway. Include firewall rule screenshots or network topology diagram. Mark as not applicable if RDP is not used.')],

  // -------------------------------------------------------------------
  // 2.8: Cloud Credential and IAM Management — manual
  // -------------------------------------------------------------------
  ['2.8', () => manual('Provide evidence of cloud IAM least-privilege configuration: role/policy assignments, SSH key storage in secrets manager, and MFA enforcement for cloud console users. Include documentation of federated identity setup.')],

  // -------------------------------------------------------------------
  // 2.9: MFA Where Important Data Is Stored
  // -------------------------------------------------------------------
  ['2.9', (m365) => {
    if (m365) {
      const sd = m365.legacyAuthPolicies[0];
      if (sd?.isEnabled) {
        return { status: 'pass', score: 100, rawData: sd, notes: 'Microsoft Security Defaults enforce MFA for all access including cloud storage services.' };
      }
      // Look for CA policies requiring MFA or device compliance for cloud apps
      // Accept enabled and report-only policies (report-only = partial credit)
      const dataProtection = m365.conditionalAccessPolicies.filter((p) => {
        const gc = p.grantControls as Record<string, string[]> ?? {};
        const controls = gc.builtInControls ?? [];
        return (p.state === 'enabled' || p.state === 'enabledForReportingButNotEnforced') &&
          (controls.includes('mfa') || controls.includes('compliantDevice'));
      });
      // Device compliance policies
      const comp = m365.deviceCompliancePolicies.filter((p) => p.state === 'enabled');
      const hasPolicies = dataProtection.length > 0 || comp.length > 0;
      return {
        status: hasPolicies ? 'partial' : 'fail',
        score: hasPolicies ? 70 : 0,
        rawData: { caPolicies: dataProtection.length, compliancePolicies: comp.length },
        notes: hasPolicies
          ? `${dataProtection.length} CA policies and ${comp.length} device compliance policies provide some protection. Manual verification recommended to confirm all data storage systems require MFA.`
          : 'No Conditional Access or device compliance policies found protecting cloud data storage. Enable Security Defaults or create CA policies requiring MFA for all cloud app access.',
      };
    }
    return na('No M365 integration available. Provide manual evidence of MFA on all systems storing important digital data.');
  }],

  // -------------------------------------------------------------------
  // 2.10: MFA on VPN — manual
  // -------------------------------------------------------------------
  ['2.10', () => manual('Provide evidence that MFA is enforced on VPN connections: VPN configuration screenshots showing MFA integration (e.g., RADIUS with MFA, Azure AD integration). Mark as not applicable if VPN is not used.')],

  // -------------------------------------------------------------------
  // 2.11: MFA on RDP — manual
  // -------------------------------------------------------------------
  ['2.11', () => manual('Provide evidence that MFA is enforced on RDP connections: RD Gateway or third-party MFA solution configuration (e.g., Duo for Windows Logon). Mark as not applicable if RDP is not used.')],

  // -------------------------------------------------------------------
  // 2.12: Email Authentication (SPF, DKIM, DMARC)
  // -------------------------------------------------------------------
  ['2.12', (m365) => {
    if (!m365) return na('No M365 integration available. Manually verify SPF, DKIM, and DMARC records for all email-sending domains via DNS lookup tools or your email provider portal.');

    // DKIM check
    if (m365.dkimSettings.length === 0) {
      return manual('DKIM settings could not be retrieved. Verify DKIM configuration in the Microsoft Defender portal > Email & Collaboration > Policies > Email authentication settings.');
    }
    const dkimEnabled = m365.dkimSettings.filter((d) => d.enabled).length;
    const dkimTotal = m365.dkimSettings.length;
    const dkimPct = Math.round((dkimEnabled / dkimTotal) * 100);

    // DMARC and SPF are DNS records — not available via Graph API.
    // Automated check covers DKIM only. DMARC/SPF require manual evidence upload.
    const hasDkim = dkimPct === 100;
    const status: ResultStatus = hasDkim ? 'partial' : 'fail';
    const score = hasDkim ? 60 : dkimPct > 0 ? 30 : 0;

    const notes = [
      `DKIM: ${dkimEnabled}/${dkimTotal} domains enabled (automated check).`,
      !hasDkim && 'Enable DKIM signing for all domains in Microsoft Defender > Email & Collaboration > Policies & Rules > Email authentication settings.',
      'DMARC and SPF cannot be verified via the M365 API. Upload DNS records or a third-party email authentication report as evidence to achieve a full pass for this control.',
    ].filter(Boolean).join(' ');

    return { status, score, rawData: { dkimEnabled, dkimTotal }, notes };
  }],

  // -------------------------------------------------------------------
  // DOMAIN 3: BACKUP AND RECOVERY — manual
  // -------------------------------------------------------------------
  ['3.1', () => manual('Provide backup policy, recent backup job logs (last 30 days), confirmation of at least one offline/isolated backup copy, and evidence of a successful restore test within the last 12 months.')],
  ['3.2', () => manual('Provide a copy of your current cyber liability insurance policy or certificate of currency showing coverage for cyber incidents including incident response support.')],

  // -------------------------------------------------------------------
  // DOMAIN 4: POLICIES, PROCESSES AND PLANS — all manual
  // -------------------------------------------------------------------
  ['4.1', () => manual('Provide your confidentiality agreement template and evidence that all current employees and contractors have signed it (HR records or acknowledgement register).')],
  ['4.2', () => manual('Provide your invoice fraud prevention policy and evidence it has been communicated to all relevant staff. Include examples of dual-authorisation controls for high-value payments.')],
  ['4.3', () => manual('Provide your visitor register (redacted) covering the last 3 months and visitor management procedure. Mark as not applicable if you have no physical office.')],
  ['4.4', () => manual('Provide your cybersecurity policy document with version/review date and evidence that all employees have read and signed it.')],
  ['4.5', () => manual('Provide the incident response plan document with version/review date, contact lists, and evidence of the last tabletop exercise or test. For Level 5, include communication templates and data breach notification guidance.')],
  ['4.6', () => manual('Provide evidence of physical document destruction processes: shredder photos or document destruction service agreement, and procedure documentation.')],
  ['4.7', () => manual('Provide your device disposal policy and records of devices disposed of in the last 12 months including disposal method. Include certificates of data destruction where available.')],
  ['4.8', () => manual('Provide your digital asset register showing all systems that store important/confidential data, data types, owners, and access lists. For Level 5, include personal data inventory and annual review evidence.')],
  ['4.9', () => manual('Provide your supplier risk management policy, evidence of supplier cybersecurity assessments, and examples of supplier contracts with cyber hygiene requirements and incident notification clauses.')],
  ['4.10', () => manual('Provide your personnel vetting policy and evidence (redacted for privacy) that police checks have been completed for all employees and contractors with administrative privileges or controlled access.')],
  ['4.11', () => manual('Provide your AI usage policy document with version/review date and evidence it has been communicated to all staff. Include any AI tool inventory and approved use case list.')],

  // -------------------------------------------------------------------
  // DOMAIN 5: EDUCATION AND TRAINING — manual
  // -------------------------------------------------------------------
  ['5.1', () => manual('Provide training completion records for all current employees showing training date and content. For Level 3+, provide evidence of ongoing training covering phishing, social engineering, BEC, and invoice fraud.')],
  ['5.2', () => manual('Provide evidence of your most recent incident response training exercise (tabletop, functional, or full-scale): exercise report with date, participants, scenarios tested, and lessons learned.')],
]);
