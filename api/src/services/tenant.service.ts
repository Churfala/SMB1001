import { query, queryOne } from '../config/database';
import { Tenant, User, UserRole } from '../types';
import { authService } from './auth.service';

export const tenantService = {
  async list(limit = 50, offset = 0): Promise<{ tenants: Tenant[]; total: number }> {
    const tenants = await query<Tenant>(
      'SELECT * FROM tenants ORDER BY created_at DESC LIMIT $1 OFFSET $2',
      [limit, offset],
    );
    const count = await queryOne<{ count: string }>('SELECT COUNT(*)::text FROM tenants');
    return { tenants, total: parseInt(count?.count ?? '0', 10) };
  },

  async getById(id: string): Promise<Tenant | null> {
    return queryOne<Tenant>('SELECT * FROM tenants WHERE id = $1', [id]);
  },

  async getBySlug(slug: string): Promise<Tenant | null> {
    return queryOne<Tenant>('SELECT * FROM tenants WHERE slug = $1', [slug]);
  },

  async create(name: string, slug: string): Promise<Tenant> {
    const existing = await queryOne('SELECT id FROM tenants WHERE slug = $1', [slug]);
    if (existing) throw new Error(`Slug "${slug}" is already taken`);

    const tenant = await queryOne<Tenant>(
      'INSERT INTO tenants (name, slug) VALUES ($1, $2) RETURNING *',
      [name, slug],
    );
    if (!tenant) throw new Error('Failed to create tenant');
    return tenant;
  },

  async update(id: string, updates: { name?: string; status?: string; settings?: Record<string, unknown> }): Promise<Tenant> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (updates.name !== undefined) { fields.push(`name = $${i++}`); values.push(updates.name); }
    if (updates.status !== undefined) { fields.push(`status = $${i++}`); values.push(updates.status); }
    if (updates.settings !== undefined) { fields.push(`settings = $${i++}`); values.push(JSON.stringify(updates.settings)); }

    if (fields.length === 0) throw new Error('No fields to update');

    values.push(id);
    const tenant = await queryOne<Tenant>(
      `UPDATE tenants SET ${fields.join(', ')}, updated_at = NOW() WHERE id = $${i} RETURNING *`,
      values,
    );
    if (!tenant) throw new Error('Tenant not found');
    return tenant;
  },

  // Users within a tenant
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
