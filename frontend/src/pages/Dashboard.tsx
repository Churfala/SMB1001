import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { auditApi, tenantApi } from '../services/api';
import { useTenant } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import type { Audit } from '../types';

const SCORE_COLOR = (s: number) => s >= 80 ? '#16a34a' : s >= 60 ? '#d97706' : '#dc2626';
const STATUS_COLORS: Record<string, string> = {
  pass: '#16a34a',
  fail: '#dc2626',
  partial: '#d97706',
  not_applicable: '#9ca3af',
  manual_review: '#3b82f6',
};
const ACTIVE_STATUSES = ['pending', 'queued', 'running'];

export default function Dashboard() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [audits, setAudits] = useState<Audit[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [weeklyEnabled, setWeeklyEnabled] = useState(false);
  const [weeklyNextRun, setWeeklyNextRun] = useState<string | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [secureScore, setSecureScore] = useState<{ currentScore: number; maxScore: number; percentage: number; lastRefresh: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const latestAudit = audits[0] ?? null;
  const isActive = latestAudit ? ACTIVE_STATUSES.includes(latestAudit.status) : false;

  const loadAudits = async (tenantId: string) => {
    const d = await auditApi.list(tenantId, 10);
    const list: Audit[] = d.audits ?? [];
    setAudits(list);
    return list;
  };

  // Poll progress while latest audit is active
  useEffect(() => {
    if (!currentTenant || !latestAudit || !isActive) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    const tid = currentTenant.id;
    const aid = latestAudit.id;
    const poll = async () => {
      try {
        const p = await auditApi.getProgress(tid, aid);
        setProgress(typeof p.progress === 'number' ? p.progress : 0);
        if (!ACTIVE_STATUSES.includes(p.status)) {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          loadAudits(tid);
        }
      } catch { /* network error — keep polling */ }
    };
    poll();
    pollRef.current = setInterval(poll, 3000);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [currentTenant?.id, latestAudit?.id, isActive]);

  useEffect(() => {
    if (!currentTenant) return;
    setLoading(true);
    Promise.all([
      loadAudits(currentTenant.id),
      auditApi.getWeeklySchedule(currentTenant.id)
        .then((d) => { setWeeklyEnabled(d.enabled); setWeeklyNextRun(d.next_run ?? null); })
        .catch(() => {}),
      tenantApi.getSecureScore(currentTenant.id)
        .then((d) => setSecureScore(d))
        .catch(() => {}),
    ]).finally(() => setLoading(false));
  }, [currentTenant?.id]);

  const handleRunNow = async () => {
    if (!currentTenant || running || isActive) return;
    setRunning(true);
    try {
      const audit: Audit = await auditApi.runNow(currentTenant.id);
      setAudits((prev) => [audit, ...prev.filter((a) => a.id !== audit.id)]);
      setProgress(0);
    } catch { /* error shown by global handler */ }
    finally { setRunning(false); }
  };

  const handleWeeklyToggle = async () => {
    if (!currentTenant || weeklyLoading) return;
    const next = !weeklyEnabled;
    setWeeklyLoading(true);
    try {
      const d = await auditApi.setWeeklySchedule(currentTenant.id, next);
      setWeeklyEnabled(next);
      setWeeklyNextRun(d.next_run ?? null);
    } catch { /* ignore */ }
    finally { setWeeklyLoading(false); }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading…</div>;

  const summary = latestAudit?.summary ?? {};
  const summaryTotal = Object.values(summary).reduce((a, b) => a + (b as number), 0);
  const canRun = user?.role !== 'readonly';

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>
          {currentTenant?.name ?? 'Dashboard'}
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '4px 0 0' }}>Compliance Overview</p>
      </div>

      {/* ── Latest Audit Card ── */}
      <div style={{ backgroundColor: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: 24, marginBottom: 20 }}>
        {!latestAudit ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 15, color: '#6b7280', marginBottom: 16 }}>No audit has been run yet</div>
            {canRun && (
              <button onClick={handleRunNow} disabled={running} style={primaryBtn(running)}>
                {running ? 'Starting…' : 'Run Audit Now'}
              </button>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
              {/* Score + status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <div style={{
                  fontSize: 52, fontWeight: 800, lineHeight: 1,
                  color: latestAudit.score != null ? SCORE_COLOR(latestAudit.score) : '#9ca3af',
                }}>
                  {latestAudit.score != null ? `${latestAudit.score}%` : '–'}
                </div>
                <div>
                  <div style={{ marginBottom: 4 }}><StatusBadge status={latestAudit.status} size="md" /></div>
                  <div style={{ fontSize: 12, color: '#9ca3af' }}>
                    {latestAudit.completed_at
                      ? `Completed ${new Date(latestAudit.completed_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
                      : latestAudit.started_at
                        ? `Started ${new Date(latestAudit.started_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`
                        : `Created ${new Date(latestAudit.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {!isActive && (
                  <button onClick={() => navigate(`/audits/${latestAudit.id}`)} style={outlineBtn('#2563eb')}>
                    View Details
                  </button>
                )}
                {canRun && (
                  <button onClick={handleRunNow} disabled={running || isActive} style={primaryBtn(running || isActive)}>
                    {running ? 'Starting…' : isActive ? 'Running…' : 'Run Audit Now'}
                  </button>
                )}
              </div>
            </div>

            {/* Progress bar */}
            {isActive && (
              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                  <span>Audit in progress…</span><span>{progress}%</span>
                </div>
                <div style={{ height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${progress}%`, backgroundColor: '#2563eb', borderRadius: 3, transition: 'width 0.5s ease' }} />
                </div>
              </div>
            )}

            {/* Results breakdown bar */}
            {summaryTotal > 0 && !isActive && (
              <div style={{ marginTop: 20 }}>
                <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden', gap: 1 }}>
                  {Object.entries(STATUS_COLORS).map(([key, color]) => {
                    const val = (summary as Record<string, number>)[key] ?? 0;
                    if (!val) return null;
                    return <div key={key} style={{ flex: val, backgroundColor: color }} title={`${key.replace(/_/g, ' ')}: ${val}`} />;
                  })}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginTop: 10 }}>
                  {Object.entries(summary).filter(([, v]) => (v as number) > 0).map(([key, val]) => (
                    <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}>
                      <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: STATUS_COLORS[key] ?? '#e5e7eb' }} />
                      <span style={{ color: '#6b7280', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
                      <span style={{ fontWeight: 700, color: '#111827' }}>{val as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Microsoft Secure Score ── */}
      {secureScore && (
        <div style={{ backgroundColor: '#fff', borderRadius: 10, border: '1px solid #e5e7eb', padding: 24, marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, color: SCORE_COLOR(secureScore.percentage) }}>
                {secureScore.percentage}%
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', marginBottom: 2 }}>Microsoft Secure Score</div>
                <div style={{ fontSize: 13, color: '#6b7280' }}>
                  {secureScore.currentScore} / {secureScore.maxScore} points
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                  Last updated {new Date(secureScore.lastRefresh).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              </div>
            </div>
            {/* Score bar */}
            <div style={{ flex: 1, minWidth: 160, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
              <div style={{ height: 8, backgroundColor: '#e5e7eb', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${secureScore.percentage}%`, backgroundColor: SCORE_COLOR(secureScore.percentage), borderRadius: 4, transition: 'width 0.5s ease' }} />
              </div>
              <div style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>
                {secureScore.percentage >= 80 ? 'Good' : secureScore.percentage >= 50 ? 'Needs improvement' : 'Poor'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Weekly auto-run toggle (admin only) ── */}
      {user?.role === 'admin' && (
        <div style={{
          backgroundColor: '#fff', borderRadius: 10, border: '1px solid #e5e7eb',
          padding: '14px 20px', marginBottom: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>Weekly auto-run</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
              {weeklyEnabled && weeklyNextRun
                ? `Next run: ${new Date(weeklyNextRun).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}`
                : weeklyEnabled
                  ? 'Scheduled for next Monday at 9am'
                  : 'Runs every Monday at 9am when enabled'}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              onClick={weeklyLoading ? undefined : handleWeeklyToggle}
              style={{
                width: 44, height: 24, borderRadius: 12, position: 'relative',
                cursor: weeklyLoading ? 'not-allowed' : 'pointer',
                backgroundColor: weeklyEnabled ? '#2563eb' : '#d1d5db',
                transition: 'background-color 0.2s',
              }}
            >
              <div style={{
                position: 'absolute', top: 2, left: weeklyEnabled ? 22 : 2,
                width: 20, height: 20, borderRadius: '50%', backgroundColor: '#fff',
                transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
              }} />
            </div>
            <span style={{ fontSize: 13, color: weeklyEnabled ? '#2563eb' : '#6b7280', fontWeight: weeklyEnabled ? 600 : 400 }}>
              {weeklyLoading ? 'Saving…' : weeklyEnabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
        </div>
      )}

      {/* ── Audit History ── */}
      {audits.length > 0 && (
        <div style={{ backgroundColor: '#fff', borderRadius: 10, border: '1px solid #e5e7eb' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #e5e7eb' }}>
            <h2 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>Audit History</h2>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#f9fafb' }}>
                {['Date', 'Status', 'Score', ''].map((h, i) => (
                  <th key={i} style={{ padding: '10px 16px', fontSize: 12, fontWeight: 600, color: '#6b7280', textAlign: i === 3 ? 'right' : 'left', textTransform: 'uppercase', letterSpacing: 0.5 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {audits.map((audit) => (
                <tr key={audit.id} style={{ borderTop: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: '#374151' }}>
                    {new Date(audit.created_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                  <td style={{ padding: '12px 16px' }}><StatusBadge status={audit.status} /></td>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 600, color: audit.score != null ? SCORE_COLOR(audit.score) : '#9ca3af' }}>
                    {audit.score != null ? `${audit.score}%` : '–'}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                    <button onClick={() => navigate(`/audits/${audit.id}`)} style={outlineBtn('#2563eb')}>View</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const primaryBtn = (disabled: boolean): React.CSSProperties => ({
  backgroundColor: disabled ? '#93c5fd' : '#2563eb',
  color: '#fff', border: 'none', borderRadius: 7,
  padding: '8px 18px', fontSize: 14, fontWeight: 600,
  cursor: disabled ? 'not-allowed' : 'pointer',
});

const outlineBtn = (color: string): React.CSSProperties => ({
  backgroundColor: 'transparent', color,
  border: `1px solid ${color}`, borderRadius: 6,
  padding: '5px 12px', cursor: 'pointer', fontSize: 13, fontWeight: 500,
});
