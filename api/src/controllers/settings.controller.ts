import { FastifyRequest, FastifyReply } from 'fastify';
import { query, queryOne } from '../config/database';
import { encrypt } from '../services/encryption.service';
import { testSmtp } from '../services/email.service';

interface SsoConfigRow {
  provider: string;
  provider_label: string;
  authorization_url: string | null;
  token_url: string | null;
  client_id: string | null;
  encrypted_client_secret: string | null;
  redirect_uri: string | null;
  scopes: string;
  sso_tenant_slug: string;
  auto_provision: boolean;
  is_enabled: boolean;
}

export const settingsController = {
  /** Public — returns just enough for the login page (no secrets) */
  async getSsoPublic(_request: FastifyRequest, reply: FastifyReply) {
    const row = await queryOne<Pick<SsoConfigRow, 'is_enabled' | 'provider' | 'provider_label'>>(
      'SELECT is_enabled, provider, provider_label FROM sso_config WHERE id = 1',
    );
    return reply.send({
      is_enabled: row?.is_enabled ?? false,
      provider: row?.provider ?? 'custom',
      provider_label: row?.provider_label ?? 'SSO',
    });
  },

  /** Admin — full config (secret omitted, replaced by client_secret_set flag) */
  async getSso(_request: FastifyRequest, reply: FastifyReply) {
    const row = await queryOne<SsoConfigRow>('SELECT * FROM sso_config WHERE id = 1');
    return reply.send({
      provider: row?.provider ?? 'custom',
      provider_label: row?.provider_label ?? 'SSO',
      authorization_url: (row?.authorization_url ?? '').trim(),
      token_url: (row?.token_url ?? '').trim(),
      client_id: (row?.client_id ?? '').trim(),
      client_secret_set: !!(row?.encrypted_client_secret),
      redirect_uri: (row?.redirect_uri ?? '').trim(),
      scopes: (row?.scopes ?? 'openid email profile').trim(),
      sso_tenant_slug: row?.sso_tenant_slug ?? 'msp-admin',
      auto_provision: row?.auto_provision ?? true,
      is_enabled: row?.is_enabled ?? false,
    });
  },

  async updateSso(request: FastifyRequest, reply: FastifyReply) {
    const {
      provider,
      provider_label,
      authorization_url,
      token_url,
      client_id,
      client_secret,
      redirect_uri,
      scopes,
      sso_tenant_slug,
      auto_provision,
      is_enabled,
    } = request.body as {
      provider?: string;
      provider_label?: string;
      authorization_url?: string;
      token_url?: string;
      client_id?: string;
      client_secret?: string;
      redirect_uri?: string;
      scopes?: string;
      sso_tenant_slug?: string;
      auto_provision?: boolean;
      is_enabled?: boolean;
    };

    const enc_secret = client_secret ? encrypt(client_secret) : null;

    await query(
      `INSERT INTO sso_config
         (id, provider, provider_label, authorization_url, token_url, client_id,
          encrypted_client_secret, redirect_uri, scopes, sso_tenant_slug,
          auto_provision, is_enabled, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
       ON CONFLICT (id) DO UPDATE SET
         provider           = COALESCE(EXCLUDED.provider,           sso_config.provider),
         provider_label     = COALESCE(EXCLUDED.provider_label,     sso_config.provider_label),
         authorization_url  = COALESCE(EXCLUDED.authorization_url,  sso_config.authorization_url),
         token_url          = COALESCE(EXCLUDED.token_url,          sso_config.token_url),
         client_id          = COALESCE(EXCLUDED.client_id,          sso_config.client_id),
         encrypted_client_secret = COALESCE(EXCLUDED.encrypted_client_secret, sso_config.encrypted_client_secret),
         redirect_uri       = COALESCE(EXCLUDED.redirect_uri,       sso_config.redirect_uri),
         scopes             = COALESCE(EXCLUDED.scopes,             sso_config.scopes),
         sso_tenant_slug    = COALESCE(EXCLUDED.sso_tenant_slug,    sso_config.sso_tenant_slug),
         auto_provision     = COALESCE(EXCLUDED.auto_provision,     sso_config.auto_provision),
         is_enabled         = COALESCE(EXCLUDED.is_enabled,         sso_config.is_enabled),
         updated_at         = NOW()`,
      [
        provider ?? null,
        provider_label ?? null,
        authorization_url?.trim() ?? null,
        token_url?.trim() ?? null,
        client_id?.trim() ?? null,
        enc_secret,
        redirect_uri?.trim() ?? null,
        scopes ?? null,
        sso_tenant_slug ?? null,
        auto_provision ?? null,
        is_enabled ?? null,
      ],
    );

    return reply.send({ success: true });
  },

  // ── SMTP ──────────────────────────────────────────────────────────────────

  async getSmtp(_request: FastifyRequest, reply: FastifyReply) {
    const row = await queryOne<{
      host: string | null;
      port: number;
      secure: boolean;
      username: string | null;
      encrypted_password: string | null;
      from_address: string;
      is_enabled: boolean;
    }>('SELECT * FROM smtp_config WHERE id = 1');

    return reply.send({
      host:         row?.host         ?? '',
      port:         row?.port         ?? 587,
      secure:       row?.secure       ?? false,
      username:     row?.username     ?? '',
      password_set: !!(row?.encrypted_password),
      from_address: row?.from_address ?? 'ControlCheck <noreply@controlcheck.app>',
      is_enabled:   row?.is_enabled   ?? false,
    });
  },

  async updateSmtp(request: FastifyRequest, reply: FastifyReply) {
    const { host, port, secure, username, password, from_address, is_enabled } = request.body as {
      host?: string;
      port?: number;
      secure?: boolean;
      username?: string;
      password?: string;
      from_address?: string;
      is_enabled?: boolean;
    };

    const enc_password = password ? encrypt(password) : null;

    await query(
      `INSERT INTO smtp_config
         (id, host, port, secure, username, encrypted_password, from_address, is_enabled, updated_at)
       VALUES (1, $1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT (id) DO UPDATE SET
         host               = COALESCE(EXCLUDED.host,               smtp_config.host),
         port               = COALESCE(EXCLUDED.port,               smtp_config.port),
         secure             = COALESCE(EXCLUDED.secure,             smtp_config.secure),
         username           = COALESCE(EXCLUDED.username,           smtp_config.username),
         encrypted_password = COALESCE(EXCLUDED.encrypted_password, smtp_config.encrypted_password),
         from_address       = COALESCE(EXCLUDED.from_address,       smtp_config.from_address),
         is_enabled         = COALESCE(EXCLUDED.is_enabled,         smtp_config.is_enabled),
         updated_at         = NOW()`,
      [
        host?.trim()         ?? null,
        port                 ?? null,
        secure               ?? null,
        username?.trim()     ?? null,
        enc_password,
        from_address?.trim() ?? null,
        is_enabled           ?? null,
      ],
    );

    return reply.send({ success: true });
  },

  async testSmtpConnection(request: FastifyRequest, reply: FastifyReply) {
    // Send test email to the requesting admin's address
    const adminUser = await queryOne<{ email: string }>(
      'SELECT email FROM users WHERE id = $1',
      [request.user.sub],
    );
    if (!adminUser) return reply.status(404).send({ error: 'Not Found', message: 'User not found' });

    const error = await testSmtp(adminUser.email);
    if (error) return reply.status(400).send({ error: 'SMTP Error', message: error });
    return reply.send({ success: true, sent_to: adminUser.email });
  },
};
