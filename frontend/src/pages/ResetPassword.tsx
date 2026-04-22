import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { passwordApi } from '../services/api';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div style={containerStyle}>
        <div style={cardStyle}>
          <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '14px 16px', borderRadius: 8, fontSize: 14, marginBottom: 20 }}>
            Invalid or missing reset token. Please request a new password reset link.
          </div>
          <Link to="/forgot-password" style={{ fontSize: 14, color: '#2563eb', textDecoration: 'none' }}>
            Request new link
          </Link>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await passwordApi.resetPassword(token, password);
      navigate('/login?reset=1');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(msg ?? 'Reset link is invalid or has expired. Please request a new one.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>Set new password</h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
            Choose a strong password for your account.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
              New password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              minLength={8}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
              Confirm password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
              required
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '10px 14px', borderRadius: 6, fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', backgroundColor: loading ? '#93c5fd' : '#2563eb',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '10px 0', fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', marginBottom: 16,
            }}
          >
            {loading ? 'Saving…' : 'Set Password'}
          </button>

          <Link to="/login" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>
            ← Back to sign in
          </Link>
        </form>
      </div>
    </div>
  );
}

const containerStyle: React.CSSProperties = {
  minHeight: '100vh', backgroundColor: '#f9fafb',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'system-ui, -apple-system, sans-serif',
};

const cardStyle: React.CSSProperties = {
  backgroundColor: '#fff', borderRadius: 12,
  boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
  padding: '40px 48px', width: '100%', maxWidth: 420,
};

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #d1d5db', borderRadius: 6,
  padding: '8px 12px', fontSize: 14, color: '#111827',
  boxSizing: 'border-box', outline: 'none',
};
