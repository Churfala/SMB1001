-- Migration 009: Replace control catalogue with SMB1001:2026 standard controls
-- Adds tier column, clears all audit data, seeds 39 controls across 5 domains

-- Add tier column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'controls' AND column_name = 'tier'
  ) THEN
    ALTER TABLE controls ADD COLUMN tier INTEGER NOT NULL DEFAULT 1;
  END IF;
END$$;

-- Clear all audit data and controls (development reset)
-- Order matters: evidence → audit_results → audits, then controls
TRUNCATE TABLE evidence CASCADE;
TRUNCATE TABLE audit_results CASCADE;
TRUNCATE TABLE audits CASCADE;
TRUNCATE TABLE controls CASCADE;

-- ============================================================
-- SMB1001:2026 CONTROL CATALOGUE
-- 39 controls across 5 domains and 5 certification tiers
-- Domain 1: Technology Management
-- Domain 2: Access Management
-- Domain 3: Backup and Recovery
-- Domain 4: Policies, Processes and Plans
-- Domain 5: Education and Training
-- ============================================================

INSERT INTO controls
  (control_id, name, description, category, severity, tier,
   validation_type, integration_type, evidence_requirements,
   remediation_guidance, "references")
VALUES

-- ============================================================
-- DOMAIN 1: TECHNOLOGY MANAGEMENT
-- ============================================================

('1.1',
 'Engage IT/MSP Support Specialist',
 'The organisation engages a technical support specialist, Managed Service Provider (MSP), or IT specialist to provide regular and reliable assistance to manage day-to-day IT and cybersecurity requirements. The specialist does not need to be full-time. At Level 4+, a Service Level Agreement (SLA) must be in place with a minimum 8-working-hour incident response time.',
 'Technology Management', 'high', 1, 'manual', 'none',
 'Provide evidence of engagement with an IT/MSP support specialist: contract, SLA or service agreement, and contact details. For Level 4+, provide the SLA document showing the 8-working-hour incident response commitment.',
 'Engage a reputable MSP or IT specialist with cybersecurity expertise. Establish a formal service agreement. At Level 4+, ensure the SLA includes defined response times for cyber incidents. Review the engagement annually.',
 ARRAY['SMB1001:2026 Control 1.1']),

('1.2',
 'Install and Configure a Firewall',
 'A firewall is installed and configured where the organisation network and devices connect to the Internet, including personal devices used for work. All devices should have their firewall enabled and network sharing disabled. Default passwords on firewall/router devices must be changed to complex passphrases. Routers should close unnecessary ports and disable unused services.',
 'Technology Management', 'critical', 1, 'manual', 'none',
 'Provide a firewall configuration report or attestation from your IT provider confirming the firewall is configured securely. Include evidence of changed default passwords and port/service configuration.',
 'Install a business-grade firewall at the network perimeter. Enable host-based firewalls on all workstations and laptops. Change all default router and firewall passwords to strong passphrases. Close unnecessary inbound ports. Engage your IT provider to verify the configuration.',
 ARRAY['SMB1001:2026 Control 1.2']),

('1.3',
 'Antivirus/Anti-Malware on All Devices',
 'Anti-malware solutions are installed and enabled on all organisational devices including workstations, laptops, and mobile devices. For Windows/macOS: actively updated antivirus/anti-malware software is required. For mobile devices (iOS/Android): devices must be configured to use only official app stores with built-in security protections active. All security software must be set to update automatically.',
 'Technology Management', 'critical', 1, 'manual', 'none',
 'Provide evidence of antivirus/anti-malware deployment across all devices: screenshots of installed software, management console reports showing coverage and last update dates for all endpoints.',
 'Deploy a centrally managed endpoint protection platform (EPP) across all workstations, laptops, and servers. Ensure real-time protection is enabled and signature updates are automatic. For mobile devices, configure MDM to enforce app store restrictions. Review coverage monthly.',
 ARRAY['SMB1001:2026 Control 1.3']),

('1.4',
 'Automatic Software Updates and Patches',
 'All software on workstations, laptops, personal devices, and their operating systems are set to update automatically with tested and approved updates and patches. If a specific application cannot auto-update, it must be manually updated at intervals no longer than 3 months.',
 'Technology Management', 'high', 1, 'manual', 'none',
 'Provide evidence of automatic update configuration across all devices: screenshots of Windows Update/macOS Software Update settings, mobile device MDM policy reports showing update enforcement, and patch management console reports.',
 'Enable automatic updates for operating systems and all installed applications. Use a patch management tool (e.g., Microsoft Intune, WSUS, or your RMM platform) to centrally manage and report on patch status. Set critical patches to deploy within 14 days of release. Review patch compliance monthly.',
 ARRAY['SMB1001:2026 Control 1.4']),

