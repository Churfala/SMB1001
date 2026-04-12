import axios, { AxiosInstance } from 'axios';
import { decrypt } from './encryption.service';
import pino from 'pino';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const GRAPH_BETA = 'https://graph.microsoft.com/beta';

export interface M365Data {
  users: Record<string, unknown>[];
  mfaMethods: Map<string, Record<string, unknown>[]>;
  conditionalAccessPolicies: Record<string, unknown>[];
  secureScore: Record<string, unknown> | null;
  adminRoles: Record<string, unknown>[];
  mailboxAuditSettings: Record<string, unknown>[];
  legacyAuthPolicies: Record<string, unknown>[];
  antiPhishingPolicies: Record<string, unknown>[];
  dkimSettings: Record<string, unknown>[];
  dmarcRecords: Record<string, unknown>[];
  sharingPolicies: Record<string, unknown>[];
  oauthApps: Record<string, unknown>[];
  alertPolicies: Record<string, unknown>[];
  auditLogConfig: Record<string, unknown> | null;
  safeLinksPolices: Record<string, unknown>[];
  safeAttachmentPolicies: Record<string, unknown>[];
  signInRiskPolicies: Record<string, unknown>[];
  deviceCompliancePolicies: Record<string, unknown>[];
}

export interface M365Integration {
  client_id: string;
  encrypted_client_secret: string;
  metadata: { tenant_id?: string };
}

