import crypto from 'crypto';
import axios from 'axios';
import { FastifyRequest, FastifyReply } from 'fastify';
import { authService } from '../services/auth.service';
import { auditLogService } from '../services/audit-log.service';
import { query, queryOne } from '../config/database';
import { env } from '../config/env';
import { decrypt } from '../services/encryption.service';
import type { User } from '../types';

interface SsoConfig {
  authorizationUrl: string;
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  ssoTenantSlug: string;
  autoProvision: boolean;
}

/** Load SSO config from DB. Falls back to Entra env vars for legacy/dev use. */
async function loadSsoConfig(): Promise<SsoConfig | null> {
  const row = await queryOne<{
    authorization_url: string | null;
    token_url: string | null;
    client_id: string | null;
    encrypted_client_secret: string | null;
    redirect_uri: string | null;
    scopes: string;
    sso_tenant_slug: string;
    auto_provision: boolean;
    is_enabled: boolean;
  }>('SELECT * FROM sso_config WHERE id = 1');

  if (
    row?.is_enabled &&
    row.authorization_url &&
    row.token_url &&
    row.client_id &&
    row.encrypted_client_secret
  ) {
    return {
      authorizationUrl: row.authorization_url,
      tokenUrl: row.token_url,
      clientId: row.client_id,
      clientSecret: decrypt(row.encrypted_client_secret),
      redirectUri: (row.redirect_uri ?? '').trim(),
      scopes: row.scopes || 'openid email profile',
      ssoTenantSlug: row.sso_tenant_slug,
      autoProvision: row.auto_provision,
    };
  }

  // Legacy env var fallback
  if (env.ENTRA_TENANT_ID && env.ENTRA_CLIENT_ID && env.ENTRA_CLIENT_SECRET) {
    return {
      authorizationUrl: `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/oauth2/v2.0/authorize`,
      tokenUrl: `https://login.microsoftonline.com/${env.ENTRA_TENANT_ID}/oauth2/v2.0/token`,
      clientId: env.ENTRA_CLIENT_ID,
      clientSecret: env.ENTRA_CLIENT_SECRET,
      redirectUri: env.ENTRA_REDIRECT_URI,
      scopes: 'openid email profile',
      ssoTenantSlug: env.ENTRA_SSO_TENANT_SLUG,
      autoProvision: env.ENTRA_AUTO_PROVISION,
    };
  }

  return null;
}

/** Shared: look up or auto-provision a user from decoded id_token claims. */
async function resolveUserFromClaims(
  claims: { email?: string; preferred_username?: string; given_name?: string; family_name?: string; name?: string },
  sso: SsoConfig,
): Promise<{ user: User | null; tenant: { id: string; name: string; slug: string } | null; error?: string }> {
  const email = (claims.email ?? claims.preferred_username ?? '').toLowerCase();
  if (!email) return { user: null, tenant: null, error: 'No email in SSO token' };

  const tenant = await queryOne<{ id: string; name: string; slug: string }>(
    'SELECT id, name, slug FROM tenants WHERE slug = $1 AND status = $2',
    [sso.ssoTenantSlug, 'active'],
  );
  if (!tenant) return { user: null, tenant: null, error: 'SSO tenant not configured' };

  let user = await queryOne<User>(
    'SELECT * FROM users WHERE LOWER(email) = $1 AND tenant_id = $2 AND is_active = true',
    [email, tenant.id],
  );

  if (!user && sso.autoProvision) {
    const firstName = claims.given_name ?? claims.name?.split(' ')[0] ?? '';
    const lastName = claims.family_name ?? claims.name?.split(' ').slice(1).join(' ') ?? '';
    user = await queryOne<User>(
      `INSERT INTO users (tenant_id, email, password_hash, role, first_name, last_name, is_active)
       VALUES ($1, $2, '', 'auditor', $3, $4, true) RETURNING *`,
      [tenant.id, email, firstName, lastName],
    );
  }

  if (!user) return { user: null, tenant, error: `No account found for ${email}` };
  query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]).catch(() => {});
  return { user, tenant };
}