('1.5',
 'TLS Certificates on Internet-Facing Websites',
 'Transport Layer Security (TLS) certificates issued by a trusted Certificate Authority are installed on all public internet-facing websites operated by the organisation. All web traffic should be served over HTTPS.',
 'Technology Management', 'high', 2, 'manual', 'none',
 'Provide a list of all public-facing websites and confirm each has a valid TLS certificate. Screenshots of browser padlock icons or SSL checker results (e.g., SSL Labs report) for each domain are acceptable evidence.',
 'Obtain TLS certificates from a trusted Certificate Authority (e.g., Let''s Encrypt, DigiCert). Ensure all HTTP traffic redirects to HTTPS. Enable HSTS headers. Set up automatic certificate renewal to avoid expiry. Audit all public-facing websites annually.',
 ARRAY['SMB1001:2026 Control 1.5']),

('1.6',
 'Server Patching and Maintenance',
 'A regular, documented routine for maintenance, patching, and updating is in place for all servers (on-premise, cloud-hosted, and externally provided web servers). The patching cycle must not exceed 6 months, and critical patches must be applied within 14 days of release. The update program covers the OS and all installed software.',
 'Technology Management', 'high', 2, 'manual', 'none',
 'Provide documentation of your server patching routine: patch management policy, recent patch reports covering the last 6 months, and evidence that critical patches were applied within 14 days. If outsourced, provide written confirmation from the provider.',
 'Implement a formal server patch management process. Use your RMM or cloud provider patching tools (e.g., AWS Systems Manager, Azure Update Management). Document the patching schedule and maintain records of patches applied. For outsourced servers, include patching SLAs in the service agreement.',
 ARRAY['SMB1001:2026 Control 1.6']),

('1.7',
 'Vulnerability Scanning of Internet-Facing Resources',
 'All public internet-facing resources including web servers, APIs, VPN portals, and publicly addressable content are regularly scanned and remediated for malware and known vulnerabilities. Scanning frequency is risk-based: high-risk resources weekly, medium-risk monthly, low-risk quarterly.',
 'Technology Management', 'high', 4, 'manual', 'none',
 'Provide vulnerability scan reports for all internet-facing resources from the last 90 days, showing scan dates, findings, and remediation status. If managed by an external provider, provide their written confirmation of scanning frequency and results.',
 'Deploy a vulnerability scanner (e.g., Tenable Nessus, Qualys, Rapid7) to regularly scan all internet-facing assets. Triage findings by severity and remediate critical/high findings promptly. Maintain a remediation register. Consider engaging a managed vulnerability scanning service.',
 ARRAY['SMB1001:2026 Control 1.7']),

('1.8',
 'Data Encryption at Rest',
 'All important digital data — critical, confidential, sensitive, and personally identifiable information — is encrypted where stored at rest. This includes data on servers, workstations, laptops, external storage, and cloud services. Devices should be encrypted (e.g., BitLocker, FileVault).',
 'Technology Management', 'high', 5, 'manual', 'none',
 'Provide evidence of encryption at rest across all storage: BitLocker/FileVault activation reports for endpoints, cloud storage encryption settings screenshots (e.g., Azure Storage encryption, AWS S3 encryption), and database encryption configuration.',
 'Enable full-disk encryption on all workstations and laptops (BitLocker for Windows, FileVault for macOS). Ensure cloud storage services use encryption at rest (most major providers do by default — verify configuration). Encrypt database backups. Document all storage locations and their encryption status in your digital asset register.',
 ARRAY['SMB1001:2026 Control 1.8']),

('1.9',
 'Application Control (Allowlisting)',
 'Application control is implemented on all workstations and laptops including personal devices used for work. Only approved applications are permitted to execute. Enforcement uses cryptographic hash rules, publisher certificate rules, or path rules. The approved application list is defined and routinely reviewed and maintained.',
 'Technology Management', 'high', 5, 'manual', 'none',
 'Provide evidence of application control implementation: AppLocker or Windows Defender Application Control (WDAC) policy exports, MDM/Intune application control policy configurations, or equivalent evidence for macOS (e.g., Gatekeeper settings, MDM profiles). Include the approved application list.',
 'Implement application control using Windows AppLocker, WDAC, or a third-party solution. Define an approved application list based on business requirements. Use publisher certificate rules where possible for easier maintenance. Test thoroughly before enforcement to avoid blocking legitimate applications. Review and update the approved list quarterly.',
 ARRAY['SMB1001:2026 Control 1.9']),

('1.10',
 'Disable Untrusted Microsoft Office Macros',
 'All untrusted Microsoft Office macros are disabled on all workstations, laptops, and servers including personal devices used for work. Office applications should not be configured to enable all macros. Only digitally signed macros from trusted publishers may be permitted.',
 'Technology Management', 'medium', 5, 'manual', 'none',
 'Provide evidence of macro security settings: Group Policy or Intune policy screenshots showing macro settings for Word, Excel, PowerPoint, and other Office applications. Show that the "Enable all macros" option is NOT selected.',
 'Configure Microsoft Office macro settings via Group Policy or Microsoft Intune. Set macro security to "Disable all macros except digitally signed macros" (recommended) or "Disable all macros with notification". Block macros from files downloaded from the internet using the Attack Surface Reduction rule in Microsoft Defender. Review macro usage to identify any legitimate business macros that require signing.',
 ARRAY['SMB1001:2026 Control 1.10', 'ACSC Essential Eight – Office Macro Settings']),

