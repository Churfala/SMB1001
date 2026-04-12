-- SMB1001 Audit Platform – Seed Data
-- Migration 002: SMB1001 control catalogue + demo tenant/user

-- ============================================================
-- SMB1001 CONTROLS
-- Based on the Australian Cyber Security Centre SMB1001 standard
-- ============================================================

INSERT INTO controls
  (control_id, name, description, category, severity, validation_type,
   integration_type, evidence_requirements, remediation_guidance, references)
VALUES

-- ---------------------------------------------------------------
-- GOVERN
-- ---------------------------------------------------------------
('GOV-001',
 'Information Security Policy',
 'The organisation has a documented information security policy that is approved by management, communicated to staff, and reviewed at least annually.',
 'Govern',
 'medium',
 'manual',
 'none',
 'Provide a copy of the current information security policy with management sign-off date and last review date.',
 'Develop and document an information security policy covering acceptable use, data classification, access control, incident response, and business continuity. Have it reviewed annually and signed by senior management.',
 ARRAY['ISO 27001:2022 A.5.1', 'NIST CSF GV.PO-01', 'ACSC Essential Eight']),

('GOV-002',
 'Risk Assessment',
 'The organisation conducts a formal information security risk assessment at least annually and documents identified risks, likelihood, impact, and treatment plans.',
 'Govern',
 'high',
 'manual',
 'none',
 'Provide the most recent risk assessment report including risk register, treatment plans, and sign-off date.',
 'Implement a structured risk management process using a recognised framework (e.g., ISO 27005, NIST SP 800-30). Document risks in a risk register and review treatments at least annually.',
 ARRAY['ISO 27001:2022 A.6.1.2', 'NIST CSF ID.RA', 'ACSC ISMS guidance']),

('GOV-003',
 'Security Roles and Responsibilities',
 'Information security roles and responsibilities are clearly defined and assigned. A named individual is accountable for information security.',
 'Govern',
 'medium',
 'manual',
 'none',
 'Provide the organisation chart showing security roles, job descriptions, and evidence of assignment (e.g., role acceptance forms).',
 'Define and document an information security role (e.g., CISO, IT Security Manager). Assign security responsibilities in job descriptions. Conduct annual reviews of role assignments.',
 ARRAY['ISO 27001:2022 A.6.1.1', 'NIST CSF GV.RR']),

('GOV-004',
 'Security Awareness Training',
 'All staff complete security awareness training upon onboarding and at least annually thereafter. Training covers phishing, password hygiene, and incident reporting.',
 'Govern',
 'high',
 'manual',
 'none',
 'Provide training completion records for all current staff showing training date and content covered.',
 'Implement a security awareness training programme using a recognised platform. Track completion rates. Include phishing simulations. Require new-starter training within 30 days of joining.',
 ARRAY['ISO 27001:2022 A.6.3', 'NIST CSF PR.AT', 'ACSC Essential Eight maturity levels']),

('GOV-005',
 'Incident Response Plan',
 'A documented incident response plan exists, is tested at least annually, and includes defined roles, escalation paths, and communication procedures.',
 'Govern',
 'high',
 'manual',
 'none',
 'Provide the incident response plan document, evidence of last test/exercise (e.g., tabletop exercise report), and any post-incident review reports.',
 'Develop an incident response plan based on NIST SP 800-61 or equivalent. Define incident categories, response procedures, escalation contacts, and legal/regulatory notification obligations. Conduct annual tabletop exercises.',
 ARRAY['NIST SP 800-61r2', 'ISO 27001:2022 A.5.26', 'ACSC Cyber Incident Response']),

