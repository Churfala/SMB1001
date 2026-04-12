import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { auditApi, reportApi } from '../services/api';
import { useTenant } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';
import { StatusBadge, SeverityBadge } from '../components/StatusBadge';
import type { Audit, AuditResult, Evidence, ResultStatus } from '../types';

const RESULT_STATUSES: ResultStatus[] = ['pass', 'fail', 'partial', 'not_applicable', 'manual_review'];

export default function AuditDetail() {
  const { auditId } = useParams<{ auditId: string }>();
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [audit, setAudit] = useState<Audit | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [expandedControl, setExpandedControl] = useState<string | null>(null);
  const [evidenceMap, setEvidenceMap] = useState<Record<string, Evidence[]>>({});
  const [evidenceText, setEvidenceText] = useState<Record<string, string>>({});
  const [progress, setProgress] = useState<number>(0);

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

  const handleStatusChange = async (controlId: string, status: ResultStatus) => {
    if (!currentTenant || !auditId || !canEdit) return;
    await auditApi.updateResult(currentTenant.id, auditId, controlId, { status });
    setAudit((prev) => prev ? {
      ...prev,
      results: prev.results?.map((r) => r.control_id === controlId ? { ...r, status } : r),
    } : prev);
  };

  const handleNotesSave = async (controlId: string, notes: string) => {
    if (!currentTenant || !auditId || !canEdit) return;
    await auditApi.updateResult(currentTenant.id, auditId, controlId, { notes });
  };

  const loadEvidence = async (controlId: string) => {
    if (!currentTenant || !auditId) return;
    const data = await auditApi.listEvidence(currentTenant.id, auditId, controlId);
    setEvidenceMap((m) => ({ ...m, [controlId]: data.evidence ?? [] }));
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

  const toggleControl = (controlId: string) => {
    const next = expandedControl === controlId ? null : controlId;
    setExpandedControl(next);
    if (next && !evidenceMap[controlId]) loadEvidence(controlId);
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading audit…</div>;
  if (!audit) return null;

  const results = audit.results ?? [];
  const categories = Array.from(new Set(results.map((r) => r.category))).sort();
  const filtered = selectedCategory ? results.filter((r) => r.category === selectedCategory) : results;

  const scoreColor = audit.score != null ? (audit.score >= 80 ? '#16a34a' : audit.score >= 60 ? '#d97706' : '#dc2626') : '#9ca3af';

  return (
    <div>
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
          {canEdit && ['pending', 'completed', 'failed'].includes(audit.status) && (
            <button onClick={async () => { await auditApi.run(currentTenant!.id, audit.id); load(); }} style={actionBtn('#059669')}>
              Run Audit
            </button>
          )}
          {canEdit && audit.status === 'completed' && (
            <button onClick={async () => { await auditApi.finalise(currentTenant!.id, audit.id); load(); }} style={actionBtn('#2563eb')}>
              Finalise
            </button>
          )}
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
            { key: 'pass', label: 'Pass', color: '#16a34a', bg: '#dcfce7' },
            { key: 'fail', label: 'Fail', color: '#dc2626', bg: '#fee2e2' },
            { key: 'partial', label: 'Partial', color: '#d97706', bg: '#fef3c7' },
            { key: 'manual_review', label: 'Review', color: '#2563eb', bg: '#dbeafe' },
            { key: 'not_applicable', label: 'N/A', color: '#9ca3af', bg: '#f3f4f6' },
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

      {/* Category filter */}
      {categories.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {['', ...categories].map((cat) => (
            <button
              key={cat || 'all'}
              onClick={() => setSelectedCategory(cat)}
              style={{
                border: '1px solid',
                borderColor: selectedCategory === cat ? '#2563eb' : '#d1d5db',
                backgroundColor: selectedCategory === cat ? '#eff6ff' : '#fff',
                color: selectedCategory === cat ? '#2563eb' : '#374151',
                borderRadius: 6,
                padding: '4px 12px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: selectedCategory === cat ? 600 : 400,
              }}
            >
              {cat || 'All Categories'}
            </button>
          ))}
        </div>
      )}

      {/* Controls list */}
      <div style={{ backgroundColor: '#fff', borderRadius: 10, border: '1px solid #e5e7eb' }}>
        {filtered.map((result: AuditResult, idx) => (
          <div key={result.control_id} style={{ borderTop: idx > 0 ? '1px solid #f3f4f6' : 'none' }}>
            {/* Control row */}
            <div
              onClick={() => toggleControl(result.control_id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                cursor: 'pointer',
                gap: 12,
                backgroundColor: expandedControl === result.control_id ? '#f9fafb' : '#fff',
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', minWidth: 70 }}>
                {result.control_code}
              </span>
              <span style={{ flex: 1, fontSize: 14, color: '#111827', fontWeight: 500 }}>
                {result.control_name}
              </span>
              <span style={{ fontSize: 12, color: '#9ca3af', minWidth: 80 }}>{result.category}</span>
              <SeverityBadge severity={result.severity} />

              {/* Status selector */}
              {canEdit ? (
                <select
                  value={result.status}
                  onChange={(e) => { e.stopPropagation(); handleStatusChange(result.control_id, e.target.value as ResultStatus); }}
                  onClick={(e) => e.stopPropagation()}
                  style={{ border: '1px solid #d1d5db', borderRadius: 5, padding: '3px 8px', fontSize: 12, cursor: 'pointer' }}
                >
                  {RESULT_STATUSES.map((s) => (
                    <option key={s} value={s}>{s.replace('_', ' ')}</option>
                  ))}
                </select>
              ) : (
                <StatusBadge status={result.status} />
              )}

              <span style={{ color: '#9ca3af', fontSize: 12 }}>{expandedControl === result.control_id ? '▲' : '▼'}</span>
            </div>

            {/* Expanded detail */}
            {expandedControl === result.control_id && (
              <div style={{ padding: '0 16px 16px 16px', backgroundColor: '#f9fafb', borderTop: '1px solid #f3f4f6' }}>
                <p style={{ fontSize: 13, color: '#374151', margin: '12px 0 8px' }}>{result.description}</p>

                {result.remediation_guidance && (
                  <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 12px', marginBottom: 12 }}>
                    <strong style={{ fontSize: 12, color: '#92400e' }}>Remediation:</strong>
                    <p style={{ fontSize: 12, color: '#78350f', margin: '4px 0 0' }}>{result.remediation_guidance}</p>
                  </div>
                )}

                {/* Notes */}
                {canEdit && (
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Notes</label>
                    <textarea
                      defaultValue={result.notes ?? ''}
                      onBlur={(e) => handleNotesSave(result.control_id, e.target.value)}
                      rows={2}
                      placeholder="Add notes…"
                      style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '6px 8px', fontSize: 12, boxSizing: 'border-box', resize: 'vertical' }}
                    />
                  </div>
                )}

                {/* Evidence */}
                <div>
                  <strong style={{ fontSize: 12, color: '#374151' }}>Evidence</strong>
                  {(evidenceMap[result.control_id] ?? []).map((ev: Evidence) => (
                    <div key={ev.id} style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 6, padding: '8px 10px', marginTop: 6, fontSize: 12 }}>
                      <div style={{ color: '#6b7280', marginBottom: 2 }}>
                        {ev.uploader_name} · {new Date(ev.created_at).toLocaleDateString('en-AU')}
                      </div>
                      {ev.type === 'text' ? (
                        <p style={{ margin: 0, color: '#374151' }}>{ev.content}</p>
                      ) : (
                        <span style={{ color: '#2563eb' }}>📎 {ev.file_name}</span>
                      )}
                    </div>
                  ))}

                  {canEdit && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input
                        value={evidenceText[result.control_id] ?? ''}
                        onChange={(e) => setEvidenceText((t) => ({ ...t, [result.control_id]: e.target.value }))}
                        placeholder="Add text evidence…"
                        style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 6, padding: '5px 8px', fontSize: 12 }}
                      />
                      <button
                        onClick={() => handleTextEvidence(result.control_id)}
                        style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}
                      >
                        Add
                      </button>
                      <label style={{ backgroundColor: '#6b7280', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', fontSize: 12 }}>
                        Upload
                        <input type="file" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(result.control_id, f); }} />
                      </label>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}

        {filtered.length === 0 && (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
            {results.length === 0 ? 'Run the audit to generate results.' : 'No controls in this category.'}
          </div>
        )}
      </div>
    </div>
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