('1.11',
 'Annual Penetration and Social Engineering Testing',
 'An external service provider or specialist conducts annual penetration testing, vulnerability assessment, and social engineering testing to evaluate the security of the organisation''s IT infrastructure and workforce. Testing includes evaluation of employee susceptibility to phishing, vishing, and physical security control weaknesses.',
 'Technology Management', 'high', 5, 'manual', 'none',
 'Provide the most recent penetration test report from a qualified external provider, dated within the last 12 months. Include the scope of testing, findings summary, and remediation actions taken. Social engineering test results (phishing simulation report) should also be included if conducted separately.',
 'Engage a reputable penetration testing firm (look for CREST, OSCP, or equivalent certifications). Define the scope to include external network, web applications, and social engineering components. Conduct testing annually at minimum, or after significant infrastructure changes. Ensure all critical findings are remediated within 30 days and track progress on medium/low findings.',
 ARRAY['SMB1001:2026 Control 1.11']),

('1.12',
 'Endpoint Detection and Response (EDR)',
 'Endpoint Detection and Response (EDR) software is deployed on all workstations, laptops, and servers. The EDR solution must provide: continuous data collection, behavioural threat detection, automated response (containment/isolation), and investigation/forensics capabilities. Software updates and threat intelligence must be automatic. At Level 5, the EDR must be supported by a Managed Detection and Response (MDR) service with defined SLAs for detection, investigation, and containment.',
 'Technology Management', 'high', 3, 'manual', 'none',
 'Provide evidence of EDR deployment: management console screenshots showing coverage across all endpoints, last update dates, and active status. For Level 5, provide the MDR service agreement including SLA response times for detection, investigation, and containment.',
 'Deploy an EDR solution (e.g., Microsoft Defender for Endpoint, CrowdStrike Falcon, SentinelOne) across all endpoints. Ensure automatic updates for threat intelligence. Configure alerting to notify designated technical contacts. At Level 5, engage a Managed Detection and Response (MDR) provider to monitor and respond to threats 24/7.',
 ARRAY['SMB1001:2026 Control 1.12', 'ACSC Essential Eight – Multi-Factor Authentication']),

-- ============================================================
-- DOMAIN 2: ACCESS MANAGEMENT
-- ============================================================

('2.1',
 'Strong Password Hygiene',
 'Strong password hygiene is maintained across all organisational systems and devices. Passwords for all devices must be reset when first used. Strong, unique, unpredictable passphrases must be used for networking devices, workstations, mobile devices, and servers including personal devices used for work. Passwords must not have appeared in previous data breaches. If password expiry is implemented, passwords must be changed at least annually. After any confirmed cyber incident, passwords must be updated within 30 days.',
 'Access Management', 'high', 1, 'manual', 'none',
 'Provide your organisation''s password policy document, evidence that it is communicated to all staff, and confirmation that default passwords are changed on all new devices. If using Active Directory or a cloud directory, provide screenshots of the password policy configuration.',
 'Document and enforce a formal password policy requiring passphrases of 14+ characters, complexity, and prohibition of breached passwords. Use Microsoft Entra ID Password Protection or equivalent to block weak passwords. Enforce the policy via Active Directory/Entra ID Group Policy or MDM. Consider moving towards passwordless authentication (FIDO2, Windows Hello for Business) as a long-term goal.',
 ARRAY['SMB1001:2026 Control 2.1', 'NIST SP 800-63B']),

('2.2',
 'Restrict Administrative Privileges',
 'Employees that should not install software do not have user accounts with administrative privileges. This includes local user accounts and domain user accounts. Administrative access is limited to the minimum necessary for each role. Global/Super Administrator accounts are restricted to a small number of named individuals.',
 'Access Management', 'critical', 2, 'automated', 'both',
 'Automated check will verify admin role counts via your connected M365 or Google Workspace integration. Manual evidence: provide a list of all users with administrative privileges and justification for each.',
 'Audit all user accounts and remove administrative privileges from any account that does not require them for day-to-day work. Use role-based access control (RBAC) with least-privilege roles. Limit Global Administrator / Super Admin accounts to no more than 3–5 named individuals. Implement just-in-time (JIT) access using Privileged Identity Management (PIM) for M365.',
 ARRAY['SMB1001:2026 Control 2.2', 'ACSC Essential Eight – Restrict Admin Privileges', 'CIS Control 5']),

('2.3',
 'Individual User Accounts',
 'Every employee has their own unique username and password for all organisational workstations, laptops, servers, and cloud-hosted services. Usernames and passwords are never shared between employees.',
 'Access Management', 'high', 2, 'manual', 'none',
 'Provide evidence that all system access is via individual user accounts: user account listing from your directory (M365/Google Admin/Active Directory) showing one account per employee, and confirmation that no generic or shared credentials are in use.',
 'Audit all systems for generic or shared accounts (e.g., "admin@company.com" used by multiple people). Convert shared accounts to individual named accounts. Implement a joiners/movers/leavers process to provision and deprovision accounts promptly. Use a cloud identity provider (M365/Google) as the authoritative source of identity.',
 ARRAY['SMB1001:2026 Control 2.3']),

