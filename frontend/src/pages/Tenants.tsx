import React, { useState } from 'react';
import { tenantApi } from '../services/api';
import { useTenant } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';
import type { Tenant } from '../types';

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active: { bg: '#dcfce7', color: '#16a34a' },
  inactive: { bg: '#f3f4f6', color: '#6b7280' },
  suspended: { bg: '#fee2e2', color: '#dc2626' },
};

export default function Tenants() {
  const { tenants, reload } = useTenant();
  const { user } = useAuth();
  const [newTenant, setNewTenant] = useState({ name: '', slug: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [renameError, setRenameError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setCreating(true);
    try {
      await tenantApi.create(newTenant.name, newTenant.slug);
      setNewTenant({ name: '', slug: '' });
      reload();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create tenant');
    } finally {
      setCreating(false);
    }
  };

  const startRename = (tenant: Tenant) => {
    setRenamingId(tenant.id);
    setRenameValue(tenant.name);
    setRenameError('');
  };

  const handleRename = async (tenantId: string) => {
    if (!renameValue.trim()) return;
    setRenaming(true);
    setRenameError('');
    try {
      await tenantApi.update(tenantId, { name: renameValue.trim() });
      setRenamingId(null);
      reload();
    } catch (err: unknown) {
      setRenameError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to rename tenant');
    } finally {
      setRenaming(false);
    }
  };

  const handleDeleteTenant = async (tenantId: string) => {
    setDeleting(tenantId);
    try {
      await tenantApi.delete(tenantId);
      setConfirmDelete(null);
      reload();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to delete tenant');
      setDeleting(null);
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Tenants</h1>

      {/* Create form */}
      <div style={{ backgroundColor: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: 20, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 14px' }}>Add Tenant</h2>
        <form onSubmit={handleCreate} style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Name</label>
            <input value={newTenant.name} onChange={(e) => setNewTenant((t) => ({ ...t, name: e.target.value }))} required placeholder="Acme Corp" style={inputStyle} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4 }}>Slug</label>
            <input
              value={newTenant.slug}
              onChange={(e) => setNewTenant((t) => ({ ...t, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') }))}
              required
              placeholder="acme-corp"
              pattern="[a-z0-9-]+"
              style={inputStyle}
            />
          </div>
          <button type="submit" disabled={creating} style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '7px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600, height: 34 }}>
            {creating ? 'Creating…' : 'Create'}
          </button>
        </form>
        {error && <p style={{ color: '#dc2626', fontSize: 12, margin: '8px 0 0' }}>{error}</p>}
      </div>

      {/* Tenants list */}
      <div style={{ backgroundColor: '#fff', borderRadius: 10, border: '1px solid #e5e7eb' }}>
        {tenants.map((tenant: Tenant, idx: number) => (
          <div key={tenant.id} style={{ borderTop: idx > 0 ? '1px solid #f3f4f6' : 'none', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1 }}>
              {renamingId === tenant.id ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <input
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRename(tenant.id);
                      if (e.key === 'Escape') setRenamingId(null);
                    }}
                    autoFocus
                    style={inputStyle}
                  />
                  <button
                    onClick={() => handleRename(tenant.id)}
                    disabled={renaming || !renameValue.trim()}
                    style={{ fontSize: 12, backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    {renaming ? '…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setRenamingId(null)}
                    style={{ fontSize: 12, backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 4, padding: '4px 10px', cursor: 'pointer' }}
                  >
                    Cancel
                  </button>
                  {renameError && <span style={{ fontSize: 11, color: '#dc2626' }}>{renameError}</span>}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{tenant.name}</span>
                  <button
                    onClick={() => startRename(tenant)}
                    style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', padding: '1px 4px' }}
                  >
                    Rename
                  </button>
                </div>
              )}
              <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{tenant.slug}</div>
            </div>
            <span style={{
              backgroundColor: STATUS_STYLE[tenant.status]?.bg ?? '#f3f4f6',
              color: STATUS_STYLE[tenant.status]?.color ?? '#6b7280',
              padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
            }}>
              {tenant.status}
            </span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>
              {new Date(tenant.created_at).toLocaleDateString('en-AU')}
            </span>

            {/* Delete — hidden for the admin's own home tenant */}
            {user?.tenantId !== tenant.id && (
              confirmDelete === tenant.id ? (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12, color: '#dc2626', fontWeight: 500 }}>Delete?</span>
                  <button
                    onClick={() => handleDeleteTenant(tenant.id)}
                    disabled={deleting === tenant.id}
                    style={{ fontSize: 11, backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, padding: '3px 8px', cursor: 'pointer', fontWeight: 600 }}
                  >
                    {deleting === tenant.id ? '…' : 'Yes'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(null)}
                    style={{ fontSize: 11, backgroundColor: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}
                  >
                    No
                  </button>
                </span>
              ) : (
                <button
                  onClick={() => setConfirmDelete(tenant.id)}
                  style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                >
                  Delete
                </button>
              )
            )}
          </div>
        ))}
        {tenants.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>No tenants yet.</div>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 10px', fontSize: 13, color: '#111827', height: 34, boxSizing: 'border-box',
};
