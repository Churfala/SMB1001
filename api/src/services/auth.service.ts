import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { query, queryOne } from '../config/database';
import { env } from '../config/env';
import { User, JwtPayload, UserRole } from '../types';

interface LoginResult {
  user: User;
  tenant: { id: string; name: string; slug: string };
  accessToken: string;
  refreshToken: string;
}

interface RefreshPayload {
  sub: string;
  tenant_id: string;
  type: 'refresh';
}

export const authService = {
  async login(email: string, password: string): Promise<LoginResult> {
    // Find the user by email across all active tenants
    const user = await queryOne<User>(
      `SELECT u.* FROM users u
       JOIN tenants t ON t.id = u.tenant_id
       WHERE LOWER(u.email) = $1 AND u.is_active = true AND t.status = 'active'
       ORDER BY u.created_at ASC
       LIMIT 1`,
      [email.toLowerCase()],
    );
    if (!user) {
      throw new Error('Invalid credentials');
    }

    // Verify password
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      throw new Error('Invalid credentials');
    }

    const tenant = await queryOne<{ id: string; name: string; slug: string }>(
      'SELECT id, name, slug FROM tenants WHERE id = $1',
      [user.tenant_id],
    );
    if (!tenant) {
      throw new Error('Invalid credentials');
    }

    // Update last login timestamp (non-blocking)
    query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]).catch(() => {});

    const tokens = authService.generateTokens(user, tenant.id);
    return { user, tenant, ...tokens };
  },

  generateTokens(user: User, tenantId: string): { accessToken: string; refreshToken: string } {
    const payload: JwtPayload = {
      sub: user.id,
      tenant_id: tenantId,
      role: user.role,
      email: user.email,
    };

    const accessToken = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions);

    const refreshPayload: RefreshPayload = {
      sub: user.id,
      tenant_id: tenantId,
      type: 'refresh',
    };

    const refreshToken = jwt.sign(refreshPayload, env.JWT_REFRESH_SECRET, {
      expiresIn: env.JWT_REFRESH_EXPIRES_IN,
    } as jwt.SignOptions);

    return { accessToken, refreshToken };
  },

  async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: RefreshPayload;
    try {
      payload = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET) as RefreshPayload;
    } catch {
      throw new Error('Invalid or expired refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new Error('Invalid token type');
    }

    const user = await queryOne<User>(
      'SELECT * FROM users WHERE id = $1 AND is_active = true',
      [payload.sub],
    );
    if (!user) {
      throw new Error('User not found or inactive');
    }

    return authService.generateTokens(user, payload.tenant_id);
  },

  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await queryOne<User>('SELECT * FROM users WHERE id = $1', [userId]);
    if (!user) throw new Error('User not found');

    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) throw new Error('Current password is incorrect');

    const newHash = await bcrypt.hash(newPassword, 10);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [newHash, userId]);
  },
};
