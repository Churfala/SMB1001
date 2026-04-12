import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import { decrypt } from './encryption.service';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export interface GoogleData {
  users: Record<string, unknown>[];
  twoSVEnforced: boolean;
  adminUsers: Record<string, unknown>[];
  oauthApps: Record<string, unknown>[];
  sharingSettings: Record<string, unknown>[];
  domainSettings: Record<string, unknown> | null;
  auditActivities: Record<string, unknown>[];
  mobileDevices: Record<string, unknown>[];
}

export interface GoogleIntegration {
  client_id: string;
  encrypted_client_secret: string;
  encrypted_access_token: string;
  encrypted_refresh_token: string;
  metadata?: { customer_id?: string; domain?: string };
}

function getAuthClient(integration: GoogleIntegration): OAuth2Client {
  const clientSecret = decrypt(integration.encrypted_client_secret);
  const accessToken = decrypt(integration.encrypted_access_token);
  const refreshToken = decrypt(integration.encrypted_refresh_token);
  const auth = new google.auth.OAuth2(integration.client_id, clientSecret);
  auth.setCredentials({ access_token: accessToken, refresh_token: refreshToken });
  return auth;
}

export async function collectData(integration: GoogleIntegration): Promise<GoogleData> {
  const auth = getAuthClient(integration);
  const customerId = integration.metadata?.customer_id ?? 'my_customer';
  const domain = integration.metadata?.domain;

  const adminDir = google.admin({ version: 'directory_v1', auth });
  const adminReports = google.admin({ version: 'reports_v1', auth });

  async function getAllUsers(): Promise<Record<string, unknown>[]> {
    const all: Record<string, unknown>[] = [];
    let pageToken: string | undefined;
    do {
      const resp = await adminDir.users.list({
        customer: customerId,
        maxResults: 500,
        projection: 'full',
        pageToken,
      });
      all.push(...((resp.data.users ?? []) as Record<string, unknown>[]));
      pageToken = resp.data.nextPageToken ?? undefined;
    } while (pageToken);
    return all;
  }

  async function getAllRoles(): Promise<Record<string, unknown>[]> {
    const all: Record<string, unknown>[] = [];
    let pageToken: string | undefined;
    do {
      const resp = await adminDir.roles.list({ customer: customerId, maxResults: 100, pageToken });
      all.push(...((resp.data.items ?? []) as Record<string, unknown>[]));
      pageToken = resp.data.nextPageToken ?? undefined;
    } while (pageToken);
    return all;
  }

  async function getAllRoleAssignments(): Promise<Record<string, unknown>[]> {
    const all: Record<string, unknown>[] = [];
    let pageToken: string | undefined;
    do {
      const resp = await adminDir.roleAssignments.list({ customer: customerId, maxResults: 200, pageToken });
      all.push(...((resp.data.items ?? []) as Record<string, unknown>[]));
      pageToken = resp.data.nextPageToken ?? undefined;
    } while (pageToken);
    return all;
  }

  async function getOAuthApps(users: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
    const byApp = new Map<string, Record<string, unknown>>();
    await Promise.allSettled(
      users.slice(0, 50).map(async (u) => {
        try {
          const resp = await adminDir.tokens.list({ userKey: String(u.primaryEmail) });
          for (const token of resp.data.items ?? []) {
            const key = String(token.clientId ?? token.displayText ?? '');
            if (key && !byApp.has(key)) byApp.set(key, token as Record<string, unknown>);
          }
        } catch { /* individual user may not be queryable */ }
      }),
    );
    return Array.from(byApp.values());
  }

  async function getMobileDevices(): Promise<Record<string, unknown>[]> {
    const all: Record<string, unknown>[] = [];
    let pageToken: string | undefined;
    do {
      const resp = await adminDir.mobiledevices.list({ customerId, maxResults: 100, pageToken });
      all.push(...((resp.data.mobiledevices ?? []) as Record<string, unknown>[]));
      pageToken = resp.data.nextPageToken ?? undefined;
    } while (pageToken);
    return all;
  }

  async function getAuditActivities(): Promise<Record<string, unknown>[]> {
    try {
      const resp = await adminReports.activities.list({
        userKey: 'all',
        applicationName: 'login',
        maxResults: 100,
      });
      return (resp.data.items ?? []) as Record<string, unknown>[];
    } catch {
      return [];
    }
  }

  const [usersR, rolesR, assignmentsR, devicesR, auditR] = await Promise.allSettled([
    getAllUsers(),
    getAllRoles(),
    getAllRoleAssignments(),
    getMobileDevices(),
    getAuditActivities(),
  ]);

  const allUsers = usersR.status === 'fulfilled' ? usersR.value : [];
  const allRoles = rolesR.status === 'fulfilled' ? rolesR.value : [];
  const assignments = assignmentsR.status === 'fulfilled' ? assignmentsR.value : [];
  const mobileDevices = devicesR.status === 'fulfilled' ? devicesR.value : [];
  const auditActivities = auditR.status === 'fulfilled' ? auditR.value : [];

  // Identify admin users from role assignments
  const adminRoleIds = new Set(
    allRoles
      .filter((r) => r.isSuperAdminRole === true || (Array.isArray(r.rolePrivileges) && (r.rolePrivileges as unknown[]).length > 5))
      .map((r) => r.roleId),
  );
  const adminUserIds = new Set(
    assignments.filter((a) => adminRoleIds.has(a.roleId)).map((a) => a.assignedTo),
  );
  const adminUsers = allUsers.filter((u) => adminUserIds.has(u.id) || u.isAdmin === true);

  // 2SV enforcement: check if ALL active users have it enrolled (org-level proxy)
  const activeUsers = allUsers.filter((u) => !u.suspended);
  const twoSVEnforced = activeUsers.length > 0 && activeUsers.every((u) => u.isEnrolledIn2Sv === true);

  let domainSettings: Record<string, unknown> | null = null;
  try {
    const resp = domain
      ? await adminDir.domains.get({ customer: customerId, domainName: domain })
      : await adminDir.customers.get({ customerKey: customerId });
    domainSettings = resp.data as Record<string, unknown>;
  } catch {
    logger.warn('Could not fetch Google Workspace domain/customer settings');
  }

  let sharingSettings: Record<string, unknown>[] = [];
  try {
    const resp = await adminDir.customers.get({ customerKey: customerId });
    if (resp.data) sharingSettings = [resp.data as Record<string, unknown>];
  } catch {
    logger.warn('Could not fetch sharing settings');
  }

  const oauthApps = await getOAuthApps(allUsers);

  return {
    users: allUsers,
    twoSVEnforced,
    adminUsers,
    oauthApps,
    sharingSettings,
    domainSettings,
    auditActivities,
    mobileDevices,
  };
}

export const googleService = { collectData };
