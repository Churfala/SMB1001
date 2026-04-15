import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authApi, settingsApi } from '../services/api';

type Tab = 'profile' | 'sso';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';
const suggestedCallback = `${API_BASE.startsWith('http') ? API_BASE : window.location.origin + API_BASE}/auth/sso/callback`;

// ---------------------------------------------------------------------------
// Provider presets
// ---------------------------------------------------------------------------
type ProviderKey = 'entra' | 'cloudflare' | 'okta' | 'custom';

interface Preset {
  label: string;
  buildUrls: (extra: string, clientId?: string) => { authorization_url: string; token_url: string };
  extraField?: { key: string; label: string; placeholder: string; hint?: string };
  scopes?: string;
  instructions: React.ReactNode;
}

const PRESETS: Record<ProviderKey, Preset> = {
  entra: {
    label: 'Microsoft Entra',
    extraField: { key: 'tenant_id', label: 'Azure Directory (Tenant) ID', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
    buildUrls: (tenantId) => ({
      authorization_url: tenantId ? `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize` : '',
      token_url: tenantId ? `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token` : '',
    }),
    scopes: 'openid email profile',
    instructions: (
      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>How to register the app in Azure</p>
        <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>Go to <strong>portal.azure.com</strong> → <strong>Microsoft Entra ID</strong> → <strong>App registrations</strong> → <strong>New registration</strong></li>
          <li>Name: e.g. <em>ControlCheck SSO</em>. Supported account types: <em>Accounts in this organisational directory only</em>.</li>
          <li>Under <strong>Redirect URI</strong>, select platform <strong>Web</strong> and paste the Redirect URI shown below.</li>
          <li>Click <strong>Register</strong>. Copy the <strong>Application (client) ID</strong> and <strong>Directory (tenant) ID</strong> shown on the Overview page.</li>
          <li>Go to <strong>Certificates &amp; secrets</strong> → <strong>New client secret</strong>. Copy the secret <em>value</em> (not the ID) — it is only shown once.</li>
          <li>Go to <strong>API permissions</strong>. Confirm <strong>User.Read</strong> (Microsoft Graph) is present; add it if not. Click <strong>Grant admin consent</strong>.</li>
          <li>Paste the Tenant ID, Client ID, and Client Secret into the fields below and save.</li>
        </ol>
        <p style={{ marginTop: 8, color: '#6b7280', fontSize: 12 }}>
          The token endpoint and authorization URL are built automatically from your Tenant ID.
        </p>
      </div>
    ),
  },
  cloudflare: {
    label: 'Cloudflare Access',
    extraField: {
      key: 'team_domain',
      label: 'Cloudflare Team Domain',
      placeholder: 'your-team',
      hint: 'Subdomain of your Cloudflare Access team — e.g. "globalpc" for globalpc.cloudflareaccess.com',
    },
    buildUrls: (teamDomain, clientId) => ({
      authorization_url: teamDomain && clientId
        ? `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/sso/oidc/${clientId}/authorization`
        : '',
      token_url: teamDomain && clientId
        ? `https://${teamDomain}.cloudflareaccess.com/cdn-cgi/access/sso/oidc/${clientId}/token`
        : '',
    }),
    instructions: (
      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>How to create an OIDC application in Cloudflare Access</p>
        <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>In the <strong>Cloudflare Zero Trust</strong> dashboard, go to <strong>Access</strong> → <strong>Applications</strong> → <strong>Add an application</strong>.</li>
          <li>Choose <strong>SaaS</strong> as the application type.</li>
          <li>Set <strong>Application URL</strong> to your ControlCheck frontend URL. Under <strong>Redirect URIs</strong>, paste the Redirect URI shown below.</li>
          <li>Copy the <strong>Client ID</strong> and <strong>Client secret</strong> from the application settings.</li>
          <li>Enter your team subdomain and Client ID above — the Authorization and Token URLs are built automatically (Cloudflare embeds the Client ID in the URL path).</li>
        </ol>
      </div>
    ),
  },
  okta: {
    label: 'Okta',
    extraField: {
      key: 'okta_domain',
      label: 'Okta Domain',
      placeholder: 'your-org.okta.com',
    },
    buildUrls: (domain) => ({
      authorization_url: domain ? `https://${domain}/oauth2/v1/authorize` : '',
      token_url: domain ? `https://${domain}/oauth2/v1/token` : '',
    }),
    instructions: (
      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>How to create an OIDC app in Okta</p>
        <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <li>In the Okta Admin Console, go to <strong>Applications</strong> → <strong>Create App Integration</strong>.</li>
          <li>Sign-in method: <strong>OIDC – OpenID Connect</strong>. Application type: <strong>Web Application</strong>.</li>
          <li>Under <strong>Sign-in redirect URIs</strong>, add the Redirect URI shown below.</li>
          <li>Under <strong>Assignments</strong>, assign users or groups as needed.</li>
          <li>Save and copy the <strong>Client ID</strong> and <strong>Client secret</strong>.</li>
          <li>Enter your Okta domain above, then paste the credentials below.</li>
        </ol>
      </div>
    ),
  },
  custom: {
    label: 'Custom OIDC',
    buildUrls: () => ({ authorization_url: '', token_url: '' }),
    instructions: (
      <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
        <p style={{ fontWeight: 600, marginBottom: 8 }}>Custom OIDC provider</p>
        <p style={{ margin: 0, color: '#6b7280' }}>
          Enter the Authorization URL, Token URL, Client ID, and Client Secret from your identity provider's OIDC application settings.
          Register the <strong>Redirect URI</strong> shown below in your provider.
        </p>
      </div>
    ),
  },
};

// ---------------------------------------------------------------------------

interface SsoState {
  provider: ProviderKey;
  provider_label: string;
  extraValue: string;
  authorization_url: string;
  token_url: string;
  client_id: string;
  client_secret: string;
  client_secret_set: boolean;
  redirect_uri: string;
  scopes: string;
  sso_tenant_slug: string;
  auto_provision: boolean;
  is_enabled: boolean;
}

const DEFAULT_SSO: SsoState = {
  provider: 'entra',
  provider_label: 'Microsoft Entra',
  extraValue: '',
  authorization_url: '',
  token_url: '',
  client_id: '',
  client_secret: '',
  client_secret_set: false,
  redirect_uri: suggestedCallback,
  scopes: 'openid email profile',
  sso_tenant_slug: 'msp-admin',
  auto_provision: true,
  is_enabled: false,
};

export default function Settings() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('profile');

  // --- Profile ---
  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pwForm.next !== pwForm.confirm) { setPwMsg({ ok: false, text: 'New passwords do not match' }); return; }
    if (pwForm.next.length < 12) { setPwMsg({ ok: false, text: 'Password must be at least 12 characters' }); return; }
    setPwSaving(true); setPwMsg(null);
    try {
      await authApi.changePassword(pwForm.current, pwForm.next);
      setPwMsg({ ok: true, text: 'Password updated successfully' });
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err: unknown) {
      setPwMsg({ ok: false, text: (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to update password' });
    } finally { setPwSaving(false); }
  };

  // --- SSO ---
  const [sso, setSso] = useState<SsoState>(DEFAULT_SSO);
  const [ssoLoading, setSsoLoading] = useState(true);
  const [ssoSaving, setSsoSaving] = useState(false);
  const [ssoMsg, setSsoMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if (tab !== 'sso') return;
    setSsoLoading(true);
    settingsApi.getSso()
      .then((d) => {
        setSso((prev) => ({
          ...prev,
          ...d,
          provider: (d.provider as ProviderKey) ?? 'entra',
          redirect_uri: d.redirect_uri || suggestedCallback,
          client_secret: '',
          extraValue: '',
        }));
      })
      .finally(() => setSsoLoading(false));
  }, [tab]);

  const handleProviderChange = (key: ProviderKey) => {
    const preset = PRESETS[key];
    const urls = preset.buildUrls('');
    setSso((s) => ({
      ...s,
      provider: key,
      provider_label: preset.label,
      authorization_url: urls.authorization_url,
      token_url: urls.token_url,
      scopes: preset.scopes ?? 'openid email profile',
      extraValue: '',
    }));
    setShowInstructions(true);
  };

  const handleExtraChange = (value: string) => {
    const preset = PRESETS[sso.provider];
    const urls = preset.buildUrls(value, sso.client_id);
    setSso((s) => ({
      ...s,
      extraValue: value,
      authorization_url: urls.authorization_url || s.authorization_url,
      token_url: urls.token_url || s.token_url,
    }));
  };

  const handleClientIdChange = (value: string) => {
    const preset = PRESETS[sso.provider];
    const urls = preset.buildUrls(sso.extraValue, value);
    setSso((s) => ({
      ...s,
      client_id: value,
      ...(urls.authorization_url ? { authorization_url: urls.authorization_url } : {}),
      ...(urls.token_url ? { token_url: urls.token_url } : {}),
    }));
  };

  const handleSaveSso = async (e: React.FormEvent) => {
    e.preventDefault();
    setSsoSaving(true); setSsoMsg(null);
    try {
      const payload: Record<string, unknown> = {
        provider: sso.provider,
        provider_label: sso.provider_label || PRESETS[sso.provider]?.label,
        authorization_url: sso.authorization_url,
        token_url: sso.token_url,
        client_id: sso.client_id,
        redirect_uri: sso.redirect_uri,
        scopes: sso.scopes,
        sso_tenant_slug: sso.sso_tenant_slug,
        auto_provision: sso.auto_provision,
        is_enabled: sso.is_enabled,
      };
      if (sso.client_secret) payload.client_secret = sso.client_secret;
      await settingsApi.updateSso(payload);
      setSsoMsg({ ok: true, text: 'SSO settings saved' });
      const d = await settingsApi.getSso();
      setSso((prev) => ({ ...prev, ...d, provider: d.provider as ProviderKey, redirect_uri: d.redirect_uri || suggestedCallback, client_secret: '', extraValue: '' }));
    } catch (err: unknown) {
      setSsoMsg({ ok: false, text: (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to save settings' });
    } finally { setSsoSaving(false); }
  };

  const preset = PRESETS[sso.provider] ?? PRESETS.custom;

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 20 }}>Settings</h1>

      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 24 }}>
        {(['profile', 'sso'] as Tab[]).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '8px 20px', fontSize: 14, fontWeight: 500, border: 'none',
            borderBottom: tab === t ? '2px solid #2563eb' : '2px solid transparent',
            backgroundColor: 'transparent', color: tab === t ? '#2563eb' : '#6b7280', cursor: 'pointer',
          }}>
            {t === 'profile' ? 'Profile' : 'SSO Configuration'}
          </button>
        ))}
      </div>

      {/* ---- Profile ---- */}
      {tab === 'profile' && (
        <div style={{ backgroundColor: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: 24 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 2 }}>Email</div>
            <div style={{ fontSize: 14, color: '#111827' }}>{user?.email}</div>
          </div>
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#6b7280', marginBottom: 2 }}>Role</div>
            <div style={{ fontSize: 14, color: '#111827', textTransform: 'capitalize' }}>{user?.role}</div>
          </div>
          <hr style={{ border: 'none', borderTop: '1px solid #f3f4f6', margin: '0 0 20px' }} />
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 16px' }}>Change Password</h2>
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div><label style={labelStyle}>Current Password</label><input type="password" value={pwForm.current} onChange={(e) => setPwForm((f) => ({ ...f, current: e.target.value }))} required style={inputStyle} /></div>
            <div><label style={labelStyle}>New Password <span style={{ color: '#9ca3af', fontWeight: 400 }}>(min 12 characters)</span></label><input type="password" value={pwForm.next} onChange={(e) => setPwForm((f) => ({ ...f, next: e.target.value }))} required minLength={12} style={inputStyle} /></div>
            <div><label style={labelStyle}>Confirm New Password</label><input type="password" value={pwForm.confirm} onChange={(e) => setPwForm((f) => ({ ...f, confirm: e.target.value }))} required style={inputStyle} /></div>
            {pwMsg && <div style={{ backgroundColor: pwMsg.ok ? '#dcfce7' : '#fee2e2', color: pwMsg.ok ? '#16a34a' : '#991b1b', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>{pwMsg.text}</div>}
            <button type="submit" disabled={pwSaving} style={btnStyle(pwSaving)}>{pwSaving ? 'Saving…' : 'Update Password'}</button>
          </form>
        </div>
      )}

      {/* ---- SSO ---- */}
      {tab === 'sso' && (
        <div style={{ backgroundColor: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: 24 }}>
          {ssoLoading ? <p style={{ color: '#9ca3af', fontSize: 14 }}>Loading…</p> : (
            <form onSubmit={handleSaveSso} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Provider picker */}
              <div>
                <label style={labelStyle}>Identity Provider</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {(Object.entries(PRESETS) as [ProviderKey, Preset][]).map(([key, p]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => handleProviderChange(key)}
                      style={{
                        padding: '6px 14px', fontSize: 13, borderRadius: 6, cursor: 'pointer',
                        border: sso.provider === key ? '2px solid #2563eb' : '1px solid #d1d5db',
                        backgroundColor: sso.provider === key ? '#eff6ff' : '#fff',
                        color: sso.provider === key ? '#1d4ed8' : '#374151',
                        fontWeight: sso.provider === key ? 600 : 400,
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* App registration instructions (collapsible) */}
              <div style={{ borderRadius: 8, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setShowInstructions((v) => !v)}
                  style={{
                    width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#1d4ed8',
                    backgroundColor: '#eff6ff', border: 'none', cursor: 'pointer',
                  }}
                >
                  <span>How to register this app with {preset.label}</span>
                  <span style={{ fontSize: 10 }}>{showInstructions ? '▲' : '▼'}</span>
                </button>
                {showInstructions && (
                  <div style={{ padding: '14px 16px', backgroundColor: '#f9fafb', borderTop: '1px solid #e5e7eb' }}>
                    {preset.instructions}
                  </div>
                )}
              </div>

              {/* Provider-specific helper field */}
              {preset.extraField && (
                <div>
                  <label style={labelStyle}>{preset.extraField.label}</label>
                  <input
                    value={sso.extraValue}
                    onChange={(e) => handleExtraChange(e.target.value)}
                    placeholder={preset.extraField.placeholder}
                    style={inputStyle}
                  />
                  {preset.extraField.hint && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{preset.extraField.hint}</div>}
                </div>
              )}

              {/* Auth + Token URLs (always shown, editable) */}
              <div>
                <label style={labelStyle}>Authorization URL</label>
                <input value={sso.authorization_url} onChange={(e) => setSso((s) => ({ ...s, authorization_url: e.target.value }))} placeholder="https://…/authorize" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Token URL</label>
                <input value={sso.token_url} onChange={(e) => setSso((s) => ({ ...s, token_url: e.target.value }))} placeholder="https://…/token" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Client ID</label>
                <input value={sso.client_id} onChange={(e) => handleClientIdChange(e.target.value)} placeholder="Application / Client ID" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>
                  Client Secret
                  {sso.client_secret_set && <span style={{ marginLeft: 8, color: '#16a34a', fontSize: 11, fontWeight: 600 }}>✓ saved</span>}
                </label>
                <input type="password" value={sso.client_secret} onChange={(e) => setSso((s) => ({ ...s, client_secret: e.target.value }))} placeholder={sso.client_secret_set ? '•••••••• (leave blank to keep)' : 'Paste client secret'} style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>Redirect URI</label>
                <input value={sso.redirect_uri} onChange={(e) => setSso((s) => ({ ...s, redirect_uri: e.target.value }))} style={inputStyle} />
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Register this exact URL in your identity provider</div>
              </div>

              <div>
                <label style={labelStyle}>Scopes</label>
                <input value={sso.scopes} onChange={(e) => setSso((s) => ({ ...s, scopes: e.target.value }))} placeholder="openid email profile" style={inputStyle} />
              </div>

              <div>
                <label style={labelStyle}>ControlCheck Tenant Slug <span style={{ color: '#9ca3af', fontWeight: 400 }}>(SSO users land here)</span></label>
                <input value={sso.sso_tenant_slug} onChange={(e) => setSso((s) => ({ ...s, sso_tenant_slug: e.target.value }))} placeholder="msp-admin" style={inputStyle} />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={sso.auto_provision} onChange={(e) => setSso((s) => ({ ...s, auto_provision: e.target.checked }))} style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 14, color: '#374151' }}>Auto-provision new users on first SSO login <span style={{ color: '#9ca3af', fontSize: 12 }}>(role: auditor)</span></span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
                <input type="checkbox" checked={sso.is_enabled} onChange={(e) => setSso((s) => ({ ...s, is_enabled: e.target.checked }))} style={{ width: 16, height: 16 }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Enable SSO on login page</span>
              </label>

              {ssoMsg && <div style={{ backgroundColor: ssoMsg.ok ? '#dcfce7' : '#fee2e2', color: ssoMsg.ok ? '#16a34a' : '#991b1b', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>{ssoMsg.text}</div>}

              <button type="submit" disabled={ssoSaving} style={btnStyle(ssoSaving)}>
                {ssoSaving ? 'Saving…' : 'Save SSO Settings'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 };
const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 12px', fontSize: 14, color: '#111827', boxSizing: 'border-box' };
const btnStyle = (disabled: boolean): React.CSSProperties => ({
  alignSelf: 'flex-start', backgroundColor: disabled ? '#93c5fd' : '#2563eb',
  color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px',
  fontSize: 14, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
});
