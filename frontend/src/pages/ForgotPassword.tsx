import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { passwordApi } from '../services/api';

export default function ForgotPassword() {
  const [email, setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [error, setError]     = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await passwordApi.forgotPassword(email);
      setSent(true);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#f9fafb',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        backgroundColor: '#fff', borderRadius: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        padding: '40px 48px', width: '100%', maxWidth: 420,
      }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>Reset your password</h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
            Enter your email and we'll send you a reset link.
          </p>
        </div>

        {sent ? (
          <div>
            <div style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '14px 16px', borderRadius: 8, fontSize: 14, marginBottom: 20, lineHeight: 1.5 }}>
              If that address is registered you will receive an email shortly. Check your spam folder if it doesn't arrive within a few minutes.
            </div>
            <Link to="/login" style={{ fontSize: 14, color: '#2563eb', textDecoration: 'none' }}>
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
                Email address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
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
              {loading ? 'Sending…' : 'Send Reset Link'}
            </button>

            <Link to="/login" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>
              ← Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #d1d5db', borderRadius: 6,
  padding: '8px 12px', fontSize: 14, color: '#111827',
  boxSizing: 'border-box', outline: 'none',
};
