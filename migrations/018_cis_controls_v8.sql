-- Migration 018: CIS Controls v8 safeguards
-- 153 safeguards across 18 Controls, grouped by Implementation Group (IG1=1, IG2=2, IG3=3).
-- IG assignments based on CIS Controls v8 documentation.
-- severity: medium for IG1/IG2, high for IG3.

DO $$
DECLARE
  fw_id UUID;
BEGIN
  SELECT id INTO fw_id FROM frameworks WHERE code = 'CIS-V8';
  IF fw_id IS NULL THEN RAISE EXCEPTION 'CIS-V8 framework not found — run 015_frameworks.sql first'; END IF;

  -- ── Control 1: Inventory and Control of Enterprise Assets ──────────────────
  INSERT INTO controls (framework_id, control_id, name, description, category, tier, severity, validation_type, integration_type, is_active)
  VALUES
    (fw_id, '1.1', 'Establish and Maintain Detailed Enterprise Asset Inventory',
     'Establish and maintain an accurate, detailed, and up-to-date inventory of all enterprise assets with the potential to store or process data.',
     'Inventory and Control of Enterprise Assets', 1, 'medium', 'manual', 'none', true),
    (fw_id, '1.2', 'Address Unauthorized Assets',
     'Ensure that unauthorized assets are either removed from the network, quarantined, or the inventory is updated in a timely manner.',
     'Inventory and Control of Enterprise Assets', 1, 'medium', 'manual', 'none', true),
    (fw_id, '1.3', 'Utilize an Active Discovery Tool',
     'Utilize an active discovery tool to identify assets connected to the enterprise''s network.',
     'Inventory and Control of Enterprise Assets', 2, 'medium', 'manual', 'none', true),
    (fw_id, '1.4', 'Use DHCP Logging to Update Enterprise Asset Inventory',
     'Use Dynamic Host Configuration Protocol (DHCP) logging on all DHCP servers or IP address management tools to update the enterprise''s asset inventory.',
     'Inventory and Control of Enterprise Assets', 2, 'medium', 'manual', 'none', true),
    (fw_id, '1.5', 'Use a Passive Asset Discovery Tool',
     'Use a passive discovery tool to identify assets connected to the enterprise''s network.',
     'Inventory and Control of Enterprise Assets', 3, 'high', 'manual', 'none', true)
  ON CONFLICT (framework_id, control_id) DO NOTHING;

  -- ── Control 2: Inventory and Control of Software Assets ───────────────────
  INSERT INTO controls (framework_id, control_id, name, description, category, tier, severity, validation_type, integration_type, is_active)
  VALUES
    (fw_id, '2.1', 'Establish and Maintain a Software Inventory',
     'Establish and maintain a detailed inventory of all licensed software installed on enterprise assets.',
     'Inventory and Control of Software Assets', 1, 'medium', 'manual', 'none', true),
    (fw_id, '2.2', 'Ensure Authorized Software is Currently Supported',
     'Ensure that only currently supported software is designated as authorized in the software inventory for enterprise assets.',
     'Inventory and Control of Software Assets', 1, 'medium', 'manual', 'none', true),
    (fw_id, '2.3', 'Address Unauthorized Software',
     'Ensure that unauthorized software is either removed or the inventory is updated in a timely manner.',
     'Inventory and Control of Software Assets', 1, 'medium', 'manual', 'none', true),
    (fw_id, '2.4', 'Utilize Automated Software Inventory Tools',
     'Utilize software inventory tools to automate the discovery and documentation of installed software on enterprise assets.',
     'Inventory and Control of Software Assets', 2, 'medium', 'manual', 'none', true),
    (fw_id, '2.5', 'Allowlist Authorized Software',
     'Use technical controls, such as application allowlisting, to ensure that only authorized software can execute or be accessed.',
     'Inventory and Control of Software Assets', 2, 'medium', 'manual', 'none', true),
    (fw_id, '2.6', 'Allowlist Authorized Libraries',
     'Use technical controls to ensure that only authorized software libraries are loaded and executed by applications.',
     'Inventory and Control of Software Assets', 2, 'medium', 'manual', 'none', true),
    (fw_id, '2.7', 'Allowlist Authorized Scripts',
     'Use technical controls, such as digital signatures and version control, to ensure that only authorized scripts are run.',
     'Inventory and Control of Software Assets', 3, 'high', 'manual', 'none', true)
  ON CONFLICT (framework_id, control_id) DO NOTHING;

  -- ── Control 3: Data Protection ────────────────────────────────────────────
  INSERT INTO controls (framework_id, control_id, name, description, category, tier, severity, validation_type, integration_type, is_active)
  VALUES
    (fw_id, '3.1', 'Establish and Maintain a Data Management Process',
     'Establish and maintain a data management process including data classification, data ownership, handling, retention, and deletion.',
     'Data Protection', 1, 'medium', 'manual', 'none', true),
    (fw_id, '3.2', 'Establish and Maintain a Data Inventory',
     'Establish and maintain a data inventory based on the enterprise''s data management process.',
     'Data Protection', 1, 'medium', 'manual', 'none', true),
    (fw_id, '3.3', 'Configure Data Access Control Lists',
     'Configure data access control lists based on a user''s need to know. Apply data access control lists, also known as access permissions, to local and remote file systems, databases, and applications.',
     'Data Protection', 1, 'medium', 'manual', 'none', true),
    (fw_id, '3.4', 'Enforce Data Retention',
     'Retain data according to the enterprise''s data management process. Data retention must include both minimum and maximum timelines.',
     'Data Protection', 1, 'medium', 'manual', 'none', true),
    (fw_id, '3.5', 'Securely Dispose of Data',
     'Securely dispose of data as outlined in the enterprise''s data management process. Ensure the disposal process and method are commensurate with the data sensitivity.',
     'Data Protection', 1, 'medium', 'manual', 'none', true),
    (fw_id, '3.6', 'Encrypt Data on End-User Devices',
     'Encrypt data on end-user devices containing sensitive data. Example implementations can include Windows BitLocker, Apple FileVault, Linux dm-crypt.',
     'Data Protection', 2, 'medium', 'manual', 'none', true),
    (fw_id, '3.7', 'Establish and Maintain a Data Classification Scheme',
     'Establish and maintain an overall data classification scheme for the enterprise. Enterprises may use labels such as "Sensitive", "Confidential" and "Public".',
     'Data Protection', 2, 'medium', 'manual', 'none', true),
    (fw_id, '3.8', 'Document Data Flows',
     'Document data flows. Data flow documentation includes service provider data flows and should be based on the enterprise''s data management process.',
     'Data Protection', 2, 'medium', 'manual', 'none', true),
    (fw_id, '3.9', 'Encrypt Data on Removable Media',
     'Encrypt data on removable media. Example implementations can include whole disk encryption.',
     'Data Protection', 2, 'medium', 'manual', 'none', true),
    (fw_id, '3.10', 'Encrypt Sensitive Data in Transit',
     'Encrypt sensitive data in transit. Use only up-to-date and approved standards such as TLS 1.2 or higher.',
     'Data Protection', 2, 'medium', 'manual', 'none', true),
    (fw_id, '3.11', 'Encrypt Sensitive Data at Rest',
     'Encrypt sensitive data at rest on servers, applications, and databases containing sensitive data.',
     'Data Protection', 2, 'medium', 'manual', 'none', true),
    (fw_id, '3.12', 'Segment Data Processing and Storage Based on Sensitivity',
     'Segment data processing and storage based on the sensitivity of the data. Do not process sensitive data on enterprise assets intended for lower sensitivity data.',
     'Data Protection', 3, 'high', 'manual', 'none', true),
    (fw_id, '3.13', 'Deploy a Data Loss Prevention Solution',
     'Implement an automated tool, such as a host-based Data Loss Prevention (DLP) tool, to identify all sensitive data stored, processed, or transmitted through enterprise assets.',
     'Data Protection', 3, 'high', 'manual', 'none', true),
    (fw_id, '3.14', 'Log Sensitive Data Access',
     'Log sensitive data access, including modification and disposal.',
     'Data Protection', 3, 'high', 'manual', 'none', true)
  ON CONFLICT (framework_id, control_id) DO NOTHING;

  -- ── Control 4: Secure Configuration of Enterprise Assets and Software ──────
  INSERT INTO controls (framework_id, control_id, name, description, category, tier, severity, validation_type, integration_type, is_active)
  VALUES
    (fw_id, '4.1', 'Establish and Maintain a Secure Configuration Process',
     'Establish and maintain a secure configuration process for enterprise assets and software.',
     'Secure Configuration of Enterprise Assets and Software', 1, 'medium', 'manual', 'none', true),
    (fw_id, '4.2', 'Establish and Maintain a Secure Configuration Process for Network Infrastructure',
     'Establish and maintain a secure configuration process for network devices.',
     'Secure Configuration of Enterprise Assets and Software', 1, 'medium', 'manual', 'none', true),
    (fw_id, '4.3', 'Configure Automatic Session Locking on Enterprise Assets',
     'Configure automatic session locking on enterprise assets after a defined period of inactivity.',
     'Secure Configuration of Enterprise Assets and Software', 1, 'medium', 'manual', 'none', true),
    (fw_id, '4.4', 'Implement and Manage a Firewall on Servers',
     'Implement and manage a firewall on servers, where supported. Example implementations include a virtual firewall, operating system firewall, or a third-party firewall agent.',
     'Secure Configuration of Enterprise Assets and Software', 1, 'medium', 'manual', 'none', true),
    (fw_id, '4.5', 'Implement and Manage a Firewall on End-User Devices',
     'Implement and manage a host-based firewall or port-filtering tool on end-user devices.',
     'Secure Configuration of Enterprise Assets and Software', 1, 'medium', 'manual', 'none', true),
    (fw_id, '4.6', 'Securely Manage Enterprise Assets and Software',
     'Securely manage enterprise assets and software. Use only up-to-date and trusted management interfaces.',
     'Secure Configuration of Enterprise Assets and Software', 1, 'medium', 'manual', 'none', true),
    (fw_id, '4.7', 'Manage Default Accounts on Enterprise Assets and Software',
     'Manage default accounts on enterprise assets and software, such as root, administrator, and other pre-configured vendor accounts.',
     'Secure Configuration of Enterprise Assets and Software', 1, 'medium', 'manual', 'none', true),
    (fw_id, '4.8', 'Uninstall or Disable Unnecessary Services on Enterprise Assets and Software',
     'Uninstall or disable unnecessary services on enterprise assets and software, such as an unused file sharing service, web application module, or service function.',
     'Secure Configuration of Enterprise Assets and Software', 2, 'medium', 'manual', 'none', true),
    (fw_id, '4.9', 'Configure Trusted DNS Servers on Enterprise Assets',
     'Configure trusted DNS servers on enterprise assets. Example implementations include configuring assets to use enterprise-controlled DNS servers and/or reputable externally accessible DNS servers.',
     'Secure Configuration of Enterprise Assets and Software', 2, 'medium', 'manual', 'none', true),
    (fw_id, '4.10', 'Enforce Automatic Device Lockout on Portable End-User Devices',
     'Enforce automatic device lockout following a predetermined threshold of local failed authentication attempts on portable end-user devices.',
     'Secure Configuration of Enterprise Assets and Software', 2, 'medium', 'manual', 'none', true),
    (fw_id, '4.11', 'Enforce Remote Wipe Capability on Portable End-User Devices',
     'Remotely wipe enterprise data from enterprise-owned portable end-user devices when deemed appropriate such as lost or stolen devices or when an individual no longer supports the enterprise.',
     'Secure Configuration of Enterprise Assets and Software', 2, 'medium', 'manual', 'none', true),
    (fw_id, '4.12', 'Separate Enterprise Workspaces on Mobile End-User Devices',
     'Ensure separate enterprise workspaces are used on mobile end-user devices, where supported.',
     'Secure Configuration of Enterprise Assets and Software', 3, 'high', 'manual', 'none', true)
  ON CONFLICT (framework_id, control_id) DO NOTHING;

  -- ── Control 5: Account Management ─────────────────────────────────────────
  INSERT INTO controls (framework_id, control_id, name, description, category, tier, severity, validation_type, integration_type, is_active)
  VALUES
    (fw_id, '5.1', 'Establish and Maintain an Inventory of Accounts',
     'Establish and maintain an inventory of all accounts managed in the enterprise.',
     'Account Management', 1, 'medium', 'manual', 'none', true),
    (fw_id, '5.2', 'Use Unique Passwords',
     'Use unique passwords for all enterprise assets. Best practice implementation includes at least an 8-character password for accounts using MFA and a 14-character password for accounts not using MFA.',
     'Account Management', 1, 'medium', 'manual', 'none', true),
    (fw_id, '5.3', 'Disable Dormant Accounts',
     'Delete or disable any dormant accounts after a period of 45 days of inactivity, where supported.',
     'Account Management', 1, 'medium', 'manual', 'none', true),
    (fw_id, '5.4', 'Restrict Administrator Privileges to Dedicated Administrator Accounts',
     'Restrict administrator privileges to dedicated administrator accounts on enterprise assets.',
     'Account Management', 1, 'medium', 'manual', 'none', true),
    (fw_id, '5.5', 'Establish and Maintain an Inventory of Service Accounts',
     'Establish and maintain an inventory of service accounts. The inventory, at a minimum, must contain department owner, review date, and purpose.',
     'Account Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '5.6', 'Centralize Account Management',
     'Centralize account management through a directory or identity service.',
     'Account Management', 3, 'high', 'manual', 'none', true)
  ON CONFLICT (framework_id, control_id) DO NOTHING;

  -- ── Control 6: Access Control Management ──────────────────────────────────
  INSERT INTO controls (framework_id, control_id, name, description, category, tier, severity, validation_type, integration_type, is_active)
  VALUES
    (fw_id, '6.1', 'Establish an Access Granting Process',
     'Establish and follow a process, preferably automated, for granting access to enterprise assets upon new hire, rights grant, or role change of a user.',
     'Access Control Management', 1, 'medium', 'manual', 'none', true),
    (fw_id, '6.2', 'Establish an Access Revoking Process',
     'Establish and follow a process, preferably automated, for revoking access to enterprise assets, through disabling accounts immediately upon termination.',
     'Access Control Management', 1, 'medium', 'manual', 'none', true),
    (fw_id, '6.3', 'Require MFA for Externally-Exposed Applications',
     'Require all externally-exposed enterprise or third-party applications to enforce MFA, where supported.',
     'Access Control Management', 1, 'medium', 'manual', 'none', true),
    (fw_id, '6.4', 'Require MFA for Remote Network Access',
     'Require MFA for remote network access.',
     'Access Control Management', 1, 'medium', 'manual', 'none', true),
    (fw_id, '6.5', 'Require MFA for Administrative Access',
     'Require MFA for all administrative access accounts, where supported, on all enterprise assets, whether managed on-site or through a third-party provider.',
     'Access Control Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '6.6', 'Establish and Maintain an Inventory of Authentication and Authorization Systems',
     'Establish and maintain an inventory of the enterprise''s authentication and authorization systems, including those hosted on-site or at a remote service provider.',
     'Access Control Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '6.7', 'Centralize Access Control',
     'Centralize access control for all enterprise assets through a directory service or SSO provider, where supported.',
     'Access Control Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '6.8', 'Define and Maintain Role-Based Access Control',
     'Define and maintain role-based access control, through determining and documenting the access rights necessary for each role within the enterprise to successfully carry out its assigned duties.',
     'Access Control Management', 3, 'high', 'manual', 'none', true)
  ON CONFLICT (framework_id, control_id) DO NOTHING;

  -- ── Control 7: Continuous Vulnerability Management ────────────────────────
  INSERT INTO controls (framework_id, control_id, name, description, category, tier, severity, validation_type, integration_type, is_active)
  VALUES
    (fw_id, '7.1', 'Establish and Maintain a Vulnerability Management Process',
     'Establish and maintain a documented vulnerability management process for enterprise assets. Review and update documentation annually, or when significant enterprise changes occur.',
     'Continuous Vulnerability Management', 1, 'medium', 'manual', 'none', true),
    (fw_id, '7.2', 'Establish and Maintain a Remediation Process',
     'Establish and maintain a risk-based remediation strategy documented in a remediation process, with monthly or more frequent reviews.',
     'Continuous Vulnerability Management', 1, 'medium', 'manual', 'none', true),
    (fw_id, '7.3', 'Perform Automated Operating System Patch Management',
     'Perform operating system updates on enterprise assets through automated patch management on a monthly, or more frequent, cadence.',
     'Continuous Vulnerability Management', 1, 'medium', 'manual', 'none', true),
    (fw_id, '7.4', 'Perform Automated Application Patch Management',
     'Perform application updates on enterprise assets through automated patch management on a monthly, or more frequent, cadence.',
     'Continuous Vulnerability Management', 1, 'medium', 'manual', 'none', true),
    (fw_id, '7.5', 'Perform Automated Vulnerability Scans of Internal Enterprise Assets',
     'Perform automated vulnerability scans of internal enterprise assets on a quarterly, or more frequent, cadence.',
     'Continuous Vulnerability Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '7.6', 'Perform Automated Vulnerability Scans of Externally-Exposed Enterprise Assets',
     'Perform automated vulnerability scans of externally exposed enterprise assets using a SCAP-compliant vulnerability scanning tool.',
     'Continuous Vulnerability Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '7.7', 'Remediate Detected Vulnerabilities',
     'Remediate detected vulnerabilities in software through processes and tooling on a monthly, or more frequent, cadence.',
     'Continuous Vulnerability Management', 2, 'medium', 'manual', 'none', true)
  ON CONFLICT (framework_id, control_id) DO NOTHING;

  -- ── Control 8: Audit Log Management ───────────────────────────────────────
  INSERT INTO controls (framework_id, control_id, name, description, category, tier, severity, validation_type, integration_type, is_active)
  VALUES
    (fw_id, '8.1', 'Establish and Maintain an Audit Log Management Process',
     'Establish and maintain an audit log management process that defines the enterprise''s logging requirements.',
     'Audit Log Management', 1, 'medium', 'manual', 'none', true),
    (fw_id, '8.2', 'Collect Audit Logs',
     'Collect audit logs. Ensure that logging, per the enterprise''s audit log management process, has been enabled across enterprise assets.',
     'Audit Log Management', 1, 'medium', 'manual', 'none', true),
    (fw_id, '8.3', 'Ensure Adequate Audit Log Storage',
     'Ensure that logging destinations maintain adequate storage to comply with the enterprise''s audit log management process.',
     'Audit Log Management', 1, 'medium', 'manual', 'none', true),
    (fw_id, '8.4', 'Standardize Time Synchronization',
     'Standardize time synchronization. Configure at least two synchronized time sources across enterprise assets, where supported.',
     'Audit Log Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '8.5', 'Collect Detailed Audit Logs',
     'Configure detailed audit logging for enterprise assets containing sensitive data. Include event source, date, username, timestamp, source addresses, destination addresses, and other useful elements.',
     'Audit Log Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '8.6', 'Collect DNS Query Audit Logs',
     'Collect DNS query audit logs on enterprise assets, where appropriate and supported.',
     'Audit Log Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '8.7', 'Collect URL Request Audit Logs',
     'Collect URL request audit logs on enterprise assets, where appropriate and supported.',
     'Audit Log Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '8.8', 'Collect Command-Line Audit Logs',
     'Collect command-line audit logs on enterprise assets. Example implementations include collecting audit logs from PowerShell, BASH, and remote administrative terminals.',
     'Audit Log Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '8.9', 'Centralize Audit Logs',
     'Centralize, to the extent possible, audit log collection and retention across enterprise assets.',
     'Audit Log Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '8.10', 'Retain Audit Logs',
     'Retain audit logs across enterprise assets for a minimum of 90 days.',
     'Audit Log Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '8.11', 'Conduct Audit Log Reviews',
     'Conduct reviews of audit logs to detect anomalies or abnormal events that could indicate a potential threat.',
     'Audit Log Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '8.12', 'Collect Service Provider Logs',
     'Collect service provider logs, where supported. Example implementations include collecting authentication and authorization events, data creation and disposal events, and user management events.',
     'Audit Log Management', 3, 'high', 'manual', 'none', true)
  ON CONFLICT (framework_id, control_id) DO NOTHING;

  -- ── Control 9: Email and Web Browser Protections ──────────────────────────
  INSERT INTO controls (framework_id, control_id, name, description, category, tier, severity, validation_type, integration_type, is_active)
  VALUES
    (fw_id, '9.1', 'Ensure Use of Only Fully Supported Browsers and Email Clients',
     'Ensure only fully supported browsers and email clients are allowed to execute in the enterprise, only using the latest version of browsers and email clients provided through the vendor.',
     'Email and Web Browser Protections', 1, 'medium', 'manual', 'none', true),
    (fw_id, '9.2', 'Use DNS Filtering Services',
     'Use DNS filtering services on all enterprise assets to block access to known malicious domains.',
     'Email and Web Browser Protections', 1, 'medium', 'manual', 'none', true),
    (fw_id, '9.3', 'Maintain and Enforce Network-Based URL Filters',
     'Enforce and update network-based URL filters to limit an enterprise asset from connecting to potentially malicious or unapproved websites.',
     'Email and Web Browser Protections', 2, 'medium', 'manual', 'none', true),
    (fw_id, '9.4', 'Restrict Unnecessary or Unauthorized Browser and Email Client Extensions',
     'Restrict, either through uninstalling or disabling, any unauthorized or unnecessary browser or email client plugins, extensions, and add-on applications.',
     'Email and Web Browser Protections', 2, 'medium', 'manual', 'none', true),
    (fw_id, '9.5', 'Implement DMARC',
     'To lower the chance of spoofed or modified emails from valid domains, implement DMARC policy and verification, starting with implementing the Sender Policy Framework (SPF) and the DomainKeys Identified Mail (DKIM) standards.',
     'Email and Web Browser Protections', 2, 'medium', 'manual', 'none', true),
    (fw_id, '9.6', 'Block Unnecessary File Types',
     'Block unnecessary file types attempting to enter the enterprise''s email gateway.',
     'Email and Web Browser Protections', 2, 'medium', 'manual', 'none', true),
    (fw_id, '9.7', 'Deploy and Maintain Email Server Anti-Malware Protections',
     'Deploy and maintain email server anti-malware protections, such as attachment scanning and/or sandboxing.',
     'Email and Web Browser Protections', 2, 'medium', 'manual', 'none', true)
  ON CONFLICT (framework_id, control_id) DO NOTHING;

  -- ── Control 10: Malware Defenses ──────────────────────────────────────────
  INSERT INTO controls (framework_id, control_id, name, description, category, tier, severity, validation_type, integration_type, is_active)
  VALUES
    (fw_id, '10.1', 'Deploy and Maintain Anti-Malware Software',
     'Deploy and maintain anti-malware software on all enterprise assets.',
     'Malware Defenses', 1, 'medium', 'manual', 'none', true),
    (fw_id, '10.2', 'Configure Automatic Anti-Malware Signature Updates',
     'Configure automatic updates for anti-malware signature files on all enterprise assets.',
     'Malware Defenses', 1, 'medium', 'manual', 'none', true),
    (fw_id, '10.3', 'Disable Autorun and Autoplay for Removable Media',
     'Disable autorun and autoplay auto-execute functionality for removable media.',
     'Malware Defenses', 1, 'medium', 'manual', 'none', true),
    (fw_id, '10.4', 'Configure Automatic Anti-Malware Scanning of Removable Media',
     'Configure anti-malware software to automatically scan removable media.',
     'Malware Defenses', 2, 'medium', 'manual', 'none', true),
    (fw_id, '10.5', 'Enable Anti-Exploitation Features',
     'Enable anti-exploitation features on enterprise assets and software, where possible, such as Microsoft Data Execution Prevention (DEP), Windows Defender Exploit Guard (WDEG), or Apple System Integrity Protection (SIP) and Gatekeeper.',
     'Malware Defenses', 2, 'medium', 'manual', 'none', true),
    (fw_id, '10.6', 'Centrally Manage Anti-Malware Software',
     'Centrally manage anti-malware software.',
     'Malware Defenses', 2, 'medium', 'manual', 'none', true),
    (fw_id, '10.7', 'Use Behavior-Based Anti-Malware Software',
     'Use behavior-based anti-malware software.',
     'Malware Defenses', 3, 'high', 'manual', 'none', true)
  ON CONFLICT (framework_id, control_id) DO NOTHING;

  -- ── Control 11: Data Recovery ─────────────────────────────────────────────
  INSERT INTO controls (framework_id, control_id, name, description, category, tier, severity, validation_type, integration_type, is_active)
  VALUES
    (fw_id, '11.1', 'Establish and Maintain a Data Recovery Process',
     'Establish and maintain a data recovery process. In the process, address the scope of data recovery activities, recovery prioritization, and the security of backup data.',
     'Data Recovery', 1, 'medium', 'manual', 'none', true),
    (fw_id, '11.2', 'Perform Automated Backups',
     'Perform automated backups of in-scope enterprise assets. Run backups weekly, or more frequently, based on the sensitivity of the data.',
     'Data Recovery', 1, 'medium', 'manual', 'none', true),
    (fw_id, '11.3', 'Protect Recovery Data',
     'Protect recovery data with equivalent controls to the original data. Reference encryption or data separation, based on technology.',
     'Data Recovery', 1, 'medium', 'manual', 'none', true),
    (fw_id, '11.4', 'Establish and Maintain an Isolated Instance of Recovery Data',
     'Establish and maintain an isolated instance of recovery data. Example implementations include version controlling backup destinations through offline backups or off-site cloud backups.',
     'Data Recovery', 2, 'medium', 'manual', 'none', true),
    (fw_id, '11.5', 'Test Data Recovery',
     'Test backup recovery quarterly, or more frequently, for a sampling of in-scope enterprise assets.',
     'Data Recovery', 2, 'medium', 'manual', 'none', true)
  ON CONFLICT (framework_id, control_id) DO NOTHING;

  -- ── Control 12: Network Infrastructure Management ─────────────────────────
  INSERT INTO controls (framework_id, control_id, name, description, category, tier, severity, validation_type, integration_type, is_active)
  VALUES
    (fw_id, '12.1', 'Ensure Network Infrastructure is Up-to-Date',
     'Ensure network infrastructure is kept up-to-date. Example implementations include running the latest stable release of software and/or using currently supported network-as-a-service offerings.',
     'Network Infrastructure Management', 1, 'medium', 'manual', 'none', true),
    (fw_id, '12.2', 'Establish and Maintain a Secure Network Architecture',
     'Establish and maintain a secure network architecture. A secure network architecture must address segmentation, least privilege, and availability, at a minimum.',
     'Network Infrastructure Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '12.3', 'Securely Manage Network Infrastructure',
     'Securely manage network infrastructure. Example implementations include version-controlled-infrastructure-as-code, and the use of secure network protocols.',
     'Network Infrastructure Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '12.4', 'Establish and Maintain Architecture Diagram(s)',
     'Establish and maintain architecture diagram(s) and/or other network system documentation. Review and update documentation annually, or when significant enterprise changes occur.',
     'Network Infrastructure Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '12.5', 'Centralize Network Authentication, Authorization, and Auditing (AAA)',
     'Centralize network AAA.',
     'Network Infrastructure Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '12.6', 'Use Secure Network Management and Communication Protocols',
     'Use secure network management and communication protocols (e.g., 802.1X, Wi-Fi Protected Access 2 (WPA2) Enterprise or greater).',
     'Network Infrastructure Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '12.7', 'Ensure Remote Devices Utilize a VPN and Connect to AAA Infrastructure',
     'Require users to authenticate to enterprise-managed VPN and authentication infrastructure prior to accessing enterprise resources on end-user devices.',
     'Network Infrastructure Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '12.8', 'Establish and Maintain Dedicated Computing Resources for All Administrative Work',
     'Establish and maintain dedicated computing resources, either physically or logically separated, for all administrative tasks or tasks requiring administrative access.',
     'Network Infrastructure Management', 3, 'high', 'manual', 'none', true)
  ON CONFLICT (framework_id, control_id) DO NOTHING;

  -- ── Control 13: Network Monitoring and Defense ────────────────────────────
  INSERT INTO controls (framework_id, control_id, name, description, category, tier, severity, validation_type, integration_type, is_active)
  VALUES
    (fw_id, '13.1', 'Centralize Security Event Alerting',
     'Centralize security event alerting across enterprise assets for log correlation and analysis. Best practice implementation requires the use of a SIEM, which includes vendor-defined event correlation alerts.',
     'Network Monitoring and Defense', 2, 'medium', 'manual', 'none', true),
    (fw_id, '13.2', 'Deploy a Host-Based Intrusion Detection Solution',
     'Deploy a host-based intrusion detection solution on enterprise assets, where appropriate and/or supported.',
     'Network Monitoring and Defense', 2, 'medium', 'manual', 'none', true),
    (fw_id, '13.3', 'Deploy a Network Intrusion Detection Solution',
     'Deploy a network intrusion detection solution on enterprise assets, where appropriate. Example implementations include the use of a Network Intrusion Detection System (NIDS) or equivalent cloud service provider (CSP) service.',
     'Network Monitoring and Defense', 2, 'medium', 'manual', 'none', true),
    (fw_id, '13.4', 'Perform Traffic Filtering Between Network Segments',
     'Perform traffic filtering between network segments, where appropriate.',
     'Network Monitoring and Defense', 2, 'medium', 'manual', 'none', true),
    (fw_id, '13.5', 'Manage Access Control for Remote Assets',
     'Manage access control for assets remotely connecting to enterprise resources. Determine amount of access to enterprise resources based on up-to-date asset inventory, configuration, and patch status of each remote asset.',
     'Network Monitoring and Defense', 2, 'medium', 'manual', 'none', true),
    (fw_id, '13.6', 'Collect Network Traffic Flow Logs',
     'Collect network traffic flow logs and/or network traffic to review and alert upon from network devices.',
     'Network Monitoring and Defense', 2, 'medium', 'manual', 'none', true),
    (fw_id, '13.7', 'Deploy a Host-Based Intrusion Prevention Solution',
     'Deploy a host-based intrusion prevention solution on enterprise assets, where appropriate and/or supported.',
     'Network Monitoring and Defense', 3, 'high', 'manual', 'none', true),
    (fw_id, '13.8', 'Deploy a Network Intrusion Prevention Solution',
     'Deploy a network intrusion prevention solution, where appropriate. Example implementations include the use of a Network Intrusion Prevention System (NIPS) or equivalent CSP service.',
     'Network Monitoring and Defense', 3, 'high', 'manual', 'none', true),
    (fw_id, '13.9', 'Deploy Port-Level Access Control',
     'Deploy port-level access control. Port-level access control utilizes 802.1X, or similar network access control protocols.',
     'Network Monitoring and Defense', 3, 'high', 'manual', 'none', true),
    (fw_id, '13.10', 'Perform Application Layer Filtering',
     'Perform application layer filtering. Example implementations include a filtering proxy, application layer firewall, or gateway.',
     'Network Monitoring and Defense', 3, 'high', 'manual', 'none', true),
    (fw_id, '13.11', 'Tune Security Event Alerting Thresholds',
     'Tune security event alerting thresholds monthly, or more frequently.',
     'Network Monitoring and Defense', 3, 'high', 'manual', 'none', true)
  ON CONFLICT (framework_id, control_id) DO NOTHING;

  -- ── Control 14: Security Awareness and Skills Training ────────────────────
  INSERT INTO controls (framework_id, control_id, name, description, category, tier, severity, validation_type, integration_type, is_active)
  VALUES
    (fw_id, '14.1', 'Establish and Maintain a Security Awareness Program',
     'Establish and maintain a security awareness program. The purpose of a security awareness program is to educate the enterprise''s workforce on how to interact with enterprise assets and data in a secure manner.',
     'Security Awareness and Skills Training', 1, 'medium', 'manual', 'none', true),
    (fw_id, '14.2', 'Train Workforce Members to Recognize Social Engineering Attacks',
     'Train workforce members to recognize social engineering attacks, such as phishing, pre-texting, and tailgating.',
     'Security Awareness and Skills Training', 1, 'medium', 'manual', 'none', true),
    (fw_id, '14.3', 'Train Workforce Members on Authentication Best Practices',
     'Train workforce members on authentication best practices. Example topics include MFA, password composition, and credential management.',
     'Security Awareness and Skills Training', 1, 'medium', 'manual', 'none', true),
    (fw_id, '14.4', 'Train Workforce on Data Handling Best Practices',
     'Train workforce on data handling best practices, specifically how to store, transfer, archive, and destroy sensitive data.',
     'Security Awareness and Skills Training', 2, 'medium', 'manual', 'none', true),
    (fw_id, '14.5', 'Train Workforce Members on Causes of Unintentional Data Exposure',
     'Train workforce members to be aware of causes for unintentional data exposure. Example topics include mis-delivery of sensitive data, losing a portable end-user device, or publishing data to unintended audiences.',
     'Security Awareness and Skills Training', 2, 'medium', 'manual', 'none', true),
    (fw_id, '14.6', 'Train Workforce Members on Recognizing and Reporting Security Incidents',
     'Train workforce members on how to identify a potential incident and to be able to report such an incident.',
     'Security Awareness and Skills Training', 2, 'medium', 'manual', 'none', true),
    (fw_id, '14.7', 'Train Workforce on How to Identify and Report if Their Enterprise Assets Are Missing Security Updates',
     'Train workforce to understand how to verify and report out-of-date software patches or any failures in automated processes and tools.',
     'Security Awareness and Skills Training', 2, 'medium', 'manual', 'none', true),
    (fw_id, '14.8', 'Train Workforce on the Dangers Associated with Connecting to and Transmitting Data Over Insecure Networks',
     'Train workforce members on the dangers associated with connecting to and transmitting data over insecure networks for enterprise activities.',
     'Security Awareness and Skills Training', 2, 'medium', 'manual', 'none', true),
    (fw_id, '14.9', 'Conduct Role-Specific Security Awareness and Skills Training',
     'Conduct role-specific security awareness and skills training. Example implementations include secure system administration courses for IT professionals, OWASP Top 10 vulnerability awareness and prevention training for web application developers, and email phishing simulation training for end users.',
     'Security Awareness and Skills Training', 3, 'high', 'manual', 'none', true)
  ON CONFLICT (framework_id, control_id) DO NOTHING;

  -- ── Control 15: Service Provider Management ───────────────────────────────
  INSERT INTO controls (framework_id, control_id, name, description, category, tier, severity, validation_type, integration_type, is_active)
  VALUES
    (fw_id, '15.1', 'Establish and Maintain an Inventory of Service Providers',
     'Establish and maintain an inventory of service providers. The inventory is to list all known service providers, include classification(s), and designate an enterprise contact for each service provider.',
     'Service Provider Management', 1, 'medium', 'manual', 'none', true),
    (fw_id, '15.2', 'Establish and Maintain a Service Provider Management Policy',
     'Establish and maintain a service provider management policy. Ensure the policy addresses the classification, inventory, assessment, monitoring, and decommission of service providers.',
     'Service Provider Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '15.3', 'Classify Service Providers',
     'Classify service providers. Classification consideration may include one or more characteristics, such as data sensitivity, data volume, availability requirements, applicable regulations, inherent risk, and mitigated risk.',
     'Service Provider Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '15.4', 'Ensure Service Provider Contracts Include Security Requirements',
     'Ensure service provider contracts include security requirements. Example requirements may include minimum security program requirements, security incident and/or data breach notification and response requirements, data encryption requirements, and data disposal requirements.',
     'Service Provider Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '15.5', 'Assess Service Providers',
     'Assess service providers consistent with the enterprise''s service provider management policy. Assessment scope may vary based on classification(s), and may include review of standardized assessment reports, such as Service Organization Control 2 (SOC 2) and Payment Card Industry (PCI) Attestation of Compliance (AOC), customized questionnaires, or other appropriately rigorous processes.',
     'Service Provider Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '15.6', 'Monitor Service Providers',
     'Monitor service providers consistent with the enterprise''s service provider management policy. Monitoring may include periodic reassessment of service provider classification, monitoring service provider release notes for security-relevant updates, and following incident response procedures for incidents that include service providers.',
     'Service Provider Management', 3, 'high', 'manual', 'none', true),
    (fw_id, '15.7', 'Securely Decommission Service Providers',
     'Securely decommission service providers. Example considerations include user and service account deactivation, termination of data flows, and secure disposal of enterprise data within service provider systems.',
     'Service Provider Management', 3, 'high', 'manual', 'none', true)
  ON CONFLICT (framework_id, control_id) DO NOTHING;

  -- ── Control 16: Application Software Security ─────────────────────────────
  INSERT INTO controls (framework_id, control_id, name, description, category, tier, severity, validation_type, integration_type, is_active)
  VALUES
    (fw_id, '16.1', 'Establish and Maintain a Secure Application Development Process',
     'Establish and maintain a secure application development process. In the process, address such items as: secure application design standards, secure coding practices, developer training, vulnerability management, security of third-party code, and application security testing procedures.',
     'Application Software Security', 2, 'medium', 'manual', 'none', true),
    (fw_id, '16.2', 'Establish and Maintain a Process to Accept and Address Software Vulnerabilities',
     'Establish and maintain a process to accept and address reports of software vulnerabilities, including providing a means for external entities to report.',
     'Application Software Security', 2, 'medium', 'manual', 'none', true),
    (fw_id, '16.3', 'Perform Root Cause Analysis on Security Vulnerabilities',
     'Perform root cause analysis on security vulnerabilities. When reviewing vulnerabilities, root cause analysis is the task of evaluating underlying reasons for the existence of the vulnerability.',
     'Application Software Security', 2, 'medium', 'manual', 'none', true),
    (fw_id, '16.4', 'Establish and Maintain a Process for Receiving and Acting on Asset Vulnerability Information',
     'Establish and maintain a process for receiving and acting on asset vulnerability information. The enterprise should subscribe to internet mailing lists and/or other means of receiving new information about security vulnerabilities.',
     'Application Software Security', 2, 'medium', 'manual', 'none', true),
    (fw_id, '16.5', 'Use Up-to-Date and Trusted Third-Party Software Components',
     'Use up-to-date and trusted third-party software components. When possible, choose established and trusted libraries and frameworks for the software assets.',
     'Application Software Security', 2, 'medium', 'manual', 'none', true),
    (fw_id, '16.6', 'Establish and Maintain a Severity Rating System and Process for Application Vulnerabilities',
     'Establish and maintain a severity rating system and process for application vulnerabilities that facilitates prioritizing the order in which discovered vulnerabilities are fixed.',
     'Application Software Security', 2, 'medium', 'manual', 'none', true),
    (fw_id, '16.7', 'Use Standard Hardening Configuration Templates for Application Infrastructure',
     'Use standard, industry-recommended hardening configuration templates for application infrastructure components.',
     'Application Software Security', 2, 'medium', 'manual', 'none', true),
    (fw_id, '16.8', 'Separate Production and Non-Production Systems',
     'Maintain separate environments for production and non-production systems.',
     'Application Software Security', 2, 'medium', 'manual', 'none', true),
    (fw_id, '16.9', 'Train Developers in Application Security Concepts and Secure Coding',
     'Ensure that all software development personnel receive training in writing secure code for their specific development environment and responsibilities.',
     'Application Software Security', 2, 'medium', 'manual', 'none', true),
    (fw_id, '16.10', 'Apply Secure Design Principles in Application Architectures',
     'Apply secure design principles in application architectures. Example principles include least privilege, defense-in-depth, fail secure, do not trust services, separation of privilege, avoid security by obscurity, and simplify security design.',
     'Application Software Security', 3, 'high', 'manual', 'none', true),
    (fw_id, '16.11', 'Leverage Vetted Modules or Services for Application Security Components',
     'Leverage vetted modules or services for application security components, such as identity management, encryption, and auditing and logging.',
     'Application Software Security', 3, 'high', 'manual', 'none', true),
    (fw_id, '16.12', 'Implement Code-Level Security Checks',
     'Apply static and dynamic analysis tools within the application life cycle to verify that secure coding practices are being adhered to.',
     'Application Software Security', 3, 'high', 'manual', 'none', true),
    (fw_id, '16.13', 'Conduct Application Penetration Testing',
     'Conduct application penetration testing. For critical applications, authenticated penetration testing is preferred. Ensure that the scope of penetration testing is in scope with the rules of engagement.',
     'Application Software Security', 3, 'high', 'manual', 'none', true),
    (fw_id, '16.14', 'Conduct Threat Modeling',
     'Conduct threat modeling. Use a repeatable process that includes identification of threats and countermeasures.',
     'Application Software Security', 3, 'high', 'manual', 'none', true)
  ON CONFLICT (framework_id, control_id) DO NOTHING;

  -- ── Control 17: Incident Response Management ──────────────────────────────
  INSERT INTO controls (framework_id, control_id, name, description, category, tier, severity, validation_type, integration_type, is_active)
  VALUES
    (fw_id, '17.1', 'Designate Personnel to Manage Incident Handling',
     'Designate one key person, and at least one backup, who will manage the enterprise''s incident handling process. Management personnel are responsible for the coordination and documentation of incident response and recovery efforts and can consist of employees or hired contractors.',
     'Incident Response Management', 1, 'medium', 'manual', 'none', true),
    (fw_id, '17.2', 'Establish and Maintain Contact Information for Reporting Security Incidents',
     'Establish and maintain contact information for parties that need to be informed of security incidents. Contacts may include internal staff, third-party vendors, law enforcement, cyber insurance providers, relevant government agencies, Information Sharing and Analysis Center (ISAC) partners, or other stakeholders.',
     'Incident Response Management', 1, 'medium', 'manual', 'none', true),
    (fw_id, '17.3', 'Establish and Maintain an Enterprise Process for Reporting Incidents',
     'Establish and maintain an enterprise process for the workforce to report security incidents. The process includes reporting timeframe, personnel to report to, mechanism for reporting, and the minimum information to be reported.',
     'Incident Response Management', 1, 'medium', 'manual', 'none', true),
    (fw_id, '17.4', 'Establish and Maintain an Incident Response Process',
     'Establish and maintain an incident response process that addresses roles and responsibilities, compliance requirements, and a communication plan.',
     'Incident Response Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '17.5', 'Assign Key Roles and Responsibilities for Incident Response',
     'Assign key roles and responsibilities for incident response, including staff from legal, human resources, management, information technology, communications, operations, and the finance teams.',
     'Incident Response Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '17.6', 'Define Mechanisms for Communicating During Incident Response',
     'Determine which primary and secondary mechanisms will be used to communicate and report during a security incident. Mechanisms can include phone calls, emails, or letters.',
     'Incident Response Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '17.7', 'Conduct Routine Incident Response Exercises',
     'Plan and conduct routine incident response exercises and scenarios for the workforce involved in the incident response to maintain awareness and comfort in responding to real-world threats. Exercises need not be tabletop exercises.',
     'Incident Response Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '17.8', 'Conduct Post-Incident Reviews',
     'Conduct post-incident reviews. Post-incident reviews help prevent incident recurrence through identifying lessons learned and follow-up action.',
     'Incident Response Management', 2, 'medium', 'manual', 'none', true),
    (fw_id, '17.9', 'Establish and Maintain Security Incident Thresholds',
     'Establish and maintain security incident thresholds, including, at a minimum, differentiating between an incident and an event.',
     'Incident Response Management', 3, 'high', 'manual', 'none', true)
  ON CONFLICT (framework_id, control_id) DO NOTHING;

  -- ── Control 18: Penetration Testing ───────────────────────────────────────
  INSERT INTO controls (framework_id, control_id, name, description, category, tier, severity, validation_type, integration_type, is_active)
  VALUES
    (fw_id, '18.1', 'Establish and Maintain a Penetration Testing Program',
     'Establish and maintain a penetration testing program appropriate to the size, complexity, and maturity of the enterprise. A penetration testing program should address purpose, scope, requirements, and frequency.',
     'Penetration Testing', 2, 'medium', 'manual', 'none', true),
    (fw_id, '18.2', 'Perform Periodic External Penetration Tests',
     'Perform periodic external penetration tests based on program requirements, no less than annually. External penetration testing must include enterprise and environmental reconnaissance to detect exploitable information.',
     'Penetration Testing', 2, 'medium', 'manual', 'none', true),
    (fw_id, '18.3', 'Remediate Penetration Test Findings',
     'Remediate penetration test findings based on the enterprise''s policy for remediation scope and prioritization.',
     'Penetration Testing', 2, 'medium', 'manual', 'none', true),
    (fw_id, '18.4', 'Validate Security Measures',
     'Validate security measures after each penetration test. If deemed necessary, modify rulesets and capabilities to detect the techniques used during testing.',
     'Penetration Testing', 3, 'high', 'manual', 'none', true),
    (fw_id, '18.5', 'Perform Periodic Internal Penetration Tests',
     'Perform periodic internal penetration tests based on program requirements, no less than annually. The scope of internal penetration testing should include, at a minimum, any system that is in scope for public-facing applications.',
     'Penetration Testing', 3, 'high', 'manual', 'none', true)
  ON CONFLICT (framework_id, control_id) DO NOTHING;

END $$;