-- ---------------------------------------------------------------
-- PROTECT – Identity & Access Management
-- ---------------------------------------------------------------
('IAM-001',
 'MFA for Administrator Accounts',
 'Multi-factor authentication (MFA) is enforced for all privileged/administrator accounts across all cloud platforms and services.',
 'Protect',
 'critical',
 'automated',
 'both',
 'Automated check will verify MFA method enrollment for all users with admin directory roles.',
 'Enable MFA for all administrator accounts immediately. In Microsoft 365: enable Security Defaults or create a Conditional Access policy requiring MFA for all admin roles. In Google Workspace: enable 2-Step Verification enforcement for admin accounts in Admin Console > Security > 2-Step Verification.',
 ARRAY['ACSC Essential Eight – MFA', 'NIST SP 800-63B', 'CIS Control 6.3', 'Microsoft Security Benchmark']),

('IAM-002',
 'MFA for All Users',
 'Multi-factor authentication (MFA) is enrolled and enforced for all user accounts, not just administrators.',
 'Protect',
 'critical',
 'automated',
 'both',
 'Automated check will verify MFA enrollment percentage across all active user accounts.',
 'Deploy MFA for all users as a priority. Use push notifications (Authenticator app) or FIDO2 hardware keys where possible. Target 100% coverage; phase out SMS-based MFA where feasible. In M365: use Conditional Access "Require MFA for all users". In Google: enforce 2SV organisation-wide.',
 ARRAY['ACSC Essential Eight – MFA (Maturity Level 2)', 'NIST SP 800-63B AAL2', 'CIS Control 6.3']),

('IAM-003',
 'Privileged Access Restriction',
 'Administrative privileges are limited to the minimum necessary. Global Administrator/Super Admin accounts are restricted to no more than 3–5 named individuals.',
 'Protect',
 'high',
 'automated',
 'both',
 'Automated check will count admin users and compare against total users. Review the list of admin accounts returned in the raw data.',
 'Audit all privileged accounts regularly. Remove admin rights from accounts that do not require them. Use role-based access control (RBAC) with least-privilege roles instead of Global Admin. Implement just-in-time (JIT) access using Privileged Identity Management (PIM) where available.',
 ARRAY['ACSC Essential Eight – Restrict Admin Privileges', 'CIS Control 5', 'NIST SP 800-53 AC-6']),

('IAM-004',
 'Password Policy Enforcement',
 'A strong password policy is enforced, requiring minimum length ≥14 characters, complexity, and prohibition of known-breached passwords.',
 'Protect',
 'high',
 'automated',
 'm365',
 'Automated check will verify Security Defaults or Conditional Access MFA enforcement as a proxy for password policy. Manual review required for on-premise AD password policies.',
 'Enable Microsoft Security Defaults or configure Entra ID Password Protection. Set minimum password length to 14+ characters. Enable leaked credentials detection. Consider passwordless authentication (FIDO2, Windows Hello for Business) as the long-term goal.',
 ARRAY['ACSC Essential Eight – Patch OS', 'NIST SP 800-63B', 'CIS Control 5.2']),

('IAM-005',
 'Legacy Authentication Blocked',
 'Legacy authentication protocols (Basic Auth, NTLM, POP3, IMAP, SMTP AUTH, Exchange ActiveSync with basic auth) are blocked for all users.',
 'Protect',
 'critical',
 'automated',
 'm365',
 'Automated check will verify whether Security Defaults are enabled or a Conditional Access policy blocks legacy authentication client app types.',
 'Block legacy authentication using one of these methods: (1) Enable Microsoft Security Defaults (free, covers all users), or (2) Create a Conditional Access policy targeting "Other clients" and "Exchange ActiveSync" with Grant control = Block. Monitor sign-in logs for legacy auth attempts before blocking to avoid disruption.',
 ARRAY['ACSC Essential Eight – Maturity Level 2', 'Microsoft Security Benchmark', 'CIS Microsoft 365 Benchmark v1.5']),