('2.4',
 'Password Manager for Credential Management',
 'A centrally managed password manager is used by employees to securely store and manage credentials. At Level 2, privileged/admin users are required to use the password manager. At Level 3+, all employees who manage more than one credential are required to use it. The password manager must: require MFA for access, support role-based access control, support auditing of credential access, and enable secure sharing where operationally required.',
 'Access Management', 'high', 2, 'manual', 'none',
 'Provide evidence of password manager deployment: screenshots of the management console showing enrolled users, MFA enforcement, and audit logging configuration. Include your password manager policy.',
 'Deploy an enterprise password manager (e.g., 1Password Business, Bitwarden Teams, Keeper, LastPass Teams). Enforce MFA on the password manager vault. Configure role-based access to shared credential folders. Enable audit logging. Train all users on credential management best practices and phishing awareness. For users with a single corporate identity (M365/Google), use SSO/SAML instead.',
 ARRAY['SMB1001:2026 Control 2.4']),

('2.5',
 'MFA on All Employee Email Accounts',
 'Multi-factor authentication (MFA) or two-step verification is enabled and enforced on all employee email accounts including administrator accounts. At Level 4+, only Authenticator App, hardware token, or U2F device is accepted as the second factor — SMS, voice, and email-based methods must not be used as backup methods.',
 'Access Management', 'critical', 2, 'automated', 'both',
 'Automated check will verify MFA enrollment for all active users in your connected M365 or Google Workspace tenant. Manual evidence: MFA enforcement policy, enrolment report showing percentage of users with MFA enabled.',
 'In Microsoft 365: enable Security Defaults (free) or create a Conditional Access policy requiring MFA for all users. In Google Workspace: enable 2-Step Verification enforcement in Admin Console > Security > 2-Step Verification. Target 100% MFA enrolment. At Level 4+, require Authenticator App or FIDO2 key only and remove SMS as a backup method.',
 ARRAY['SMB1001:2026 Control 2.5', 'ACSC Essential Eight – MFA', 'NIST SP 800-63B AAL2']),

('2.6',
 'MFA on All Business Applications and Social Media',
 'MFA or two-step verification is enabled for all user and administrator accounts on all cloud-hosted business applications and social media accounts used within the organisation. At Level 5, only Authenticator App, hardware token, or U2F device methods are accepted — SMS, voice, and email methods are prohibited.',
 'Access Management', 'critical', 3, 'automated', 'both',
 'Automated check will verify MFA enforcement via Conditional Access policies or Security Defaults in M365, and 2SV enforcement in Google Workspace. Manual evidence: list all cloud business applications with screenshots showing MFA is enabled, and social media account MFA settings.',
 'In Microsoft 365: enable Security Defaults or configure Conditional Access policies requiring MFA for all users across all cloud apps. Block legacy authentication protocols. In Google Workspace: enforce 2SV organisation-wide. For other business applications (CRM, accounting, etc.), enable MFA in each application''s settings. Prioritise applications with access to sensitive data.',
 ARRAY['SMB1001:2026 Control 2.6', 'ACSC Essential Eight – MFA (Maturity Level 2)']),

('2.7',
 'RDP Access Only Over VPN',
 'Remote Desktop Protocol (RDP) is enabled and accessible only over a centrally managed, business-grade VPN or Application-based Proxy (e.g., RD Gateway). All RDP connections are configured with the principle of least privilege. This control is not applicable to organisations that do not use RDP.',
 'Access Management', 'high', 3, 'manual', 'none',
 'Provide evidence that RDP is blocked at the firewall for direct internet access, and that all RDP connections are routed through VPN or RD Gateway. Include firewall rule screenshots or network topology diagram.',
 'Disable direct RDP access (TCP port 3389) from the internet at the firewall. Require all remote desktop access to connect via VPN first, or deploy Remote Desktop Gateway. Restrict RDP access to named users/groups only. Enable Network Level Authentication (NLA) for all RDP connections. Implement MFA on the VPN/gateway.',
 ARRAY['SMB1001:2026 Control 2.7']),

('2.8',
 'Cloud Credential and IAM Management',
 'Identity and Access Management (IAM) configurations for cloud computing services minimise privileges for all accounts including administrators. Remote access cloud credentials (SSH keys) are stored securely, not on user devices. Cloud identity is federated with organisational identity systems where possible. MFA using Authenticator App, hardware token, or U2F device is required for all users with cloud platform console access. SMS, voice, and email methods are prohibited.',
 'Access Management', 'high', 4, 'manual', 'none',
 'Provide evidence of cloud IAM configuration: screenshots of AWS IAM policies or Azure RBAC assignments showing least-privilege principles, SSH key management documentation showing keys are stored in a secrets manager (e.g., AWS Secrets Manager, Azure Key Vault), and MFA enforcement settings for console users.',
 'Review all cloud IAM roles and policies. Remove unnecessary permissions and apply least-privilege principles. Store SSH keys and service account credentials in a secrets manager. Federate cloud identity with Microsoft Entra ID or equivalent. Require MFA (Authenticator App or hardware key) for all cloud console logins. Rotate credentials regularly and audit unused access.',
 ARRAY['SMB1001:2026 Control 2.8', 'NIST SP 800-207 Zero Trust']),

