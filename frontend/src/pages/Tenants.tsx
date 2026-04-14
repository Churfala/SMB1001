import React, { useEffect, useState } from 'react';
import { tenantApi } from '../services/api';
import { useTenant } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';
import type { Tenant, Integration } from '../types';

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  active: { bg: '#dcfce7', color: '#16a34a' },
  inactive: { bg: '#f3f4f6', color: '#6b7280' },
  suspended: { bg: '#fee2e2', color: '#dc2626' },
  connected: { bg: '#dcfce7', color: '#16a34a' },
  error: { bg: '#fee2e2', color: '#dc2626' },
  pending: { bg: '#fef3c7', color: '#d97706' },
};

const EMPTY_M365 = { client_id: '', client_secret: '', tenant_id: '' };
const EMPTY_GOOGLE = { service_account_json: '', admin_email: '', customer_id: '' };

type IntForms = {
  m365: typeof EMPTY_M365;
  google: typeof EMPTY_GOOGLE;
  saving: 'm365' | 'google' | null;
  error: string;
  tab: 'm365' | 'google';
};

export default function Tenants() {
  const { tenants, reload, currentTenant } = useTenant();
  const { user } = useAuth();
  const [integrations, setIntegrations] = useState<Record<string, Integration[]>>({});
  const [newTenant, setNewTenant] = useState({ name: '', slug: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [forms, setForms] = useState<Record<string, IntForms>>({});
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const getForm = (tenantId: string): IntForms =>
    forms[tenantId] ?? { m365: { ...EMPTY_M365 }, google: { ...EMPTY_GOOGLE }, saving: null, error: '', tab: 'm365' };

  const setForm = (tenantId: string, patch: Partial<IntForms>) =>
    setForms((prev) => ({ ...prev, [tenantId]: { ...getForm(tenantId), ...patch } }));

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

  const handleSaveM365 = async (tenantId: string) => {
    const f = getForm(tenantId);
    setForm(tenantId, { saving: 'm365', error: '' });
    try {
      await tenantApi.upsertIntegration(tenantId, {
        type: 'm365',
        client_id: f.m365.client_id,
        client_secret: f.m365.client_secret,
        metadata: { tenant_id: f.m365.tenant_id },
      });
      // Reload integrations list for this tenant
      const d = await tenantApi.listIntegrations(tenantId);
      setIntegrations((prev) => ({ ...prev, [tenantId]: d.integrations ?? [] }));
      setForm(tenantId, { m365: { ...EMPTY_M365 }, saving: null });
    } catch (err: unknown) {
      setForm(tenantId, {
        saving: null,
        error: (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to save M365 integration',
      });
    }
  };

  const handleSaveGoogle = async (tenantId: string) => {
    const f = getForm(tenantId);
    setForm(tenantId, { saving: 'google', error: '' });
    let serviceAccount: unknown;
    try {
      serviceAccount = JSON.parse(f.google.service_account_json);
    } catch {
      setForm(tenantId, { saving: null, error: 'Service account JSON is not valid JSON' });
      return;
    }
    try {
      await tenantApi.upsertIntegration(tenantId, {
        type: 'google',
        metadata: {
          service_account: serviceAccount,
          admin_email: f.google.admin_email,
          customer_id: f.google.customer_id,
        },
      });
      const d = await tenantApi.listIntegrations(tenantId);
      setIntegrations((prev) => ({ ...prev, [tenantId]: d.integrations ?? [] }));
      setForm(tenantId, { google: { ...EMPTY_GOOGLE }, saving: null });
    } catch (err: unknown) {
      setForm(tenantId, {
        saving: null,
        error: (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to save Google integration',
      });
    }
  };

  const handleDeleteTenant = async (tenantId: string) => {
    setDeleting(tenantId);
    try {
      await tenantApi.delete(tenantId);
      setConfirmDelete(null);
      setExpanded(null);
      reload();
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to delete tenant');
      setDeleting(null);
    }
  };

  const handleDeleteIntegration = async (tenantId: string, integrationId: string) => {
    await tenantApi.deleteIntegration(tenantId, integrationId);
    const d = await tenantApi.listIntegrations(tenantId);
    setIntegrations((prev) => ({ ...prev, [tenantId]: d.integrations ?? [] }));
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
        {tenants.map((tenant: Tenant, idx: number) => {
          const f = getForm(tenant.id);
          const ints = integrations[tenant.id] ?? [];
          return (
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

                {/* Delete — hidden for the admin's own home tenant */}
                {user?.tenantId !== tenant.id && (
                  confirmDelete === tenant.id ? (
                    <span onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
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
                      onClick={(e) => { e.stopPropagation(); setConfirmDelete(tenant.id); }}
                      style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px' }}
                    >
                      Delete
                    </button>
                  )
                )}
              </div>

              {expanded === tenant.id && (
                <div style={{ padding: '0 16px 20px', backgroundColor: '#f9fafb', borderTop: '1px solid #f3f4f6' }}>

                  {/* Existing integrations */}
                  <div style={{ marginTop: 14, marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 8 }}>Connected Integrations</div>
                    {ints.length === 0 ? (
                      <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>None configured yet.</p>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                        {ints.map((int: Integration) => (
                          <div key={int.id} style={{ border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 12px', backgroundColor: '#fff', minWidth: 160, display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', textTransform: 'uppercase' }}>{int.type}</div>
                            <span style={{ backgroundColor: STATUS_STYLE[int.status]?.bg, color: STATUS_STYLE[int.status]?.color, padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600, alignSelf: 'flex-start' }}>
                              {int.status}
                            </span>
                            {int.last_sync && (
                              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                                Synced {new Date(int.last_sync).toLocaleDateString('en-AU')}
                              </div>
                            )}
                            <button
                              onClick={() => handleDeleteIntegration(tenant.id, int.id)}
                              style={{ marginTop: 4, fontSize: 11, color: '#dc2626', background: 'none', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left' }}
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Configure integration */}
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, backgroundColor: '#fff', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb' }}>
                      {(['m365', 'google'] as const).map((tab) => (
                        <button
                          key={tab}
                          onClick={() => setForm(tenant.id, { tab })}
                          style={{
                            padding: '8px 16px',
                            fontSize: 13,
                            fontWeight: 500,
                            border: 'none',
                            borderBottom: f.tab === tab ? '2px solid #2563eb' : '2px solid transparent',
                            backgroundColor: 'transparent',
                            color: f.tab === tab ? '#2563eb' : '#6b7280',
                            cursor: 'pointer',
                          }}
                        >
                          {tab === 'm365' ? 'Microsoft 365' : 'Google Workspace'}
                        </button>
                      ))}
                    </div>

                    <div style={{ padding: 16 }}>
                      {f.error && (
                        <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '8px 12px', borderRadius: 6, fontSize: 12, marginBottom: 12 }}>
                          {f.error}
                        </div>
                      )}

                      {f.tab === 'm365' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6b7280' }}>
                            Register an App in Azure Entra ID with these <strong>application</strong> permissions (no user sign-in required):{' '}
                            <strong>User.Read.All</strong>, <strong>Directory.Read.All</strong>, <strong>Policy.Read.All</strong>,{' '}
                            <strong>AuditLog.Read.All</strong>, <strong>UserAuthenticationMethod.Read.All</strong>,{' '}
                            <strong>Reports.Read.All</strong>, <strong>SecurityEvents.Read.All</strong>.
                            Grant admin consent after adding them.
                          </p>
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 180 }}>
                              <label style={labelStyle}>Application (Client) ID</label>
                              <input
                                value={f.m365.client_id}
                                onChange={(e) => setForm(tenant.id, { m365: { ...f.m365, client_id: e.target.value } })}
                                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                style={inputStyle}
                              />
                            </div>
                            <div style={{ flex: 1, minWidth: 180 }}>
                              <label style={labelStyle}>Directory (Tenant) ID</label>
                              <input
                                value={f.m365.tenant_id}
                                onChange={(e) => setForm(tenant.id, { m365: { ...f.m365, tenant_id: e.target.value } })}
                                placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                                style={inputStyle}
                              />
                            </div>
                          </div>
                          <div>
                            <label style={labelStyle}>Client Secret</label>
                            <input
                              type="password"
                              value={f.m365.client_secret}
                              onChange={(e) => setForm(tenant.id, { m365: { ...f.m365, client_secret: e.target.value } })}
                              placeholder="••••••••••••••••"
                              style={{ ...inputStyle, width: '100%' }}
                            />
                          </div>
                          <button
                            onClick={() => handleSaveM365(tenant.id)}
                            disabled={f.saving === 'm365' || !f.m365.client_id || !f.m365.client_secret || !f.m365.tenant_id}
                            style={saveButtonStyle(f.saving === 'm365')}
                          >
                            {f.saving === 'm365' ? 'Saving…' : 'Save M365 Integration'}
                          </button>
                        </div>
                      )}

                      {f.tab === 'google' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                          <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6b7280' }}>
                            Create a Google Workspace service account with <strong>domain-wide delegation</strong>, download the JSON key, and paste it below.
                          </p>
                          <div>
                            <label style={labelStyle}>Service Account JSON Key</label>
                            <textarea
                              value={f.google.service_account_json}
                              onChange={(e) => setForm(tenant.id, { google: { ...f.google, service_account_json: e.target.value } })}
                              placeholder='{"type":"service_account","project_id":"...","private_key_id":"...",...}'
                              rows={5}
                              style={{ ...inputStyle, width: '100%', height: 'auto', resize: 'vertical', fontFamily: 'monospace', fontSize: 11 }}
                            />
                          </div>
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <div style={{ flex: 1, minWidth: 180 }}>
                              <label style={labelStyle}>Admin Email (impersonated)</label>
                              <input
                                value={f.google.admin_email}
                                onChange={(e) => setForm(tenant.id, { google: { ...f.google, admin_email: e.target.value } })}
                                placeholder="admin@yourdomain.com"
                                style={inputStyle}
                              />
                            </div>
                            <div style={{ flex: 1, minWidth: 140 }}>
                              <label style={labelStyle}>Customer ID</label>
                              <input
                                value={f.google.customer_id}
                                onChange={(e) => setForm(tenant.id, { google: { ...f.google, customer_id: e.target.value } })}
                                placeholder="C0xxxxxx"
                                style={inputStyle}
                              />
                            </div>
                          </div>
                          <button
                            onClick={() => handleSaveGoogle(tenant.id)}
                            disabled={f.saving === 'google' || !f.google.service_account_json || !f.google.admin_email}
                            style={saveButtonStyle(f.saving === 'google')}
                          >
                            {f.saving === 'google' ? 'Saving…' : 'Save Google Integration'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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

const labelStyle: React.CSSProperties = {
  fontSize: 12, fontWeight: 500, color: '#374151', display: 'block', marginBottom: 4,
};

const saveButtonStyle = (saving: boolean): React.CSSProperties => ({
  alignSelf: 'flex-start',
  backgroundColor: saving ? '#93c5fd' : '#2563eb',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '7px 16px',
  fontSize: 13,
  fontWeight: 600,
  cursor: saving ? 'not-allowed' : 'pointer',
});