('IAM-006',
 '2-Step Verification Enforcement (Google)',
 'Organisation-wide 2-Step Verification (2SV) enforcement is enabled in Google Workspace Admin Console.',
 'Protect',
 'critical',
 'automated',
 'google',
 'Automated check will verify whether all active users have 2SV enrolled as a proxy for enforcement.',
 'Navigate to Admin Console > Security > 2-Step Verification. Enable enforcement with an allowance period for existing users (e.g., 1 week). Set minimum 2SV strength to "Authenticator App or Security Key". Consider removing SMS/voice as allowed methods for privileged users.',
 ARRAY['ACSC Essential Eight – MFA', 'CIS Google Workspace Benchmark', 'Google Admin security best practices']),

-- ---------------------------------------------------------------
-- PROTECT – Email & Collaboration Security
-- ---------------------------------------------------------------
('EMAIL-001',
 'Anti-Phishing Policies Configured',
 'Anti-phishing policies are configured and enabled in Microsoft Defender for Office 365 to protect against impersonation and spoofing attacks.',
 'Protect',
 'critical',
 'automated',
 'm365',
 'Automated check will verify presence and enabled status of anti-phishing policies in Defender for Office 365.',
 'Create an anti-phishing policy in Microsoft Defender > Email & Collaboration > Policies > Anti-phishing. Enable: impersonation protection for key users/domains, mailbox intelligence, spoof intelligence, and first-contact safety tips. Requires Microsoft 365 Defender Plan 1 or Plan 2.',
 ARRAY['CIS Microsoft 365 Benchmark v1.5 2.1.7', 'Microsoft Defender for Office 365 documentation']),

('EMAIL-002',
 'Safe Attachments Policy Enabled',
 'Microsoft Defender Safe Attachments policy is enabled to detonate and scan email attachments in a sandbox before delivery.',
 'Protect',
 'high',
 'automated',
 'm365',
 'Automated check will verify presence of Safe Attachments policies in Defender for Office 365.',
 'Enable Safe Attachments in Microsoft Defender > Email & Collaboration > Policies > Safe Attachments. Configure action as "Dynamic Delivery" or "Block" for malicious attachments. Apply policy to all recipients. Requires Microsoft Defender for Office 365 Plan 1.',
 ARRAY['CIS Microsoft 365 Benchmark v1.5 2.1.1', 'Microsoft Defender Safe Attachments']),

('EMAIL-003',
 'Safe Links Policy Enabled',
 'Microsoft Defender Safe Links policy is enabled to rewrite and scan URLs in emails and Office documents in real time.',
 'Protect',
 'high',
 'automated',
 'm365',
 'Automated check will verify presence of Safe Links policies in Defender for Office 365.',
 'Enable Safe Links in Microsoft Defender > Email & Collaboration > Policies > Safe Links. Configure: scan URLs in email, scan URLs in Office apps, do not allow users to click through to original URL. Requires Microsoft Defender for Office 365 Plan 1.',
 ARRAY['CIS Microsoft 365 Benchmark v1.5 2.1.2', 'Microsoft Defender Safe Links']),

('EMAIL-004',
 'DKIM Signing Enabled',
 'DomainKeys Identified Mail (DKIM) signing is configured and enabled for all accepted email domains to prevent email spoofing.',
 'Protect',
 'high',
 'automated',
 'm365',
 'Automated check will retrieve DKIM signing configuration for all domains via Microsoft Graph beta endpoint.',
 'Enable DKIM in the Microsoft Defender portal > Email & Collaboration > Policies > Email authentication settings. Create DKIM keys for each domain and publish the CNAME records in DNS. Verify signing is active by sending a test email and checking headers.',
 ARRAY['CIS Microsoft 365 Benchmark v1.5 2.1.14', 'RFC 6376', 'Microsoft DKIM documentation']),

('EMAIL-005',
 'DMARC Policy Configured',
 'Domain-based Message Authentication, Reporting and Conformance (DMARC) is configured for all email domains with a policy of "quarantine" or "reject".',
 'Protect',
 'high',
 'automated',
 'm365',
 'Automated check will attempt to retrieve DMARC records. Manual DNS verification may be required.',
 'Publish a DMARC TXT record for each domain: _dmarc.yourdomain.com. Start with p=none to monitor, then move to p=quarantine, then p=reject. Include rua/ruf reporting addresses. Use a DMARC analysis service (e.g., dmarcian, Valimail) to review reports.',
 ARRAY['CIS Microsoft 365 Benchmark v1.5 2.1.15', 'RFC 7489', 'ACSC Email Security guidance']),

