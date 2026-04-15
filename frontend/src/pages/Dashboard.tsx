import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { assessmentApi } from '../services/api';
import { useTenant } from '../contexts/TenantContext';
import type { Tenant } from '../types';

interface TenantSummary {
  pass: number;
  fail: number;
  partial: number;
  not_applicable: number;
  not_assessed: number;
  total: number;
  overdue: number;
}

const EMPTY: TenantSummary = { pass: 0, fail: 0, partial: 0, not_applicable: 0, not_assessed: 0, total: 0, overdue: 0 };

export default function Dashboard() {
  const { tenants, currentTenant, setCurrentTenant } = useTenant();
  const navigate = useNavigate();

  const [summaries, setSummaries] = useState<Record<string, TenantSummary>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenants.length) { setLoading(false); return; }
    setLoading(true);
    Promise.all(
      tenants.map(async (t) => {
        try {
          const s = await assessmentApi.summary(t.id);
          return [t.id, s] as const;
        } catch {
          return [t.id, EMPTY] as const;
        }
      }),
    ).then((results) => {
      setSummaries(Object.fromEntries(results));
      setLoading(false);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenants.length]);

  const handleView = (tenant: Tenant) => {
    setCurrentTenant(tenant);
    navigate('/controls');
  };

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading…</div>;
  }

  const totalClients = tenants.length;
  const totalOverdue = Object.values(summaries).reduce((n, s) => n + s.overdue, 0);

  return (
    <div>
      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Dashboard</h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '4px 0 0' }}>
          {totalClients} client{totalClients !== 1 ? 's' : ''} · SMB1001:2026 compliance register
          {totalOverdue > 0 && (
            <span style={{ color: '#dc2626', fontWeight: 600, marginLeft: 12 }}>
              ⚠ {totalOverdue} overdue review{totalOverdue !== 1 ? 's' : ''}
            </span>
          )}
        </p>
      </div>

      {/* Client table */}
      <div style={{ backgroundColor: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {/* Column headers */}
        <div style={headerRow}>
          <span>Client</span>
          <span style={{ textAlign: 'center' }}>Pass</span>
          <span style={{ textAlign: 'center' }}>Fail</span>
          <span style={{ textAlign: 'center' }}>Partial</span>
          <span style={{ textAlign: 'center' }}>N/A</span>
          <span style={{ textAlign: 'center' }}>Unassessed</span>
          <span style={{ textAlign: 'center' }}>Overdue</span>
          <span />
        </div>

        {tenants.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: '#9ca3af' }}>
            No clients found.
          </div>
        ) : (
          tenants.map((tenant, i) => {
            const s = summaries[tenant.id] ?? EMPTY;
            const assessed = s.pass + s.fail + s.partial + s.not_applicable;
            const pct = s.total > 0 ? Math.round((s.pass / s.total) * 100) : 0;
            const isSelected = currentTenant?.id === tenant.id;

            return (
              <div
                key={tenant.id}
                style={{
                  borderTop: i === 0 ? 'none' : '1px solid #f3f4f6',
                  backgroundColor: isSelected ? '#eff6ff' : '#fff',
                }}
              >
                {/* Stacked colour bar */}
                {assessed > 0 && (
                  <div style={{ display: 'flex', height: 3 }}>
                    {s.pass > 0         && <div style={{ flex: s.pass,          backgroundColor: '#16a34a' }} />}
                    {s.fail > 0         && <div style={{ flex: s.fail,          backgroundColor: '#dc2626' }} />}
                    {s.partial > 0      && <div style={{ flex: s.partial,       backgroundColor: '#d97706' }} />}
                    {s.not_applicable > 0 && <div style={{ flex: s.not_applicable, backgroundColor: '#d1d5db' }} />}
                    {s.not_assessed > 0 && <div style={{ flex: s.not_assessed,  backgroundColor: '#f3f4f6' }} />}
                  </div>
                )}

                {/* Data row */}
                <div style={dataRow}>
                  {/* Client name + sub-line */}
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{tenant.name}</div>
                    <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                      {assessed === 0
                        ? 'No assessments yet'
                        : `${pct}% compliant · ${assessed} / ${s.total} assessed`}
                    </div>
                  </div>

                  <CountCell value={s.pass}          colour='#16a34a' />
                  <CountCell value={s.fail}          colour='#dc2626' />
                  <CountCell value={s.partial}       colour='#d97706' />
                  <CountCell value={s.not_applicable} colour='#9ca3af' dim />
                  <CountCell value={s.not_assessed}   colour='#9ca3af' dim />

                  {/* Overdue */}
                  <div style={{ textAlign: 'center' }}>
                    {s.overdue > 0 ? (
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>⚠ {s.overdue}</span>
                    ) : (
                      <span style={{ fontSize: 13, color: '#e5e7eb' }}>—</span>
                    )}
                  </div>

                  {/* Action */}
                  <div style={{ textAlign: 'right' }}>
                    <button
                      onClick={() => handleView(tenant)}
                      style={{
                        backgroundColor: isSelected ? '#2563eb' : 'transparent',
                        color: isSelected ? '#fff' : '#2563eb',
                        border: `1px solid ${isSelected ? '#2563eb' : '#93c5fd'}`,
                        borderRadius: 6,
                        padding: '5px 14px',
                        cursor: 'pointer',
                        fontSize: 13,
                        fontWeight: 500,
                      }}
                    >
                      View Controls
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 20, marginTop: 14, paddingLeft: 4 }}>
        {[
          { colour: '#16a34a', label: 'Pass' },
          { colour: '#dc2626', label: 'Fail' },
          { colour: '#d97706', label: 'Partial' },
          { colour: '#9ca3af', label: 'N/A' },
          { colour: '#d1d5db', label: 'Unassessed' },
        ].map(({ colour, label }) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#6b7280' }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: colour }} />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}

function CountCell({ value, colour, dim = false }: { value: number; colour: string; dim?: boolean }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <span style={{ fontSize: 17, fontWeight: 700, color: value === 0 ? '#e5e7eb' : dim ? '#9ca3af' : colour }}>
        {value}
      </span>
    </div>
  );
}

const headerRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 64px 64px 72px 64px 100px 80px 130px',
  padding: '9px 16px',
  backgroundColor: '#f9fafb',
  borderBottom: '1px solid #e5e7eb',
  fontSize: 11,
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const dataRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 64px 64px 72px 64px 100px 80px 130px',
  padding: '14px 16px',
  alignItems: 'center',
};
