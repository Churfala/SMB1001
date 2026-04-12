import { query, queryOne } from '../config/database';
import { encrypt, decrypt } from './encryption.service';
import { Integration, IntegrationType } from '../types';

/** Public-facing integration view (no secrets) */
export type IntegrationPublic = Omit<
  Integration,
  'encrypted_client_secret' | 'encrypted_access_token' | 'encrypted_refresh_token'
>;

export const integrationService = {
  async getIntegrations(tenantId: string): Promise<IntegrationPublic[]> {
    return query<IntegrationPublic>(
      `SELECT id, tenant_id, type, client_id, status, scopes, last_sync,
              metadata, error_message, token_expires_at, created_at, updated_at
       FROM integrations WHERE tenant_id = $1 ORDER BY type`,
      [tenantId],
    );
  },

  async upsert(tenantId: string, type: IntegrationType, data: {
    client_id: string;
    client_secret?: string;
    access_token?: string;
    refresh_token?: string;
    token_expires_at?: Date;
    scopes?: string[];
    metadata?: Record<string, unknown>;
  }): Promise<IntegrationPublic> {
    const enc_secret = data.client_secret ? encrypt(data.client_secret) : null;
    const enc_access = data.access_token ? encrypt(data.access_token) : null;
    const enc_refresh = data.refresh_token ? encrypt(data.refresh_token) : null;

    const integration = await queryOne<IntegrationPublic>(
      `INSERT INTO integrations
         (tenant_id, type, client_id, encrypted_client_secret, encrypted_access_token,
          encrypted_refresh_token, token_expires_at, scopes, status, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'connected', $9)
       ON CONFLICT (tenant_id, type) DO UPDATE SET
         client_id                = EXCLUDED.client_id,
         encrypted_client_secret  = COALESCE(EXCLUDED.encrypted_client_secret, integrations.encrypted_client_secret),
         encrypted_access_token   = COALESCE(EXCLUDED.encrypted_access_token, integrations.encrypted_access_token),
         encrypted_refresh_token  = COALESCE(EXCLUDED.encrypted_refresh_token, integrations.encrypted_refresh_token),
         token_expires_at         = COALESCE(EXCLUDED.token_expires_at, integrations.token_expires_at),
         scopes                   = COALESCE(EXCLUDED.scopes, integrations.scopes),
         metadata                 = COALESCE(EXCLUDED.metadata, integrations.metadata),
         status                   = 'connected',
         error_message            = NULL,
         updated_at               = NOW()
       RETURNING id, tenant_id, type, client_id, status, scopes, last_sync,
                 metadata, error_message, token_expires_at, created_at, updated_at`,
      [tenantId, type, data.client_id, enc_secret, enc_access, enc_refresh,
       data.token_expires_at ?? null, data.scopes ?? [], JSON.stringify(data.metadata ?? {})],
    );
    if (!integration) throw new Error('Failed to upsert integration');
    return integration;
  },

  /** Returns integration with decrypted secrets – for internal/worker use only */
  async getDecrypted(tenantId: string, type: IntegrationType): Promise<(Integration & {
    client_secret: string | null;
    access_token: string | null;
    refresh_token: string | null;
  }) | null> {
    const row = await queryOne<Integration>(
      'SELECT * FROM integrations WHERE tenant_id = $1 AND type = $2',
      [tenantId, type],
    );
    if (!row) return null;

    return {
      ...row,
      client_secret: row.encrypted_client_secret ? decrypt(row.encrypted_client_secret) : null,
      access_token: row.encrypted_access_token ? decrypt(row.encrypted_access_token) : null,
      refresh_token: row.encrypted_refresh_token ? decrypt(row.encrypted_refresh_token) : null,
    };
  },

  async delete(tenantId: string, integrationId: string): Promise<void> {
    await query('DELETE FROM integrations WHERE id = $1 AND tenant_id = $2', [integrationId, tenantId]);
  },

  async setError(tenantId: string, type: IntegrationType, message: string): Promise<void> {
    await query(
      'UPDATE integrations SET status = $1, error_message = $2, updated_at = NOW() WHERE tenant_id = $3 AND type = $4',
      ['error', message, tenantId, type],
    );
  },
};
