import React, { useEffect, useState } from 'react';
import { tenantApi } from '../services/api';
import { useTenant } from '../contexts/TenantContext';
import type { Tenant, Integration } from '../types';

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active: { bg: '#dcfce7', color: '#16a34a' },
  inactive: { bg: '#f3f4f6', color: '#6b7280' },
  suspended: { bg: '#fee2e2', color: '#dc2626' },
  connected: { bg: '#dcfce7', color: '#16a34a' },
  error: { bg: '#fee2e2', color: '#dc2626' },
  pending: { bg: '#fef3c7', color: '#d97706' },
};

export default function Tenants() {
  const { tenants, reload } = useTenant();
  const [integrations, setIntegrations] = useState<Record<string, Integration[]>>({});
  const [newTenant, setNewTenant] = useState({ name: '', slug: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (expanded && !integrations[expanded]) {
      tenantApi.listIntegrations(expanded).then((d) => {
        setIntegrations((prev) => ({ ...prev, [expanded]: d.integrations ?? [] }));
      });
    }
  }, [expanded]);

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
          <div key={tenant.id} style={{ borderTop: idx > 0 ? '1px solid #f3f4f6' : 'none' }}>
            <div
              onClick={() => setExpanded(expanded === tenant.id ? null : tenant.id)}
              style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', cursor: 'pointer', gap: 12 }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{tenant.name}</div>
                <div style={{ fontSize: 12, color: '#9ca3af' }}>{tenant.slug}</div>
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
              <span style={{ color: '#9ca3af', fontSize: 12 }}>{expanded === tenant.id ? '▲' : '▼'}</span>
            </div>

            {expanded === tenant.id && (
              <div style={{ padding: '0 16px 16px', backgroundColor: '#f9fafb', borderTop: '1px solid #f3f4f6' }}>
                <div style={{ marginTop: 12 }}>
                  <strong style={{ fontSize: 12, color: '#374151' }}>Integrations</strong>
                  {(integrations[tenant.id] ?? []).length === 0 ? (
                    <p style={{ fontSize: 13, color: '#9ca3af', margin: '6px 0 0' }}>No integrations configured.</p>
                  ) : (
                    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                      {(integrations[tenant.id] ?? []).map((int: Integration) => (
                        <div key={int.id} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', backgroundColor: '#fff', minWidth: 160 }}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase' }}>{int.type}</div>
                          <span style={{ backgroundColor: STATUS_STYLE[int.status]?.bg, color: STATUS_STYLE[int.status]?.color, padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600 }}>
                            {int.status}
                          </span>
                          {int.last_sync && (
                            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                              Synced {new Date(int.last_sync).toLocaleDateString('en-AU')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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
