import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auditApi, reportApi } from '../services/api';
import { useTenant } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';
import { StatusBadge } from '../components/StatusBadge';
import type { Audit, AuditResult, Evidence, ResultStatus } from '../types';
import { TIERS, tierInfo } from '../utils/tiers';

// ── Constants ────────────────────────────────────────────────────────────────

const DOMAIN_ORDER = [
  'Technology Management',
  'Access Management',
  'Backup and Recovery',
  'Policies, Processes and Plans',
  'Education and Training',
];

const DOMAIN_COLORS: Record<string, string> = {
  'Technology Management':         '#2563eb',
  'Access Management':             '#7c3aed',
  'Backup and Recovery':           '#059669',
  'Policies, Processes and Plans': '#d97706',
  'Education and Training':        '#db2777',
};

const RESULT_STATUSES: ResultStatus[] = ['pass', 'fail', 'partial', 'not_applicable', 'manual_review'];

const STATUS_LABELS: Record<string, string> = {
  pass:           'Pass',
  fail:           'Fail',
  partial:        'Partial',
  not_applicable: 'N/A',
  manual_review:  'Manual Review',
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  pass:           { bg: '#dcfce7', color: '#166534' },
  fail:           { bg: '#fee2e2', color: '#991b1b' },
  partial:        { bg: '#fef3c7', color: '#92400e' },
  not_applicable: { bg: '#f3f4f6', color: '#6b7280' },
  manual_review:  { bg: '#dbeafe', color: '#1e40af' },
};