('2.9',
 'MFA Where Important Digital Data Is Stored',
 'MFA or two-step verification is enabled on all digital systems and services where important (critical, sensitive, operational) digital data is stored. This includes all accounts on those systems including administrator accounts. At Level 5, only Authenticator App, hardware token, or U2F device methods are accepted.',
 'Access Management', 'critical', 4, 'automated', 'both',
 'Automated check will verify Conditional Access policies in M365 that require MFA for cloud storage and data services. Manual evidence: list all systems where important data is stored and provide evidence MFA is enabled on each.',
 'Identify all systems where critical/sensitive data is stored (cloud storage, databases, file servers, SharePoint, OneDrive, Google Drive). Ensure MFA is enforced for all access to these systems using Conditional Access (M365) or equivalent policies. Prioritise admin accounts first, then extend to all users.',
 ARRAY['SMB1001:2026 Control 2.9']),

('2.10',
 'MFA on VPN Connections',
 'MFA or two-step verification is enabled on all VPN connections used within the organisation, for connections from both the internet and the corporate network. At Level 5, only Authenticator App, hardware token, or U2F device methods are accepted. This control is not applicable to organisations that do not use VPN.',
 'Access Management', 'high', 4, 'manual', 'none',
 'Provide evidence that MFA is enforced on your VPN: VPN configuration screenshots showing MFA/2FA integration (e.g., RADIUS with MFA, Azure AD integration), or managed VPN vendor documentation showing MFA settings.',
 'Configure your VPN solution to require MFA at authentication. Most business VPNs support RADIUS/LDAP integration with MFA providers. Options include: Cisco AnyConnect with Duo Security, Fortinet FortiGate with FortiAuthenticator, or Azure VPN Gateway with Entra ID conditional access. Test MFA enforcement thoroughly before rollout.',
 ARRAY['SMB1001:2026 Control 2.10']),

('2.11',
 'MFA on RDP Connections',
 'MFA or two-step verification is enabled on all Remote Desktop Protocol (RDP) connections used within the organisation, for connections from both the internet and the corporate network. At Level 5, only Authenticator App, hardware token, or U2F device methods are accepted. This control is not applicable to organisations that do not use RDP.',
 'Access Management', 'high', 4, 'manual', 'none',
 'Provide evidence that MFA is enforced on RDP connections: configuration screenshots of Remote Desktop Gateway with MFA, Azure AD-joined device settings enabling Windows Hello for Business, or third-party MFA solution integration (e.g., Duo for Windows Logon).',
 'Implement MFA for RDP using one of these approaches: (1) Deploy Remote Desktop Gateway with Azure AD / RADIUS MFA integration; (2) Use Duo Security for Windows RDP; (3) Configure Windows Hello for Business on Azure AD-joined devices. Test MFA enforcement on all RDP access paths.',
 ARRAY['SMB1001:2026 Control 2.11']),

('2.12',
 'Email Authentication: SPF, DKIM and DMARC',
 'Email authentication records are configured on all domains used to send organisational email. At Level 2, SPF is required. At Level 3+, SPF, DKIM (minimum 1024-bit keys), and DMARC (p=quarantine or p=reject, with reporting address) are all required. DNS records must be reviewed annually and after major email system changes.',
 'Access Management', 'high', 2, 'automated', 'm365',
 'Automated check will verify DKIM configuration via your M365 integration and DMARC policy. Manual evidence: DNS record screenshots for _dmarc and DKIM CNAME records for each domain, and SPF TXT record.',
 'Configure SPF by publishing a TXT record at your domain root listing all authorised sending services. Enable DKIM signing in Microsoft Defender portal (Email & Collaboration > Policies > Email authentication settings) for each domain. Start DMARC with p=none to monitor, then progress to p=quarantine and finally p=reject. Use a DMARC reporting service (e.g., dmarcian) to analyse reports and identify legitimate senders before enforcement.',
 ARRAY['SMB1001:2026 Control 2.12', 'RFC 7208 SPF', 'RFC 6376 DKIM', 'RFC 7489 DMARC', 'ACSC Email Security']),

-- ============================================================
-- DOMAIN 3: BACKUP AND RECOVERY
-- ============================================================

