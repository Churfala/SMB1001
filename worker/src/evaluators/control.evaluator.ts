export type ResultStatus = 'pass' | 'fail' | 'partial' | 'not_applicable' | 'manual_review';

export interface EvaluationResult {
  status: ResultStatus;
  score: number; // 0–100
  rawData: Record<string, unknown>;
  notes: string;
}

export type EvaluatorFn = () => EvaluationResult;

const manual = (notes: string): EvaluationResult => ({
  status: 'manual_review', score: 0, rawData: {}, notes,
});

const na = (notes: string): EvaluationResult => ({
  status: 'not_applicable', score: 0, rawData: {}, notes,
});


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
  ['2.2', () => na('Provide manual evidence of admin privilege restrictions: user account listing showing role assignments, confirming admin privileges are limited to those who need them.')],

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
  ['2.5', () => na('Provide manual evidence of MFA enforcement on all employee email accounts, including administrators.')],

  // -------------------------------------------------------------------
  // 2.6: MFA on All Business Applications
  // -------------------------------------------------------------------
  ['2.6', () => na('Provide manual evidence of MFA enforcement across all business applications, including evidence of legacy authentication being blocked.')],

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
  ['2.9', () => na('Provide manual evidence of MFA on all systems storing important digital data.')],

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
  ['2.12', () => na('Manually verify SPF, DKIM, and DMARC records for all email-sending domains via DNS lookup tools or your email provider portal.')],

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
