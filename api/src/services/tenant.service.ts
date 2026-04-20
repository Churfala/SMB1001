import { query, queryOne } from '../config/database';
import { Tenant, User, UserRole } from '../types';
import { authService } from './auth.service';

// Reusable fragment: JOIN frameworks so every tenant row includes resolved framework metadata.
// NULL framework_id defaults to SMB1001:2026.
// resolved_framework_id is always the live framework UUID (never null).
const TENANT_WITH_FRAMEWORK = `
  SELECT t.*,
         f.id           AS resolved_framework_id,
         f.code         AS framework_code,
         f.name         AS framework_name,
         f.tier_config  AS framework_tier_config,
         f.domain_label AS framework_domain_label
  FROM tenants t
  LEFT JOIN frameworks f
    ON f.id = COALESCE(t.framework_id, (SELECT id FROM frameworks WHERE code = 'SMB1001:2026'))
`;

export const tenantService = {
  async list(limit = 50, offset = 0): Promise<{ tenants: Tenant[]; total: number }> {
    const tenants = await query<Tenant>(
      `${TENANT_WITH_FRAMEWORK} ORDER BY t.created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    const count = await queryOne<{ count: string }>('SELECT COUNT(*)::text FROM tenants');
    return { tenants, total: parseInt(count?.count ?? '0', 10) };
  },

  async getById(id: string): Promise<Tenant | null> {
    return queryOne<Tenant>(`${TENANT_WITH_FRAMEWORK} WHERE t.id = $1`, [id]);
  },

  async getBySlug(slug: string): Promise<Tenant | null> {
    return queryOne<Tenant>(`${TENANT_WITH_FRAMEWORK} WHERE t.slug = $1`, [slug]);
  },

  async create(name: string, slug: string): Promise<Tenant> {
    const existing = await queryOne('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (existing) throw new Error(`Slug "${slug}" is already taken`);

    const row = await queryOne<{ id: string }>(
      'INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING id',
      [name, slug],
    );
    if (!row) throw new Error('Failed to create tenant');
    // Re-fetch with framework JOIN so the response includes resolved framework fields
    const tenant = await tenantService.getById(row.id);
    if (!tenant) throw new Error('Tenant not found after create');
    return tenant;
  },

  async update(id: string, updates: { name?: string; status?: string; settings?: Record<string, unknown>; framework_id?: string | null }): Promise<Tenant> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (updates.name !== undefined) { fields.push(`name = $${i++}`); values.push(updates.name); }
    if (updates.status !== undefined) { fields.push(`status = $${i++}`); values.push(updates.status); }
    if (updates.settings !== undefined) { fields.push(`settings = $${i++}`); values.push(JSON.stringify(updates.settings)); }
    if (updates.framework_id !== undefined) { fields.push(`framework_id = $${i++}`); values.push(updates.framework_id); }

    if (fields.length === 0) throw new Error('No fields to update');

    values.push(id);
    const updated = await queryOne<{ id: string }>(
      `UPDATE tenants SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING id`,
      values,
    );
    if (!updated) throw new Error('Tenant not found');

    // Re-fetch with framework JOIN so the response includes resolved framework fields
    const tenant = await tenantService.getById(id);
    if (!tenant) throw new Error('Tenant not found after update');
    return tenant;
  },

  // ── Tenant access exclusions ──────────────────────────────────────────────

  /** Return all non-suspended tenants except those explicitly excluded for this user. */
  async listForUser(userId: string): Promise<Tenant[]> {
    return query<Tenant>(
      `SELECT t.*,
              f.id           AS resolved_framework_id,
              f.code         AS framework_code,
              f.name         AS framework_name,
              f.tier_config  AS framework_tier_config,
              f.domain_label AS framework_domain_label
       FROM tenants t
       LEFT JOIN frameworks f
         ON f.id = COALESCE(t.framework_id, (SELECT id FROM frameworks WHERE code = 'SMB1001:2026'))
       WHERE t.status != 'suspended'
         AND NOT EXISTS (
           SELECT 1 FROM user_tenant_exclusions
           WHERE user_id = $1 AND tenant_id = t.id
         )
       ORDER BY t.name ASC`,
      [userId],
    );
  },

  /** Exclude a user from a tenant (adds to deny list). */
  async excludeTenant(userId: string, tenantId: string, excludedBy: string): Promise<void> {
    await query(
      `INSERT INTO user_tenant_exclusions (user_id, tenant_id, excluded_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, tenant_id) DO NOTHING`,
      [userId, tenantId, excludedBy],
    );
  },

  /** Remove a tenant exclusion (restores access). */
  async includeTenant(userId: string, tenantId: string): Promise<void> {
    await query('DELETE FROM user_tenant_exclusions WHERE user_id = $1 AND tenant_id = $2', [userId, tenantId]);
  },

  async listUserExclusions(userId: string): Promise<{ tenant_id: string; tenant_name: string; excluded_at: Date }[]> {
    return query(
      `SELECT ute.tenant_id, t.name AS tenant_name, ute.excluded_at
       FROM user_tenant_exclusions ute
       JOIN tenants t ON t.id = ute.tenant_id
       WHERE ute.user_id = $1
       ORDER BY t.name ASC`,
      [userId],
    );
  },

  // ── Users within a tenant ─────────────────────────────────────────────────

  async listUsers(tenantId: string): Promise<Omit<User, 'password_hash'>[]> {
    return query<Omit<User, 'password_hash'>>(
      `SELECT id, tenant_id, email, role, first_name, last_name, is_active, last_login, created_at, updated_at,
              (password_hash = '') AS is_sso
       FROM users WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId],
    );
  },

  async createUser(tenantId: string, data: {
    email: string;
    password?: string;
    role: UserRole;
    firstName?: string;
    lastName?: string;
  }): Promise<Omit<User, 'password_hash'>> {
    const existing = await queryOne('SELECT id FROM users WHERE tenant_id = $1 AND email = $2', [tenantId, data.email.toLowerCase()]);
    if (existing) throw new Error('A user with this email already exists in this tenant');

    const hash = data.password ? await authService.hashPassword(data.password) : '';
    const user = await queryOne<Omit<User, 'password_hash'>>(
      `INSERT INTO users (tenant_id, email, password_hash, role, first_name, last_name)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, tenant_id, email, role, first_name, last_name, is_active, last_login, created_at, updated_at`,
      [tenantId, data.email.toLowerCase(), hash, data.role, data.firstName ?? null, data.lastName ?? null],
    );
    if (!user) throw new Error('Failed to create user');
    return user;
  },

  async updateUser(tenantId: string, userId: string, updates: {
    role?: UserRole;
    firstName?: string;
    lastName?: string;
    isActive?: boolean;
    password?: string;
  }): Promise<Omit<User, 'password_hash'>> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (updates.role !== undefined) { fields.push(`role = $${i++}`); values.push(updates.role); }
    if (updates.firstName !== undefined) { fields.push(`first_name = $${i++}`); values.push(updates.firstName); }
    if (updates.lastName !== undefined) { fields.push(`last_name = $${i++}`); values.push(updates.lastName); }
    if (updates.isActive !== undefined) { fields.push(`is_active = $${i++}`); values.push(updates.isActive); }
    if (updates.password !== undefined) {
      const hash = await authService.hashPassword(updates.password);
      fields.push(`password_hash = $${i++}`);
      values.push(hash);
    }

    if (fields.length === 0) throw new Error('No fields to update');

    values.push(userId, tenantId);
    const user = await queryOne<Omit<User, 'password_hash'>>(
      `UPDATE users SET ${fields.join(', ')}, updated_at = NOW()
       WHERE id = $${i++} AND tenant_id = $${i}
       RETURNING id, tenant_id, email, role, first_name, last_name, is_active, last_login, created_at, updated_at`,
      values,
    );
    if (!user) throw new Error('User not found');
    return user;
  },

  async delete(id: string): Promise<void> {
    const result = await query('DELETE FROM tenants WHERE id = $1', [id]);
    if ((result as unknown as { rowCount: number }).rowCount === 0) {
      throw new Error('Tenant not found');
    }
  },

  async deleteUser(tenantId: string, userId: string): Promise<void> {
    const result = await query('DELETE FROM users WHERE id = $1 AND tenant_id = $2', [userId, tenantId]);
    if ((result as unknown as { rowCount: number }).rowCount === 0) {
      throw new Error('User not found');
    }
  },
};