('3.1',
 'Backup and Recovery Strategy',
 'A strategy to back up important digital data and systems is implemented so they can be recovered in a timely manner. At minimum, at least one offline backup copy must be stored in a secure location logically and/or physically isolated from the business network. At Level 4+, the strategy must include: alignment with the digital asset register, a backup register, a maximum frequency of 7 days between backups, at least 6 months of backup history, and an annual restore test.',
 'Backup and Recovery', 'critical', 1, 'manual', 'none',
 'Provide backup policy documentation, recent backup job logs (last 30 days) showing successful completion, confirmation of at least one offline/isolated backup copy, and evidence of a successful restore test (screenshot or report) within the last 12 months.',
 'Implement a backup solution covering all critical data: Microsoft 365 data (Exchange, SharePoint, OneDrive), on-premise servers, and key business systems. Use a dedicated backup product (e.g., Veeam, Acronis, Druva, Datto) with immutable/offsite storage. Configure daily backups with at least 6 months retention. Test restore procedures at least annually. Document your Recovery Time Objective (RTO) and Recovery Point Objective (RPO).',
 ARRAY['SMB1001:2026 Control 3.1', 'ACSC Essential Eight – Regular Backups', 'NIST CSF RC.RP']),

('3.2',
 'Cyber Liability Insurance',
 'The organisation maintains an organisation risk insurance policy or cyber liability insurance policy that covers cyber risk and can provide assistance, support, and resources to respond to and recover from a cyber incident. This control may be not applicable if cyber liability insurance is not commercially available in the organisation''s country of operation.',
 'Backup and Recovery', 'medium', 3, 'manual', 'none',
 'Provide a copy of your current cyber liability insurance policy or certificate of currency showing coverage for cyber incidents. Include the policy expiry date and a brief summary of coverage (incident response support, business interruption, data breach costs).',
 'Obtain a cyber liability insurance policy from a reputable insurer. Key coverage to look for: incident response support costs, business interruption losses, data breach notification costs, ransomware extortion payments, and third-party liability. Ensure your incident response plan aligns with the insurer''s requirements for incident reporting. Review coverage annually as your business grows.',
 ARRAY['SMB1001:2026 Control 3.2']),

-- ============================================================
-- DOMAIN 4: POLICIES, PROCESSES AND PLANS
-- ============================================================

('4.1',
 'Confidentiality Agreements',
 'All employees, contractors, and third parties are bound by confidentiality obligations before being granted access to organisational data or systems. This can be achieved through direct confidentiality agreements or verifying that existing contracts/terms of service with third-party suppliers contain adequate confidentiality clauses.',
 'Policies, Processes and Plans', 'medium', 2, 'manual', 'none',
 'Provide your confidentiality agreement template, a register or evidence that all current employees/contractors have signed it (e.g., HR records, signed copies), and examples of third-party supplier contracts showing confidentiality clauses.',
 'Develop a standard confidentiality/NDA agreement. Include it in all employment contracts and onboarding processes. Require contractors to sign before commencing work. Review third-party supplier contracts to confirm they contain adequate confidentiality provisions. Store signed agreements securely. Review and update the agreement at least every 2 years.',
 ARRAY['SMB1001:2026 Control 4.1']),

('4.2',
 'Invoice Fraud Prevention Policy',
 'A policy and procedures are implemented to manage invoice fraud (business email compromise targeting payments). Procedures must include: verification methods to validate invoices against services rendered, dual/independent verification for changes to supplier bank account details, and dual sign-off authorisation for transactions exceeding a defined monetary threshold.',
 'Policies, Processes and Plans', 'high', 2, 'manual', 'none',
 'Provide your invoice fraud prevention policy document and evidence it has been communicated to all relevant staff. Include examples of verification procedures in use (e.g., callback verification process, dual authorisation approval records).',
 'Develop a formal invoice fraud policy. Key controls: (1) Verify all requests to change supplier bank account details via phone callback to a known number, not the contact in the email; (2) Implement dual authorisation for all payments above a threshold (e.g., $5,000); (3) Train staff on business email compromise (BEC) recognition; (4) Consider implementing payment verification software or your bank''s payment fraud controls.',
 ARRAY['SMB1001:2026 Control 4.2', 'Australian Cyber Security Centre – Business Email Compromise']),

('4.3',
 'Visitor Register',
 'A register (written or digital) is maintained for all visitors and contractors entering restricted or staff-only areas. The register records full name, organisation, contact details, signature, and check-in time. Records are kept for at least 6 months. Visitors are issued a badge and must return it upon departure. Not applicable to single-person organisations or organisations without a physical office.',
 'Policies, Processes and Plans', 'low', 2, 'manual', 'none',
 'Provide your visitor register (redacted for privacy) covering the last 3 months, visitor badge system photographs or description, and your visitor management procedure.',
 'Implement a visitor management system (paper register or digital solution such as SwipedOn or Envoy). Ensure reception staff understand and follow the process. Issue visitor badges to all visitors and contractors upon sign-in. Escort all visitors in restricted areas. Retain records for 6 months minimum. Review the process annually.',
 ARRAY['SMB1001:2026 Control 4.3']),