function isTierAchieved(results: AuditResult[], maxTier: number): boolean {
  const relevant = results.filter((r) => r.tier <= maxTier);
  if (relevant.length === 0) return false;
  return relevant.every((r) => r.status === 'pass' || r.status === 'not_applicable');
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function AuditDetail() {
  const { auditId } = useParams<{ auditId: string }>();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState<number>(0);

  // Tier filter (null = all)
  const [selectedTier, setSelectedTier] = useState<number | null>(null);

  // Drawer state
  const [selectedResult, setSelectedResult] = useState<AuditResult | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Evidence state
  const [evidenceMap, setEvidenceMap] = useState<Record<string, Evidence[]>>({});
  const [evidenceText, setEvidenceText] = useState<Record<string, string>>({});
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  // Notes local state (for the drawer)
  const [localNotes, setLocalNotes] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const canEdit = user?.role !== 'readonly';

  const load = useCallback(async () => {
    if (!currentTenant || !auditId) return;
    try {
      const data = await auditApi.getOne(currentTenant.id, auditId);
      setAudit(data);
    } catch {
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id, auditId]);

  useEffect(() => { load(); }, [load]);

  // Poll progress when running/queued
  useEffect(() => {
    if (!audit || !currentTenant || !['running', 'queued'].includes(audit.status)) return;
    const interval = setInterval(async () => {
      const p = await auditApi.getProgress(currentTenant.id, audit.id);
      setProgress(p.progress ?? 0);
      if (!['running', 'queued'].includes(p.status)) {
        load();
        clearInterval(interval);
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [audit?.status, currentTenant?.id, audit?.id]);

  // ── Event handlers ────────────────────────────────────────────────────

  const handleStatusChange = async (controlId: string, status: ResultStatus) => {
    if (!currentTenant || !auditId || !canEdit) return;
    await auditApi.updateResult(currentTenant.id, auditId, controlId, { status });
    setAudit((prev) => prev ? {
      ...prev,
      results: prev.results?.map((r) => r.control_id === controlId ? { ...r, status } : r),
    } : prev);
    setSelectedResult((prev) => prev?.control_id === controlId ? { ...prev, status } : prev);
  };

  const handleNotesSave = async (controlId: string, notes: string) => {
    if (!currentTenant || !auditId || !canEdit) return;
    await auditApi.updateResult(currentTenant.id, auditId, controlId, { notes });
    setAudit((prev) => prev ? {
      ...prev,
      results: prev.results?.map((r) => r.control_id === controlId ? { ...r, notes } : r),
    } : prev);
  };

  const loadEvidence = async (controlId: string) => {
    if (!currentTenant || !auditId) return;
    setEvidenceLoading(true);
    try {
      const data = await auditApi.listEvidence(currentTenant.id, auditId, controlId);
      setEvidenceMap((m) => ({ ...m, [controlId]: data.evidence ?? [] }));
    } finally {
      setEvidenceLoading(false);
    }
  };

  const handleTextEvidence = async (controlId: string) => {
    if (!currentTenant || !auditId || !evidenceText[controlId]?.trim()) return;
    await auditApi.addTextEvidence(currentTenant.id, auditId, controlId, evidenceText[controlId]);
    setEvidenceText((t) => ({ ...t, [controlId]: '' }));
    loadEvidence(controlId);
  };

  const handleFileUpload = async (controlId: string, file: File) => {
    if (!currentTenant || !auditId) return;
    await auditApi.uploadFileEvidence(currentTenant.id, auditId, controlId, file);
    loadEvidence(controlId);
  };

  const openDrawer = (result: AuditResult) => {
    setSelectedResult(result);
    setLocalNotes(result.notes ?? '');
    setDrawerOpen(true);
    if (!evidenceMap[result.control_id]) loadEvidence(result.control_id);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setSelectedResult(null), 250);
  };

  // ── Render ────────────────────────────────────────────────────────────

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading audit…</div>;
  if (!audit) return null;

  const results = audit.results ?? [];
  const scoreColor = audit.score != null ? (audit.score >= 80 ? '#16a34a' : audit.score >= 60 ? '#d97706' : '#dc2626') : '#9ca3af';

  // Filter by selected tier (cumulative: tier <= selectedTier)
  const filtered = selectedTier === null ? results : results.filter((r) => r.tier <= selectedTier);

  // Group by domain
  const grouped = DOMAIN_ORDER.map((domain) => ({
    domain,
    results: filtered.filter((r) => r.category === domain),
  })).filter((g) => g.results.length > 0);

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: '#111827' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 8 }}>
            ← Back to Dashboard
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>{audit.name}</h1>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 6 }}>
            <StatusBadge status={audit.status} size="md" />
            {audit.score != null && (
              <span style={{ fontSize: 18, fontWeight: 700, color: scoreColor }}>{audit.score}%</span>
            )}
            {audit.completed_at && (
              <span style={{ fontSize: 13, color: '#9ca3af' }}>
                Completed {new Date(audit.completed_at).toLocaleDateString('en-AU')}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {audit.status === 'completed' && (
            <>
              <button onClick={() => reportApi.downloadCSV(currentTenant!.id, audit.id)} style={actionBtn('#6b7280')}>
                Export CSV
              </button>
              <button onClick={() => reportApi.downloadPDF(currentTenant!.id, audit.id)} style={actionBtn('#7c3aed')}>
                Export PDF
              </button>
            </>
          )}
        </div>
      </div>

      {/* Progress bar for running audits */}
      {['running', 'queued'].includes(audit.status) && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#374151', marginBottom: 6 }}>
            <span>{audit.status === 'queued' ? 'Waiting to start…' : 'Running audit…'}</span>
            <span>{progress}%</span>
          </div>
          <div style={{ height: 8, backgroundColor: '#e5e7eb', borderRadius: 4 }}>
            <div style={{ height: '100%', width: `${progress}%`, backgroundColor: '#2563eb', borderRadius: 4, transition: 'width 0.5s ease' }} />
          </div>
        </div>
      )}

      {/* Summary stats */}
      {Object.keys(audit.summary).length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { key: 'pass',          label: 'Pass',   color: '#16a34a', bg: '#dcfce7' },
            { key: 'fail',          label: 'Fail',   color: '#dc2626', bg: '#fee2e2' },
            { key: 'partial',       label: 'Partial',color: '#d97706', bg: '#fef3c7' },
            { key: 'manual_review', label: 'Review', color: '#2563eb', bg: '#dbeafe' },
            { key: 'not_applicable',label: 'N/A',    color: '#9ca3af', bg: '#f3f4f6' },
          ].map(({ key, label, color, bg }) => (
            <div key={key} style={{ backgroundColor: bg, borderRadius: 8, padding: '12px 16px', textAlign: 'center' }}>
              <div style={{ fontSize: 26, fontWeight: 800, color }}>
                {(audit.summary as Record<string, number>)[key] ?? 0}
              </div>
              <div style={{ fontSize: 12, color, fontWeight: 500 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Certification tier strip */}
      {results.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 8px', fontWeight: 500 }}>Certification level:</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TIERS.map((t) => {
              const achieved = isTierAchieved(results, t.tier);
              const isSelected = selectedTier === t.tier;
              return (
                <button
                  key={t.tier}
                  onClick={() => setSelectedTier(isSelected ? null : t.tier)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '6px 14px', fontSize: 13, fontWeight: 600,
                    borderRadius: 20, cursor: 'pointer',
                    border: `2px solid ${achieved ? t.color : '#e5e7eb'}`,
                    backgroundColor: isSelected ? t.bg : achieved ? `${t.bg}88` : '#f9fafb',
                    color: achieved ? t.color : '#9ca3af',
                    transition: 'all 0.15s',
                    opacity: achieved ? 1 : 0.7,
                  }}
                  title={`${t.name} — ${t.maxControls} controls required${t.tier === 3 ? ' (requires external audit)' : ''}`}
                >
                  {achieved ? '✓' : '○'} {t.tier === 3 ? `★ ${t.name}` : t.name}
                </button>
              );
            })}
            {selectedTier !== null && (
              <button
                onClick={() => setSelectedTier(null)}
                style={{
                  padding: '6px 12px', fontSize: 12, fontWeight: 500, borderRadius: 20, cursor: 'pointer',
                  border: '1px solid #e5e7eb', backgroundColor: '#fff', color: '#9ca3af',
                }}
              >
                Show all
              </button>
            )}
          </div>
        </div>
      )}

      {/* Domain-grouped card grid */}
      {grouped.map(({ domain, results: domainResults }) => {
        const color = DOMAIN_COLORS[domain] ?? '#2563eb';
        const passCount = domainResults.filter((r) => r.status === 'pass').length;
        return (
          <div key={domain} style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 4, height: 20, backgroundColor: color, borderRadius: 2, flexShrink: 0 }} />
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#111827' }}>{domain}</h2>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                {passCount}/{domainResults.length} passed
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 10,
            }}>
              {domainResults.map((result) => {
                const ti = tierInfo(result.tier);
                const statusInfo = STATUS_COLORS[result.status] ?? STATUS_COLORS.manual_review;
                return (
                  <div
                    key={result.id}
                    onClick={() => openDrawer(result)}
                    style={{
                      backgroundColor: '#fff',
                      border: `1px solid #e5e7eb`,
                      borderLeft: `3px solid ${color}`,
                      borderRadius: 8,
                      padding: '12px 14px',
                      cursor: 'pointer',
                      transition: 'box-shadow 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                    }}
                  >
                    {/* Top row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color,
                        backgroundColor: `${color}18`, borderRadius: 4,
                        padding: '2px 6px', letterSpacing: '0.02em',
                      }}>
                        {result.control_code}
                      </span>
                      <span style={{
                        fontSize: 10, fontWeight: 600, color: ti.color,
                        backgroundColor: ti.bg, borderRadius: 4, padding: '2px 5px',
                      }}>
                        {ti.name}
                      </span>
                      {result.validation_type === 'automated' && (
                        <span style={{
                          fontSize: 10, color: '#2563eb',
                          backgroundColor: '#dbeafe', borderRadius: 4, padding: '2px 5px',
                        }}>auto</span>
                      )}
                    </div>

                    {/* Name */}
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', lineHeight: 1.4, marginBottom: 10 }}>
                      {result.control_name}
                    </div>

                    {/* Status */}
                    <span style={{
                      fontSize: 11, fontWeight: 600,
                      backgroundColor: statusInfo.bg, color: statusInfo.color,
                      borderRadius: 4, padding: '2px 7px',
                    }}>
                      {STATUS_LABELS[result.status] ?? result.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && results.length > 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', backgroundColor: '#fff', borderRadius: 10, border: '1px solid #e5e7eb' }}>
          No controls found for this filter.
        </div>
      )}

      {results.length === 0 && (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', backgroundColor: '#fff', borderRadius: 10, border: '1px solid #e5e7eb' }}>
          No results yet — audit may still be running.
        </div>
      )}

      {/* Backdrop */}
      <div
        onClick={closeDrawer}
        style={{
          position: 'fixed', inset: 0,
          backgroundColor: 'rgba(0,0,0,0.3)',
          zIndex: 100,
          opacity: drawerOpen ? 1 : 0,
          pointerEvents: drawerOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 480,
        backgroundColor: '#fff',
        zIndex: 101,
        boxShadow: '-4px 0 24px rgba(0,0,0,0.12)',
        transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.25s ease',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {selectedResult && (
          <DrawerContent
            result={selectedResult}
            evidence={evidenceMap[selectedResult.control_id] ?? []}
            evidenceLoading={evidenceLoading}
            evidenceText={evidenceText[selectedResult.control_id] ?? ''}
            localNotes={localNotes}
            canEdit={canEdit}
            onClose={closeDrawer}
            onStatusChange={(status) => handleStatusChange(selectedResult.control_id, status)}
            onNotesChange={setLocalNotes}
            onNotesSave={() => handleNotesSave(selectedResult.control_id, localNotes)}
            onEvidenceTextChange={(v) => setEvidenceText((t) => ({ ...t, [selectedResult.control_id]: v }))}
            onAddText={() => handleTextEvidence(selectedResult.control_id)}
            fileInputRef={fileInputRef}
          />
        )}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.png,.jpg,.jpeg,.docx,.doc,.xlsx,.xls"
        style={{ display: 'none' }}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && selectedResult) handleFileUpload(selectedResult.control_id, file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ── Drawer Content ───────────────────────────────────────────────────────────

interface DrawerProps {
  result: AuditResult;
  evidence: Evidence[];
  evidenceLoading: boolean;
  evidenceText: string;
  localNotes: string;
  canEdit: boolean;
  onClose: () => void;
  onStatusChange: (status: ResultStatus) => void;
  onNotesChange: (v: string) => void;
  onNotesSave: () => void;
  onEvidenceTextChange: (v: string) => void;
  onAddText: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

function DrawerContent({
  result, evidence, evidenceLoading, evidenceText, localNotes,
  canEdit, onClose, onStatusChange, onNotesChange, onNotesSave,
  onEvidenceTextChange, onAddText, fileInputRef,
}: DrawerProps) {
  const color = DOMAIN_COLORS[result.category] ?? '#2563eb';
  const ti = tierInfo(result.tier);
  const statusInfo = STATUS_COLORS[result.status] ?? STATUS_COLORS.manual_review;

  return (
    <>
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 12, fontWeight: 700, color,
                backgroundColor: `${color}18`, borderRadius: 4, padding: '2px 8px',
              }}>
                {result.control_code}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: ti.color, backgroundColor: ti.bg, borderRadius: 4, padding: '2px 6px' }}>
                {ti.name}
              </span>
              {result.validation_type === 'automated' && (
                <span style={{ fontSize: 11, color: '#2563eb', backgroundColor: '#dbeafe', borderRadius: 4, padding: '2px 6px' }}>
                  Automated
                </span>
              )}
              <span style={{
                fontSize: 11, fontWeight: 600,
                backgroundColor: statusInfo.bg, color: statusInfo.color,
                borderRadius: 4, padding: '2px 6px',
              }}>
                {STATUS_LABELS[result.status] ?? result.status}
              </span>
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#111827', lineHeight: 1.3 }}>
              {result.control_name}
            </h2>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>{result.category}</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9ca3af', padding: 4, fontSize: 22, lineHeight: 1, flexShrink: 0 }}
          >
            ×
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 20px', flex: 1 }}>
        {/* Description */}
        <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: '0 0 14px' }}>
          {result.description}
        </p>

        {/* Evidence requirements */}
        {result.evidence_requirements && (
          <div style={{
            backgroundColor: '#fffbeb', border: '1px solid #fde68a',
            borderRadius: 6, padding: '10px 12px', marginBottom: 14,
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#92400e', margin: '0 0 4px' }}>Evidence Requirements</p>
            <p style={{ fontSize: 12, color: '#78350f', margin: 0, lineHeight: 1.5 }}>{result.evidence_requirements}</p>
          </div>
        )}

        {/* Remediation guidance */}
        {result.remediation_guidance && (
          <div style={{
            backgroundColor: '#fffbeb', border: '1px solid #fde68a',
            borderRadius: 6, padding: '10px 12px', marginBottom: 14,
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#92400e', margin: '0 0 4px' }}>Remediation Guidance</p>
            <p style={{ fontSize: 12, color: '#78350f', margin: 0, lineHeight: 1.5 }}>{result.remediation_guidance}</p>
          </div>
        )}

        {/* Status + Notes form */}
        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 16, marginBottom: 0 }}>
          {/* Status */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
              Status
            </label>
            {canEdit ? (
              <select
                value={result.status}
                onChange={(e) => onStatusChange(e.target.value as ResultStatus)}
                style={{
                  width: '100%', padding: '7px 10px', fontSize: 13,
                  border: '1px solid #d1d5db', borderRadius: 6, color: '#111827',
                  backgroundColor: '#fff',
                }}
              >
                {RESULT_STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                ))}
              </select>
            ) : (
              <span style={{
                fontSize: 13, fontWeight: 600,
                backgroundColor: statusInfo.bg, color: statusInfo.color,
                borderRadius: 6, padding: '5px 10px', display: 'inline-block',
              }}>
                {STATUS_LABELS[result.status] ?? result.status}
              </span>
            )}
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 4 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
              Notes
            </label>
            <textarea
              value={localNotes}
              disabled={!canEdit}
              onChange={(e) => onNotesChange(e.target.value)}
              onBlur={onNotesSave}
              placeholder="Add notes…"
              rows={4}
              style={{
                width: '100%', padding: '8px 10px', fontSize: 13,
                border: '1px solid #d1d5db', borderRadius: 6, color: '#111827',
                backgroundColor: canEdit ? '#fff' : '#f9fafb',
                resize: 'vertical', lineHeight: 1.5, boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        {/* Evidence section */}
        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 16, marginTop: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#374151', margin: '0 0 12px' }}>
            Evidence &amp; Documentation
          </h3>

          {evidenceLoading ? (
            <p style={{ fontSize: 12, color: '#9ca3af' }}>Loading…</p>
          ) : evidence.length === 0 ? (
            <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 12 }}>No evidence attached yet.</p>
          ) : (
            <div style={{ marginBottom: 12 }}>
              {evidence.map((ev) => (
                <div key={ev.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '8px 0', borderBottom: '1px solid #f9fafb',
                }}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{ev.type === 'file' ? '📎' : '📝'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {ev.type === 'file' ? (
                      <p style={{ fontSize: 13, margin: 0, fontWeight: 500, color: '#111827', wordBreak: 'break-all' }}>
                        {ev.file_name}
                        {ev.file_size != null && (
                          <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>
                            ({Math.round(ev.file_size / 1024)}KB)
                          </span>
                        )}
                      </p>
                    ) : (
                      <p style={{ fontSize: 13, margin: 0, color: '#374151', lineHeight: 1.4 }}>{ev.content}</p>
                    )}
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '2px 0 0' }}>
                      {ev.uploader_name} · {new Date(ev.created_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {canEdit && (
            <>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                <input
                  type="text"
                  value={evidenceText}
                  onChange={(e) => onEvidenceTextChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onAddText(); }}
                  placeholder="Add text evidence…"
                  style={{
                    flex: 1, padding: '7px 10px', fontSize: 13,
                    border: '1px solid #d1d5db', borderRadius: 6, color: '#111827',
                  }}
                />
                <button
                  onClick={onAddText}
                  disabled={!evidenceText.trim()}
                  style={{
                    padding: '7px 14px', fontSize: 13, fontWeight: 500,
                    backgroundColor: evidenceText.trim() ? '#2563eb' : '#e5e7eb',
                    color: evidenceText.trim() ? '#fff' : '#9ca3af',
                    border: 'none', borderRadius: 6,
                    cursor: evidenceText.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Add
                </button>
              </div>

              <button
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%', padding: '8px 0', fontSize: 13, fontWeight: 500,
                  backgroundColor: '#f9fafb', color: '#374151',
                  border: '1px dashed #d1d5db', borderRadius: 6, cursor: 'pointer',
                }}
              >
                Upload file (PDF, image, document)
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
}

const actionBtn = (color: string): React.CSSProperties => ({
  backgroundColor: color,
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '7px 14px',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 600,
});