('EMAIL-006',
 'Mailbox Audit Logging Enabled',
 'Mailbox auditing is enabled for all Exchange Online mailboxes to log actions by owners, delegates, and administrators.',
 'Protect',
 'high',
 'automated',
 'm365',
 'Automated check will verify mailbox audit configuration. Full verification requires Exchange Online PowerShell.',
 'Ensure unified audit logging is enabled in the Microsoft Purview compliance centre. Run in Exchange Online PowerShell: Set-OrganizationConfig -AuditDisabled $false. Verify with: Get-OrganizationConfig | Select AuditDisabled. Audit logs are retained for 90 days (standard) or up to 10 years (with Microsoft 365 E5 or Add-on).',
 ARRAY['CIS Microsoft 365 Benchmark v1.5 3.2.1', 'Microsoft Exchange Online auditing']),

-- ---------------------------------------------------------------
-- PROTECT – Conditional Access
-- ---------------------------------------------------------------
('CA-001',
 'Conditional Access Requires MFA',
 'A Conditional Access policy or Security Defaults enforces MFA for all users when signing into Microsoft 365 services.',
 'Protect',
 'critical',
 'automated',
 'm365',
 'Automated check will verify Security Defaults status or Conditional Access policies that require MFA for All Users.',
 'Option 1 (simple): Enable Microsoft Security Defaults in Entra ID > Overview > Properties > Manage Security Defaults. Option 2 (advanced): Create a Conditional Access policy: Users = All Users, Cloud apps = All cloud apps, Grant = Require MFA. Exclude emergency/break-glass accounts.',
 ARRAY['ACSC Essential Eight – MFA (Maturity Level 2)', 'CIS Microsoft 365 Benchmark v1.5', 'Microsoft Security Benchmark CA-001']),

('CA-002',
 'High-Risk Sign-Ins Blocked',
 'Conditional Access policies using Identity Protection block or require step-up authentication for high-risk sign-in events.',
 'Protect',
 'high',
 'automated',
 'm365',
 'Automated check will look for Conditional Access policies referencing sign-in risk levels of medium or high.',
 'Requires Microsoft Entra ID P2. Create Conditional Access policies: (1) Block sign-ins with High risk, (2) Require MFA for Medium risk. Navigate to: Entra ID > Security > Conditional Access > New Policy > Conditions > Sign-in risk.',
 ARRAY['NIST SP 800-207 Zero Trust', 'CIS Microsoft 365 Benchmark v1.5', 'Microsoft Entra ID Protection']),

('CA-003',
 'Device Compliance Required',
 'Conditional Access policies require devices to be compliant (enrolled in Intune and meeting compliance policies) before accessing corporate resources.',
 'Protect',
 'high',
 'automated',
 'm365',
 'Automated check will verify Conditional Access policies with "Require compliant device" grant control.',
 'Configure Intune device compliance policies for Windows, macOS, iOS, and Android. Create a Conditional Access policy: Grant = Require device to be marked as compliant. Requires Microsoft Intune (included in Microsoft 365 Business Premium and above).',
 ARRAY['ACSC Essential Eight – Patch OS', 'Zero Trust Device Trust', 'CIS Microsoft 365 Benchmark v1.5']),

-- ---------------------------------------------------------------
-- PROTECT – Data & Applications
-- ---------------------------------------------------------------
('DATA-001',
 'External Sharing Restricted',
 'External sharing in SharePoint Online, OneDrive, and Google Drive is restricted. Anonymous link sharing is disabled.',
 'Protect',
 'high',
 'automated',
 'both',
 'Automated check will retrieve SharePoint sharing settings via Graph API or Google Workspace admin settings.',
 'In Microsoft 365 Admin Centre > SharePoint > Policies > Sharing: set SharePoint and OneDrive to "Existing guests" or "Only people in your organisation". Disable anonymous (Anyone) links. In Google Workspace: Admin Console > Apps > Google Workspace > Drive and Docs > Sharing settings: restrict external sharing to trusted domains.',
 ARRAY['ACSC Information Security Manual', 'CIS Microsoft 365 Benchmark v1.5 6.1', 'Google Workspace Admin Help']),