('4.4',
 'Cybersecurity Policy',
 'A documented cybersecurity policy defines the organisation''s cybersecurity requirements, responsibilities, and procedures that employees must adhere to as part of their employment. The policy covers required technical controls, acceptable use, and employee responsibilities. All employees are required to read and sign the cybersecurity policy.',
 'Policies, Processes and Plans', 'high', 3, 'manual', 'none',
 'Provide your cybersecurity policy document including version/review date, evidence that all current employees have read and signed it (acknowledgement records), and any related acceptable use policies.',
 'Develop a cybersecurity policy covering: acceptable use of IT systems, password requirements, device security, incident reporting, data classification and handling, remote work security, and consequences of non-compliance. Have it reviewed by legal counsel. Require all employees to read and sign upon employment and annually thereafter. Review and update the policy at least annually.',
 ARRAY['SMB1001:2026 Control 4.4']),

('4.5',
 'Incident Response Plan',
 'A documented incident response plan outlines the key activities and processes for responding to a cyber incident. The plan includes contact details for key employees, service providers, law enforcement, and other support. At Level 5, the plan must also include communication templates/playbooks for customers, staff, and media, and guidance on identifying data exposure and regulatory breach notification obligations.',
 'Policies, Processes and Plans', 'high', 3, 'manual', 'none',
 'Provide the incident response plan document including version/review date, contact lists, and evidence of last test or tabletop exercise. For Level 5, include communication templates and data breach notification guidance.',
 'Develop an incident response plan based on NIST SP 800-61 or ACSC guidance. Key sections: (1) Incident classification criteria; (2) Response team roles and contacts; (3) Escalation procedures; (4) Containment and recovery steps; (5) Communication plan; (6) Regulatory notification obligations (e.g., Australian Privacy Act Notifiable Data Breach scheme). Test the plan annually via tabletop exercise. Update after any incident.',
 ARRAY['SMB1001:2026 Control 4.5', 'NIST SP 800-61r2', 'ACSC Cyber Incident Response']),

('4.6',
 'Physical Document Destruction',
 'Secure methods of physical document destruction are used for all physical documents containing sensitive, private, or confidential data. A document shredder is used or an external document destruction service is engaged.',
 'Policies, Processes and Plans', 'medium', 3, 'manual', 'none',
 'Provide evidence of physical document destruction processes: photos of document shredder(s) in use, service agreement with a document destruction provider, or your physical security/document handling policy describing destruction procedures.',
 'Install cross-cut or micro-cut document shredders in areas where sensitive documents are handled. Alternatively, engage an NAID-certified document destruction service for regular collection and secure destruction. Include document destruction procedures in your physical security policy. Train staff on what documents require secure destruction.',
 ARRAY['SMB1001:2026 Control 4.6']),

('4.7',
 'Secure Device Disposal',
 'All computer devices including external hard drives, USB drives, and removable media that have stored sensitive, private, or confidential data are disposed of securely through permanent destruction or non-recoverable reformatting. Devices to be reused, sold, or given away must have all storage media removed or wiped using a non-recoverable method.',
 'Policies, Processes and Plans', 'medium', 3, 'manual', 'none',
 'Provide your device disposal policy/procedure document, records of devices disposed of in the last 12 months with disposal method, and certificates of destruction from a disposal service if applicable.',
 'Develop a device disposal procedure. Options: (1) Engage a certified IT asset disposal (ITAD) provider who provides certificates of data destruction; (2) Use NIST-approved secure erase tools (e.g., DBAN, Blancco) for drives before disposal; (3) Physically destroy storage media for high-sensitivity data. Track all device disposals in a register. Include disposal requirements in your IT policies.',
 ARRAY['SMB1001:2026 Control 4.7', 'NIST SP 800-88 Guidelines for Media Sanitization']),

('4.8',
 'Digital Asset Register',
 'A digital asset register records where all important, confidential, and sensitive data required to operate the organisation is stored. This covers all servers, cloud-hosted storage services, external media, and relevant workstations/laptops. At Level 5, the register must also identify digital assets containing personal data, list who has access to each asset and system, and include an annual audit to verify accuracy.',
 'Policies, Processes and Plans', 'medium', 3, 'manual', 'none',
 'Provide your digital asset register (spreadsheet or asset management tool export) showing all systems storing important data, their owners, and data types. For Level 5, include the personal data inventory and the access list per asset.',
 'Create a digital asset register using a spreadsheet or asset management tool. For each entry record: system/service name, data types stored, data classification (e.g., confidential, internal, public), hosting location, data owner, and users/roles with access. Align the register with your backup strategy to ensure all critical data is backed up. Review and update annually or when new systems are deployed.',
 ARRAY['SMB1001:2026 Control 4.8']),

