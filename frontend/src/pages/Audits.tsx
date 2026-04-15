import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { auditApi, reportApi } from '../services/api';
import { useTenant } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';
import { TIERS } from '../utils/tiers';
import type { Audit } from '../types';

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  pending:   { bg: '#f3f4f6', color: '#6b7280', label: 'Pending' },
  queued:    { bg: '#dbeafe', color: '#1d4ed8', label: 'Queued' },
  running:   { bg: '#dbeafe', color: '#1d4ed8', label: 'Running…' },
  completed: { bg: '#dcfce7', color: '#166534', label: 'Completed' },
  failed:    { bg: '#fee2e2', color: '#991b1b', label: 'Failed' },
  cancelled: { bg: '#f3f4f6', color: '#6b7280', label: 'Cancelled' },
};

function highestTier(tiers: Record<string, boolean> | null | undefined): number | null {
  if (!tiers) return null;
  for (let t = 5; t >= 1; t--) {
    if (tiers[t] === true || tiers[String(t)] === true) return t;
  }
  return null;
}

export default function Audits() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();
  const canRun = user?.role !== 'readonly';

  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(() => {
    if (!currentTenant) return;
    setLoading(true);
    auditApi.list(currentTenant.id, 50, 0)
      .then((d) => setAudits(d.audits ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentTenant?.id]);

  useEffect(() => { load(); }, [load]);

  const handleRunNow = async () => {
    if (!currentTenant) return;
    setRunning(true);
    setRunMsg(null);
    try {
      await auditApi.runNow(currentTenant.id);
      setRunMsg({ ok: true, text: 'Audit started — refresh in a moment to see it.' });
      setTimeout(() => { load(); setRunMsg(null); }, 3000);
    } catch (err: unknown) {
      setRunMsg({ ok: false, text: (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to start audit' });
    } finally {
      setRunning(false);
    }
  };

  if (!currentTenant) {
    return <div style={{ padding: 40, color: '#9ca3af', textAlign: 'center' }}>Select a client to view audits.</div>;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>Audits</h1>
          <p style={{ fontSize: 14, color: '#6b7280', margin: '4px 0 0' }}>{currentTenant.name}</p>
        </div>
        {canRun && (
          <button
            onClick={handleRunNow}
            disabled={running}
            style={{
              backgroundColor: running ? '#93c5fd' : '#2563eb',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '9px 20px', fontSize: 14, fontWeight: 600,
              cursor: running ? 'not-allowed' : 'pointer',
            }}
          >
            {running ? 'Starting…' : '+ Run Audit'}
          </button>
        )}
      </div>

      {runMsg && (
        <div style={{
          backgroundColor: runMsg.ok ? '#dcfce7' : '#fee2e2',
          color: runMsg.ok ? '#166534' : '#991b1b',
          borderRadius: 8, padding: '10px 16px', fontSize: 14, marginBottom: 16,
        }}>
          {runMsg.text}
        </div>
      )}

      {/* Audit list */}
      <div style={{ backgroundColor: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {/* Header row */}
        <div style={headerRow}>
          <span>Audit</span>
          <span>Status</span>
          <span style={{ textAlign: 'right' }}>Score</span>
          <span>Tier</span>
          <span>Date</span>
          <span />
        </div>

        {loading ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>Loading…</div>
        ) : audits.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
            No audits yet.{canRun ? ' Click "Run Audit" to start one.' : ''}
          </div>
        ) : (
          audits.map((audit, i) => {
            const st = STATUS_STYLE[audit.status] ?? STATUS_STYLE.pending;
            const tier = highestTier(audit.summary?.tiers as Record<string, boolean> | null);
            const tierInfo = tier !== null ? TIERS.find((t) => t.tier === tier) : null;
            const date = audit.completed_at ?? audit.created_at;
            const isCompleted = audit.status === 'completed';

            return (
              <div
                key={audit.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 110px 80px 110px 130px 200px',
                  padding: '14px 16px',
                  alignItems: 'center',
                  borderTop: i === 0 ? 'none' : '1px solid #f3f4f6',
                }}
              >
                {/* Name */}
                <div style={{ fontWeight: 500, color: '#111827', fontSize: 14 }}>{audit.name}</div>

                {/* Status */}
                <div>
                  <span style={{
                    backgroundColor: st.bg, color: st.color,
                    borderRadius: 5, padding: '2px 8px', fontSize: 12, fontWeight: 600,
                  }}>
                    {st.label}
                  </span>
                </div>

                {/* Score */}
                <div style={{ textAlign: 'right', fontSize: 15, fontWeight: 700, color: isCompleted ? '#111827' : '#d1d5db' }}>
                  {isCompleted && audit.score !== null ? `${audit.score}%` : '—'}
                </div>

                {/* Tier */}
                <div>
                  {tierInfo ? (
                    <span style={{
                      backgroundColor: tierInfo.bg, color: tierInfo.color,
                      borderRadius: 5, padding: '2px 8px', fontSize: 12, fontWeight: 600,
                    }}>
                      {tierInfo.name}
                    </span>
                  ) : (
                    <span style={{ color: '#d1d5db', fontSize: 13 }}>—</span>
                  )}
                </div>

                {/* Date */}
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  {date ? new Date(date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button
                    onClick={() => navigate(`/audits/${audit.id}`)}
                    style={actionBtn}
                  >
                    View
                  </button>
                  {isCompleted && (
                    <>
                      <button
                        onClick={() => reportApi.downloadPDF(currentTenant.id, audit.id)}
                        style={actionBtn}
                      >
                        PDF
                      </button>
                      <button
                        onClick={() => reportApi.downloadCSV(currentTenant.id, audit.id)}
                        style={actionBtn}
                      >
                        CSV
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const headerRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 110px 80px 110px 130px 200px',
  padding: '9px 16px',
  backgroundColor: '#f9fafb',
  borderBottom: '1px solid #e5e7eb',
  fontSize: 11,
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const actionBtn: React.CSSProperties = {
  backgroundColor: '#f3f4f6', color: '#374151',
  border: '1px solid #e5e7eb', borderRadius: 6,
  padding: '4px 12px', fontSize: 12, fontWeight: 500,
  cursor: 'pointer',
};