export const authController = {
  async login(request: FastifyRequest, reply: FastifyReply) {
    const { email, password } = request.body as {
      email: string;
      password: string;
    };

    if (!email || !password) {
      return reply.status(400).send({
        error: 'Bad Request',
        message: 'email and password are required',
      });
    }

    try {
      const result = await authService.login(email, password);

      await auditLogService.log({
        tenantId: result.tenant.id,
        userId: result.user.id,
        action: 'user.login',
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return reply.send({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role,
          firstName: result.user.first_name,
          lastName: result.user.last_name,
          tenantId: result.tenant.id,
          tenantName: result.tenant.name,
          tenantSlug: result.tenant.slug,
        },
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Authentication failed';
      await auditLogService.log({
        action: 'user.login.failed',
        details: { email },
        ipAddress: request.ip,
      });
      return reply.status(401).send({ error: 'Unauthorized', message });
    }
  },

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const { refreshToken } = request.body as { refreshToken: string };

    if (!refreshToken) {
      return reply.status(400).send({ error: 'Bad Request', message: 'refreshToken is required' });
    }

    try {
      const tokens = await authService.refresh(refreshToken);
      return reply.send(tokens);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Token refresh failed';
      return reply.status(401).send({ error: 'Unauthorized', message });
    }
  },

  async me(request: FastifyRequest, reply: FastifyReply) {
    const row = await queryOne<{
      id: string; email: string; role: string; is_active: boolean;
      first_name: string | null; last_name: string | null;
      tenant_id: string; tenant_name: string; tenant_slug: string;
      has_password: boolean;
    }>(
      `SELECT u.id, u.email, u.role, u.is_active,
              u.first_name, u.last_name,
              t.id AS tenant_id, t.name AS tenant_name, t.slug AS tenant_slug,
              (u.password_hash <> '') AS has_password
       FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE u.id = $1`,
      [request.user.sub],
    );

    if (!row) return reply.status(404).send({ error: 'User not found' });
    return reply.send({
      id: row.id,
      email: row.email,
      role: row.role,
      firstName: row.first_name,
      lastName: row.last_name,
      tenantId: row.tenant_id,
      tenantName: row.tenant_name,
      tenantSlug: row.tenant_slug,
      has_password: row.has_password,
    });
  },

  async ssoLogin(_request: FastifyRequest, reply: FastifyReply) {
    const sso = await loadSsoConfig();
    if (!sso) {
      return reply.status(503).send({ error: 'SSO is not configured. Set it up in Settings → SSO.' });
    }
    const state = crypto.randomBytes(16).toString('hex');
    const params = new URLSearchParams({
      client_id: sso.clientId,
      response_type: 'code',
      redirect_uri: sso.redirectUri,
      scope: sso.scopes,
      response_mode: 'query',
      state,
    });
    return reply.redirect(`${sso.authorizationUrl}?${params}`);
  },

  async ssoCallback(request: FastifyRequest, reply: FastifyReply) {
    const { code, error, error_description } = request.query as Record<string, string>;
    const frontendLogin = `${env.FRONTEND_URL}/login`;

    if (error || !code) {
      return reply.redirect(`${frontendLogin}?sso_error=${encodeURIComponent(error_description ?? 'SSO failed')}`);
    }

    const sso = await loadSsoConfig();
    if (!sso) {
      return reply.redirect(`${frontendLogin}?sso_error=${encodeURIComponent('SSO is not configured')}`);
    }

    try {
      // Exchange code for tokens
      const tokenRes = await axios.post<{ id_token: string }>(
        sso.tokenUrl,
        new URLSearchParams({
          grant_type: 'authorization_code',
          code,
          redirect_uri: sso.redirectUri,
          client_id: sso.clientId,
          client_secret: sso.clientSecret,
        }).toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      // Decode id_token claims (no need to verify — we just fetched it from Microsoft)
      const [, payloadB64] = tokenRes.data.id_token.split('.');
      const claims = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
      const { user, tenant, error: resolveError } = await resolveUserFromClaims(claims, sso);

      if (resolveError || !user || !tenant) {
        return reply.redirect(`${frontendLogin}?sso_error=${encodeURIComponent(resolveError ?? 'SSO failed')}`);
      }

      const { accessToken, refreshToken } = authService.generateTokens(user, tenant.id);
      return reply.redirect(
        `${env.FRONTEND_URL}/auth/callback#access_token=${accessToken}&refresh_token=${encodeURIComponent(refreshToken)}`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'SSO error';
      return reply.redirect(`${frontendLogin}?sso_error=${encodeURIComponent(msg)}`);
    }
  },

  async changePassword(request: FastifyRequest, reply: FastifyReply) {
    const { currentPassword, newPassword } = request.body as {
      currentPassword: string;
      newPassword: string;
    };

    if (!currentPassword || !newPassword) {
      return reply.status(400).send({ error: 'Bad Request', message: 'currentPassword and newPassword are required' });
    }

    if (newPassword.length < 12) {
      return reply.status(400).send({ error: 'Bad Request', message: 'Password must be at least 12 characters' });
    }

    try {
      await authService.changePassword(request.user.sub, currentPassword, newPassword);
      await auditLogService.log({
        tenantId: request.user.tenant_id,
        userId: request.user.sub,
        action: 'user.password_changed',
      });
      return reply.send({ message: 'Password changed successfully' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Password change failed';
      return reply.status(400).send({ error: 'Bad Request', message });
    }
  },
};