('4.9',
 'Digital Trust Program with Suppliers',
 'A risk-based digital trust program covers all suppliers within the organisation''s ecosystem. For suppliers without ISO/IEC 27001 or equivalent certification, the program incorporates minimum cyber hygiene requirements aligned with SMB1001. The program includes a contractual requirement for suppliers to notify the organisation in a timely manner if they experience a cyber incident.',
 'Policies, Processes and Plans', 'medium', 5, 'manual', 'none',
 'Provide your supplier/third-party risk management policy, evidence of supplier cybersecurity assessments (questionnaires or audit results), and examples of supplier contracts containing cyber hygiene requirements and incident notification clauses.',
 'Develop a third-party/supplier risk management framework. Steps: (1) Inventory all suppliers with access to your data or systems; (2) Categorise by risk (high/medium/low based on data access and criticality); (3) For high-risk suppliers: require ISO 27001 certification or complete a cyber hygiene questionnaire aligned with SMB1001; (4) Include cybersecurity requirements and incident notification clauses in all supplier contracts; (5) Review supplier posture annually.',
 ARRAY['SMB1001:2026 Control 4.9']),

('4.10',
 'Police Vetting for Privileged Employees',
 'Police vetting (background checks) are conducted on all employees and contractors with administrative privileges or controlled access, including cleaning contractors and any contractors with regular access to offices outside of work hours.',
 'Policies, Processes and Plans', 'medium', 5, 'manual', 'none',
 'Provide your personnel vetting policy, a register (redacted for privacy) showing that police checks have been completed for all employees with administrative or privileged access, and evidence of how you verify contractor vetting status.',
 'Implement a personnel vetting policy requiring police checks for: (1) All employees with administrator-level IT access; (2) All employees with physical access to server rooms or sensitive areas; (3) Cleaning and maintenance contractors with after-hours access. Use a reputable background check service. Renew checks at defined intervals (e.g., every 3 years for high-risk roles). Maintain records of check dates and outcomes.',
 ARRAY['SMB1001:2026 Control 4.10']),

('4.11',
 'AI Usage Policy',
 'A policy for the responsible and secure use of AI technology is developed, implemented, and maintained. The policy addresses: acceptable use, data governance (privacy and ethics), risk management, security measures to protect AI systems, employee training on responsible AI use, compliance with relevant laws and regulations, and regular review.',
 'Policies, Processes and Plans', 'medium', 3, 'manual', 'none',
 'Provide your AI usage policy document including version/review date, evidence it has been communicated to all staff, and any training materials or records related to responsible AI use.',
 'Develop an AI usage policy covering: (1) Approved AI tools and use cases; (2) Data that must not be entered into AI systems (e.g., personal data, confidential client information); (3) How to validate AI outputs before acting on them; (4) Reporting requirements for AI-related incidents; (5) Review process as AI technology evolves. Reference frameworks: NIST AI Risk Management Framework (AI RMF), ISO/IEC 42001, and guidance from your national cybersecurity agency.',
 ARRAY['SMB1001:2026 Control 4.11', 'NIST AI RMF', 'ISO/IEC 42001']),

-- ============================================================
-- DOMAIN 5: EDUCATION AND TRAINING
-- ============================================================

('5.1',
 'Cybersecurity Awareness Training',
 'Cybersecurity awareness training is conducted for all employees. Training educates employees on cyber threats, their responsibilities to protect the organisation, and how to respond to a cyber incident. Training records are maintained. At Level 3+, training must be ongoing/continuous and cover social engineering, phishing, vishing, email safety, business email compromise, invoice fraud, physical security, and required tools/software. An annual review of cybersecurity policies employees are responsible for is included.',
 'Education and Training', 'high', 1, 'manual', 'none',
 'Provide training completion records for all current employees showing training date, content covered, and staff signatures or completion confirmations. Include a copy of your training materials or the platform used (e.g., KnowBe4, Proofpoint Security Awareness, internal training).',
 'Implement a structured security awareness training programme. Use a dedicated platform (e.g., KnowBe4, Proofpoint Security Awareness Training, Mimecast Awareness Training) for scalability and tracking. Include phishing simulation exercises. At Level 3+, run training continuously throughout the year (monthly modules or quarterly updates). Track completion rates and follow up with non-completers. Include new starters within their first 30 days.',
 ARRAY['SMB1001:2026 Control 5.1', 'ACSC Cyber Security Awareness', 'NIST CSF PR.AT']),

('5.2',
 'Incident Response Training Exercises',
 'Training exercises (red team, blue team, and/or purple team) are conducted with the incident response team at least once per year to ensure the incident response plan is up to date, effective, and can be executed successfully. Engaging an external service provider or specialist to conduct the exercises is recommended.',
 'Education and Training', 'high', 5, 'manual', 'none',
 'Provide evidence of your most recent incident response training exercise: exercise report or summary, date conducted, participants, scenarios tested, and findings/lessons learned. If conducted by an external provider, include their report.',
 'Conduct annual incident response exercises. Options: (1) Tabletop exercise: structured discussion of a simulated incident scenario (most accessible, lowest cost); (2) Functional exercise: actually executing response procedures without disrupting systems; (3) Full-scale exercise: complete simulation with all teams. Engage a cybersecurity consultant to facilitate if internal capability is limited. Document findings and update the incident response plan based on lessons learned.',
 ARRAY['SMB1001:2026 Control 5.2', 'NIST SP 800-84 Guide to Test, Training, and Exercise Programs']);