('DATA-002',
 'Data Loss Prevention Policies',
 'Data Loss Prevention (DLP) policies are configured to detect and prevent the exfiltration of sensitive data (e.g., credit card numbers, TFNs, health information).',
 'Protect',
 'high',
 'hybrid',
 'm365',
 'Provide screenshots or exported configuration of active DLP policies, the sensitive information types covered, and policy actions (block/notify/audit).',
 'Configure DLP policies in Microsoft Purview Compliance Centre > Data loss prevention. Create policies for: (1) Australian financial data (TFN, credit cards), (2) Health information, (3) Passport/driver''s licence numbers. Start in audit mode, then switch to block mode after tuning. Requires Microsoft 365 E3/E5 or Microsoft 365 Business Premium.',
 ARRAY['Australian Privacy Act 1988', 'ACSC Information Security Manual', 'Microsoft Purview DLP']),

('DATA-003',
 'Third-Party OAuth App Governance',
 'Third-party applications with OAuth access to Microsoft 365 or Google Workspace data are reviewed, approved, and restricted to necessary permissions.',
 'Protect',
 'high',
 'automated',
 'both',
 'Automated check will enumerate OAuth applications. Review the list of detected applications and confirm legitimate business use.',
 'In Microsoft Entra ID: review Enterprise Applications for third-party apps. Disable user consent for apps (require admin approval). Create an app governance policy. In Google Workspace: Admin Console > Security > API controls > App Access Control: set "Google services" to "Restricted" and review connected apps.',
 ARRAY['ACSC Essential Eight – Application Control', 'CIS Microsoft 365 Benchmark v1.5 1.1.3']),

-- ---------------------------------------------------------------
-- DETECT
-- ---------------------------------------------------------------
('DET-001',
 'Microsoft Secure Score Monitoring',
 'Microsoft Secure Score is reviewed at least monthly and improvement actions are tracked and prioritised.',
 'Detect',
 'medium',
 'automated',
 'm365',
 'Automated check will retrieve current Secure Score. Target score should be ≥70% of maximum.',
 'Review Microsoft Secure Score at https://security.microsoft.com/securescore. Assign improvement actions to responsible owners. Track progress monthly. Aim for a score ≥70% as a baseline. Focus on high-impact, low-effort improvements first.',
 ARRAY['Microsoft Secure Score documentation', 'ACSC Maturity Model']),

('DET-002',
 'Unified Audit Log Retention',
 'The Microsoft 365 unified audit log is enabled and audit data is retained for a minimum of 90 days (standard) or 1 year (recommended for compliance).',
 'Detect',
 'high',
 'automated',
 'm365',
 'Automated check will attempt to verify audit log configuration via Microsoft Graph. Manual verification via Purview recommended.',
 'Verify unified audit log is enabled: Microsoft Purview > Audit > Start recording user and admin activity. For longer retention, assign Microsoft 365 E5 compliance or the Microsoft 365 Audit (Premium) add-on for 1-year or 10-year retention. Configure audit retention policies to retain high-value workloads longer.',
 ARRAY['CIS Microsoft 365 Benchmark v1.5 3.1.1', 'Microsoft 365 Audit documentation', 'ACSC Event Logging']),