async function getAccessToken(clientId: string, clientSecret: string, tenantId: string): Promise<string> {
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: clientId,
    client_secret: clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  });
  const resp = await axios.post<any>(
    `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
  );
  return resp.data.access_token as string;
}

async function graphGetAll<T = Record<string, unknown>>(
  client: AxiosInstance,
  url: string,
  params?: Record<string, string>,
): Promise<T[]> {
  const results: T[] = [];
  let nextUrl: string | null = url;
  let isFirst = true;
  while (nextUrl) {
    const response: any = await client.get(nextUrl, { params: isFirst ? params : undefined });
    if (Array.isArray(response.data.value)) results.push(...(response.data.value as T[]));
    nextUrl = response.data['@odata.nextLink'] ?? null;
    isFirst = false;
  }
  return results;
}

async function batchMfaMethods(
  client: AxiosInstance,
  userIds: string[],
): Promise<Map<string, Record<string, unknown>[]>> {
  const map = new Map<string, Record<string, unknown>[]>();
  const BATCH = 20;
  for (let i = 0; i < userIds.length; i += BATCH) {
    const chunk = userIds.slice(i, i + BATCH);
    const requests = chunk.map((id, idx) => ({
      id: String(idx),
      method: 'GET',
      url: `/users/${id}/authentication/methods`,
    }));
    try {
      const resp = await client.post(`${GRAPH_BASE}/$batch`, { requests });
      for (const r of resp.data.responses ?? []) {
        const userId = chunk[parseInt(r.id, 10)];
        map.set(userId, r.status === 200 ? (r.body?.value ?? []) : []);
      }
    } catch {
      chunk.forEach((id) => map.set(id, []));
    }
  }
  return map;
}

export async function collectData(integration: M365Integration): Promise<M365Data> {
  const clientSecret = decrypt(integration.encrypted_client_secret);
  const tenantId = integration.metadata?.tenant_id;
  if (!tenantId) throw new Error('M365 integration missing tenant_id in metadata');

  const token = await getAccessToken(integration.client_id, clientSecret, tenantId);
  const client = axios.create({
    baseURL: GRAPH_BASE,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });

  const [usersResult, capResult, secureScoreResult, dirRolesResult, secDefaultsResult, alertsResult, spResult] =
    await Promise.allSettled([
      graphGetAll(client, '/users', {
        $select: 'id,userPrincipalName,displayName,accountEnabled,assignedLicenses',
        $top: '999',
      }),
      graphGetAll(client, '/identity/conditionalAccess/policies'),
      client.get('/security/secureScores', { params: { $top: '1' } }).then((r) => r.data?.value?.[0] ?? null).catch(() => null),
      graphGetAll(client, '/directoryRoles'),
      client.get('/policies/identitySecurityDefaultsEnforcementPolicy').then((r) => r.data).catch(() => null),
      graphGetAll(client, '/security/alerts_v2', { $top: '100' }).catch(() => [] as Record<string, unknown>[]),
      client.get('/admin/sharepoint/settings').then((r) => [r.data]).catch(() => [] as Record<string, unknown>[]),
    ]);

  const users: Record<string, unknown>[] = usersResult.status === 'fulfilled' ? usersResult.value : [];
  const cap: Record<string, unknown>[] = capResult.status === 'fulfilled' ? capResult.value : [];
  const secureScore = secureScoreResult.status === 'fulfilled' ? secureScoreResult.value : null;
  const dirRoles: Record<string, unknown>[] = dirRolesResult.status === 'fulfilled' ? dirRolesResult.value : [];
  const secDefaults = secDefaultsResult.status === 'fulfilled' ? secDefaultsResult.value : null;
  const alerts: Record<string, unknown>[] = alertsResult.status === 'fulfilled' ? alertsResult.value : [];
  const sharing: Record<string, unknown>[] = spResult.status === 'fulfilled' ? spResult.value : [];

  // Fetch directory role members in parallel
  const adminRoles = await Promise.all(
    dirRoles.map(async (role) => {
      try {
        const members = await graphGetAll(client, `/directoryRoles/${role.id}/members`);
        return { ...role, members };
      } catch {
        return { ...role, members: [] };
      }
    }),
  );

  // MFA batch (cap at 500 users for large tenants)
  const enabledUsers = users.filter((u) => u.accountEnabled).slice(0, 500);
  const mfaMethods = await batchMfaMethods(client, enabledUsers.map((u) => String(u.id)));

  // DKIM via beta
  let dkimSettings: Record<string, unknown>[] = [];
  try {
    const r = await axios.get(`${GRAPH_BETA}/admin/exchange/dkimSigningConfig`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    dkimSettings = r.data?.value ?? [];
  } catch { /* DKIM requires EXO admin */ }

  // Audit log config
  let auditLogConfig: Record<string, unknown> | null = null;
  try {
    await axios.get(`${GRAPH_BETA}/security/auditLog/queries`, {
      headers: { Authorization: `Bearer ${token}` },
      params: { $top: '1' },
    });
    auditLogConfig = { enabled: true };
  } catch (e: unknown) {
    const status = (e as { response?: { status?: number } })?.response?.status;
    auditLogConfig = status === 403
      ? { enabled: null, error: 'Insufficient permissions' }
      : null;
  }

  // Service principals (OAuth apps)
  let oauthApps: Record<string, unknown>[] = [];
  try {
    oauthApps = await graphGetAll(client, '/servicePrincipals', {
      $select: 'id,displayName,appId,publisherName,verifiedPublisher',
      $top: '200',
    });
  } catch { /* permissions may not allow this */ }

  const signInRiskPolicies = cap.filter((p) =>
    Array.isArray((p.conditions as Record<string, unknown>)?.signInRiskLevels) &&
    ((p.conditions as Record<string, unknown[]>).signInRiskLevels as string[]).length > 0,
  );

  const deviceCompliancePolicies = cap.filter((p) =>
    Array.isArray((p.grantControls as Record<string, unknown>)?.builtInControls) &&
    ((p.grantControls as Record<string, string[]>).builtInControls as string[]).includes('compliantDevice'),
  );

  return {
    users,
    mfaMethods,
    conditionalAccessPolicies: cap,
    secureScore,
    adminRoles,
    mailboxAuditSettings: [],     // Requires EXO cmdlets
    legacyAuthPolicies: secDefaults ? [secDefaults] : [],
    antiPhishingPolicies: alerts.filter((a) =>
      String(a.category ?? '').toLowerCase().includes('phish') ||
      String(a.title ?? '').toLowerCase().includes('phish'),
    ),
    dkimSettings,
    dmarcRecords: [],              // DNS only – not available via Graph
    sharingPolicies: sharing,
    oauthApps,
    alertPolicies: alerts,
    auditLogConfig,
    safeLinksPolices: [],          // EXO cmdlets only
    safeAttachmentPolicies: [],    // EXO cmdlets only
    signInRiskPolicies,
    deviceCompliancePolicies,
  };
}

export const m365Service = { collectData };
