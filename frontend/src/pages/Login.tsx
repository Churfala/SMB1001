import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { settingsApi } from '../services/api';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [ssoInfo, setSsoInfo] = useState<{ is_enabled: boolean; provider_label: string } | null>(null);

  useEffect(() => {
    const ssoError = searchParams.get('sso_error');
    if (ssoError) setError(ssoError);
  }, [searchParams]);

  useEffect(() => {
    settingsApi.getSsoPublic()
      .then((d) => setSsoInfo(d))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const handleSSO = () => {
    window.location.href = `${API_BASE}/auth/sso`;
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: '#f9fafb',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        backgroundColor: '#fff',
        borderRadius: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        padding: '40px 48px',
        width: '100%',
        maxWidth: 420,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 10, backgroundColor: '#2563eb',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
          }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
              <path d="M12 2L3 7l9 5 9-5-9-5z" fill="#fff"/>
              <path d="M3 12l9 5 9-5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
              <path d="M3 17l9 5 9-5" stroke="#fff" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>ControlCheck</h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: '6px 0 0' }}>MSP Compliance Platform</p>
        </div>

        {/* SSO button — only shown when configured and enabled */}
        {ssoInfo?.is_enabled && (
          <>
            <button
              type="button"
              onClick={handleSSO}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                backgroundColor: '#fff',
                color: '#374151',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                padding: '10px 0',
                fontSize: 14,
                fontWeight: 500,
                cursor: 'pointer',
                marginBottom: 20,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Sign in with {ssoInfo.provider_label}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
              <span style={{ fontSize: 12, color: '#9ca3af' }}>or</span>
              <div style={{ flex: 1, height: 1, backgroundColor: '#e5e7eb' }} />
            </div>
          </>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
              Email address
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              placeholder="admin@msp.local"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="••••••••"
              required
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{
              backgroundColor: '#fee2e2', color: '#991b1b',
              padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              backgroundColor: loading ? '#93c5fd' : '#2563eb',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 0', fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div style={{ marginTop: 32, borderTop: '1px solid #f3f4f6', paddingTop: 16, display: 'flex', justifyContent: 'flex-end', alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#d1d5db' }}>v{__APP_VERSION__}</span>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #d1d5db', borderRadius: 6,
  padding: '8px 12px', fontSize: 14, color: '#111827',
  boxSizing: 'border-box', outline: 'none',
};