('DET-003',
 'Security Alert Policies',
 'Security alert policies are configured in Microsoft Defender / Purview to notify administrators of critical security events such as suspicious sign-ins, malware detection, and privilege escalation.',
 'Detect',
 'high',
 'hybrid',
 'm365',
 'Automated check will enumerate security alert policies. Review the list of enabled policies and confirm critical events are covered.',
 'Review default alert policies in Microsoft Defender > Email & Collaboration > Policies > Alert Policies. Ensure the following are enabled and have notification recipients: (1) Suspicious email forwarding, (2) Elevation of Exchange admin privilege, (3) Mass file download, (4) Malware in email. Configure email notifications for critical alerts.',
 ARRAY['CIS Microsoft 365 Benchmark v1.5 3.3', 'Microsoft 365 Defender Alert policies']),

-- ---------------------------------------------------------------
-- RECOVER
-- ---------------------------------------------------------------
('REC-001',
 'Data Backup and Recovery',
 'Critical data is backed up regularly using a 3-2-1 strategy (3 copies, 2 media types, 1 offsite/cloud). Backups are tested and recovery is verified at least quarterly.',
 'Recover',
 'critical',
 'manual',
 'none',
 'Provide backup policy documentation, backup job logs from the last 30 days, and evidence of a successful restore test (screenshot or report).',
 'Implement a 3-2-1 backup strategy for all critical data including M365/Google data. Use Microsoft 365 Backup (if licensed) or a third-party backup solution (e.g., Veeam, Acronis, Druva). Test restore procedures quarterly. Document RTO and RPO. Store backups in an immutable/offline location to protect against ransomware.',
 ARRAY['ACSC Essential Eight – Regular Backups (Maturity Level 1–3)', 'NIST CSF RC.RP', 'ISO 27001:2022 A.8.13']),

('REC-002',
 'Business Continuity and Disaster Recovery',
 'A Business Continuity Plan (BCP) and Disaster Recovery Plan (DRP) are documented, tested at least annually, and cover critical business systems.',
 'Recover',
 'high',
 'manual',
 'none',
 'Provide the BCP/DRP document, evidence of last test/exercise, defined RTO/RPO targets, and list of critical systems covered.',
 'Develop a BCP and DRP covering: (1) Identification of critical business processes and IT systems, (2) Recovery Time Objectives (RTO) and Recovery Point Objectives (RPO), (3) Failover procedures, (4) Communication plan for staff and customers. Test annually via tabletop exercises or live failover tests.',
 ARRAY['ISO 22301:2019 Business Continuity', 'NIST SP 800-34', 'ACSC Cyber Resilience guidance']);

-- ============================================================
-- SEED TENANTS
-- ============================================================

-- MSP Admin tenant
INSERT INTO tenants (id, name, slug, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'MSP Admin', 'msp-admin', 'active')
ON CONFLICT (slug) DO NOTHING;

-- Example client tenant
INSERT INTO tenants (id, name, slug, status)
VALUES ('00000000-0000-0000-0000-000000000002', 'Acme Corporation', 'acme-corp', 'active')
ON CONFLICT (slug) DO NOTHING;

-- ============================================================
-- SEED ADMIN USER
-- Default credentials: admin@msp.local / Admin1234!
-- Password hash generated with bcrypt rounds=10
-- CHANGE THIS PASSWORD IMMEDIATELY IN PRODUCTION
-- ============================================================
INSERT INTO users (tenant_id, email, password_hash, role, first_name, last_name)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'admin@msp.local',
  '$2b$10$YvKjjrBHQJVHVR5.9F3x5uN3lL0ZRj9dF8Q2gK1wOoX7J8P4uZwGS',
  'admin',
  'MSP',
  'Admin'
)
ON CONFLICT (tenant_id, email) DO NOTHING;

-- Auditor user for Acme Corp (password: Auditor1234!)
INSERT INTO users (tenant_id, email, password_hash, role, first_name, last_name)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  'auditor@acme.local',
  '$2b$10$YvKjjrBHQJVHVR5.9F3x5uN3lL0ZRj9dF8Q2gK1wOoX7J8P4uZwGS',
  'auditor',
  'Jane',
  'Smith'
)
ON CONFLICT (tenant_id, email) DO NOTHING;
