import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { auditApi } from '../services/api';
import { useTenant } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import type { Audit } from '../types';

const SCORE_COLOR = (s: number) => s >= 80 ? '#16a34a' : s >= 60 ? '#d97706' : '#dc2626';
const STATUS_COLORS = { pass: '#16a34a', fail: '#dc2626', partial: '#d97706', not_applicable: '#9ca3af', manual_review: '#3b82f6' };

export default function Dashboard() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newAuditName, setNewAuditName] = useState('');

  useEffect(() => {
    if (!currentTenant) return;
    setLoading(true);
    auditApi.list(currentTenant.id, 10).then((d) => setAudits(d.audits ?? [])).finally(() => setLoading(false));
  }, [currentTenant?.id]);

  const latestAudit = audits[0];
  const summary = latestAudit?.summary ?? {};

  const pieData = Object.entries(summary)
    .filter(([, v]) => (v as number) > 0)
    .map(([key, value]) => ({
      name: key.replace('_', ' '),
      value: value as number,
      color: (STATUS_COLORS as Record<string, string>)[key] ?? '#e5e7eb',
    }));

  const handleCreate = async () => {
    if (!currentTenant || !newAuditName.trim()) return;
    const audit = await auditApi.create(currentTenant.id, newAuditName.trim());
    navigate(`/audits/${audit.id}`);
  };

  const handleRun = async (auditId: string) => {
    if (!currentTenant) return;
    await auditApi.run(currentTenant.id, auditId);
    setAudits((prev) => prev.map((a) => a.id === auditId ? { ...a, status: 'queued' as const } : a));
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading…</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>
            {currentTenant?.name ?? 'Dashboard'}
          </h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: '4px 0 0' }}>SMB1001 Compliance Overview</p>
        </div>
        {user?.role !== 'readonly' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newAuditName}
              onChange={(e) => setNewAuditName(e.target.value)}
              placeholder="New audit name…"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 12px', fontSize: 13, width: 200 }}
            />
            <button
              onClick={handleCreate}
              disabled={!newAuditName.trim() || creating}
              style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              + New Audit
            </button>
          </div>
        )}
      </div>

      {/* Score + Summary cards */}
      {latestAudit && (
        <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, marginBottom: 24 }}>
          {/* Score circle */}
          <div style={{ backgroundColor: '#fff', borderRadius: 10, padding: 24, border: '1px solid #e5e7eb', textAlign: 'center' }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: SCORE_COLOR(latestAudit.score ?? 0) }}>
              {latestAudit.score != null ? `${latestAudit.score}%` : '–'}
            </div>
            <div style={{ fontSize: 13, color: '#6b7280', marginTop: 4 }}>Compliance Score</div>
            <div style={{ marginTop: 8 }}>
              <StatusBadge status={latestAudit.status} size="md" />
            </div>
          </div>

          {/* Pie + summary counts */}
          <div style={{ backgroundColor: '#fff', borderRadius: 10, padding: 24, border: '1px solid #e5e7eb', display: 'flex', gap: 24, alignItems: 'center' }}>
            {pieData.length > 0 && (
              <ResponsiveContainer width={160} height={140}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={65} dataKey="value" paddingAngle={2}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [v, String(n).replace('_', ' ')]} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 24px', flex: 1 }}>
              {Object.entries(summary).map(([key, val]) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: (STATUS_COLORS as Record<string, string>)[key] ?? '#e5e7eb' }} />
                  <span style={{ fontSize: 13, color: '#374151', textTransform: 'capitalize' }}>{key.replace('_', ' ')}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginLeft: 'auto' }}>{val as number}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Audits list */}
      <div style={{ backgroundColor: '#fff', borderRadius: 10, border: '1px solid #e5e7eb' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb' }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>Recent Audits</h2>
        </div>
        {audits.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
            No audits yet. Create one above to get started.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb' }}>
                {['Name', 'Status', 'Score', 'Created', 'Actions'].map((h) => (
                  <th key={h} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#6b7280', textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {audits.map((audit) => (
                <tr key={audit.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 16px', fontSize: 14, color: '#111827', fontWeight: 500 }}>
                    <button onClick={() => navigate(`/audits/${audit.id}`)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: 14, padding: 0, fontWeight: 500 }}>
                      {audit.name}
                    </button>
                  </td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge status={audit.status} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: audit.score != null ? SCORE_COLOR(audit.score) : '#9ca3af' }}>
                    {audit.score != null ? `${audit.score}%` : '–'}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#6b7280' }}>
                    {new Date(audit.created_at).toLocaleDateString('en-AU')}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => navigate(`/audits/${audit.id}`)} style={btnStyle('#2563eb')}>View</button>
                      {user?.role !== 'readonly' && ['pending', 'completed', 'failed'].includes(audit.status) && (
                        <button onClick={() => handleRun(audit.id)} style={btnStyle('#059669')}>Run</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const btnStyle = (color: string): React.CSSProperties => ({
  backgroundColor: 'transparent',
  color: color,
  border: `1px solid ${color}`,
  borderRadius: 5,
  padding: '3px 10px',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
});
