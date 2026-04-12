import React from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import type { Tenant } from '../types';

export default function Layout() {
  const { user, logout } = useAuth();
  const { tenants, currentTenant, setCurrentTenant } = useTenant();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navLink = (to: string, label: string) => (
    <Link
      to={to}
      style={{
        color: location.pathname.startsWith(to) ? '#2563eb' : '#6b7280',
        textDecoration: 'none',
        fontWeight: location.pathname.startsWith(to) ? 600 : 400,
        fontSize: 14,
      }}
    >
      {label}
    </Link>
  );

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f9fafb', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Top nav */}
      <nav style={{
        backgroundColor: '#fff',
        borderBottom: '1px solid #e5e7eb',
        padding: '0 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <span style={{ fontWeight: 700, fontSize: 16, color: '#111827', letterSpacing: -0.5 }}>
            SMB1001 Audit
          </span>
          <div style={{ display: 'flex', gap: 24 }}>
            {navLink('/dashboard', 'Dashboard')}
            {navLink('/controls', 'Controls')}
            {user?.role === 'admin' && navLink('/tenants', 'Tenants')}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Tenant selector */}
          {tenants.length > 1 && (
            <select
              value={currentTenant?.id ?? ''}
              onChange={(e) => {
                const t = tenants.find((t) => t.id === e.target.value);
                if (t) setCurrentTenant(t);
              }}
              style={{
                border: '1px solid #d1d5db',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 13,
                color: '#374151',
                cursor: 'pointer',
              }}
            >
              {tenants.map((t: Tenant) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
          {currentTenant && tenants.length === 1 && (
            <span style={{ fontSize: 13, color: '#6b7280' }}>{currentTenant.name}</span>
          )}
          <span style={{ fontSize: 13, color: '#374151' }}>
            {user?.firstName ?? user?.email}
            <span style={{
              marginLeft: 6,
              backgroundColor: user?.role === 'admin' ? '#dbeafe' : '#f3f4f6',
              color: user?.role === 'admin' ? '#1d4ed8' : '#6b7280',
              padding: '1px 6px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
            }}>
              {user?.role}
            </span>
          </span>
          <button
            onClick={handleLogout}
            style={{
              background: 'none',
              border: '1px solid #d1d5db',
              borderRadius: 6,
              padding: '4px 12px',
              cursor: 'pointer',
              fontSize: 13,
              color: '#6b7280',
            }}
          >
            Sign out
          </button>
        </div>
      </nav>

      {/* Page content */}
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 24px' }}>
        <Outlet />
      </main>
    </div>
  );
}
