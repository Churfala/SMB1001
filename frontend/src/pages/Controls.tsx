import React, { useEffect, useState, useCallback, useRef } from 'react';
import { controlApi, assessmentApi } from '../services/api';
import { useTenant } from '../contexts/TenantContext';
import { useAuth } from '../contexts/AuthContext';
import type { Control, Assessment, AssessmentEvidence, AssessmentStatus } from '../types';
import { TIERS, tierInfo } from '../utils/tiers';

// Domain display order
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

const STATUS_LABELS: Record<string, string> = {
  not_assessed:   'Not Assessed',
  pass:           'Pass',
  fail:           'Fail',
  partial:        'Partial',
  not_applicable: 'N/A',
};

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  not_assessed:   { bg: '#f3f4f6', color: '#6b7280' },
  pass:           { bg: '#dcfce7', color: '#166534' },
  fail:           { bg: '#fee2e2', color: '#991b1b' },
  partial:        { bg: '#fef3c7', color: '#92400e' },
  not_applicable: { bg: '#f3f4f6', color: '#6b7280' },
};

const ASSESSMENT_STATUSES: AssessmentStatus[] = ['not_assessed', 'pass', 'partial', 'fail', 'not_applicable'];

function isOverdue(reviewDate: string | null): boolean {
  if (!reviewDate) return false;
  return new Date(reviewDate) < new Date(new Date().toDateString());
}

export default function Controls() {
  const { currentTenant } = useTenant();
  const { user } = useAuth();
  const canEdit = user?.role !== 'readonly';

  const [controls, setControls] = useState<Control[]>([]);
  const [assessmentMap, setAssessmentMap] = useState<Map<string, Assessment>>(new Map());
  const [loading, setLoading] = useState(true);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);

  // Drawer state
  const [selectedControl, setSelectedControl] = useState<Control | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerAssessment, setDrawerAssessment] = useState<Assessment | null>(null);
  const [evidence, setEvidence] = useState<AssessmentEvidence[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [textInput, setTextInput] = useState('');
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Load controls + assessments ──────────────────────────────────────
  const load = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const [ctrlData, asmData] = await Promise.all([
        controlApi.list({ limit: 100 }),
        assessmentApi.list(currentTenant.id),
      ]);
      setControls(ctrlData.controls ?? []);
      const map = new Map<string, Assessment>();
      for (const a of (asmData.assessments ?? [])) {
        map.set(a.control_db_id, a);
      }
      setAssessmentMap(map);
    } finally {
      setLoading(false);
    }
  }, [currentTenant?.id]);

  useEffect(() => { load(); }, [load]);

  // ── Open drawer ──────────────────────────────────────────────────────
  const openDrawer = async (control: Control) => {
    setSelectedControl(control);
    const existing = assessmentMap.get(control.id);
    setDrawerAssessment(existing ?? {
      control_db_id: control.id,
      control_id: control.control_id,
      control_name: control.name,
      category: control.category,
      tier: control.tier,
      assessment_id: null,
      status: 'not_assessed',
      notes: null,
      review_date: null,
      reviewed_by: null,
    });
    setDrawerOpen(true);
    setTextInput('');

    if (!currentTenant) return;
    setEvidenceLoading(true);
    try {
      const data = await assessmentApi.listEvidence(currentTenant.id, control.control_id);
      setEvidence(data.evidence ?? []);
    } finally {
      setEvidenceLoading(false);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setSelectedControl(null), 250);
  };

  // ── Save assessment field ────────────────────────────────────────────
  const saveField = async (field: 'status' | 'notes' | 'review_date', value: string | null) => {
    if (!currentTenant || !selectedControl || !canEdit) return;
    setSaving(true);
    try {
      const current = drawerAssessment;
      const updated = await assessmentApi.upsert(currentTenant.id, selectedControl.control_id, {
        status:      field === 'status'      ? value : (current?.status ?? 'not_assessed'),
        notes:       field === 'notes'       ? value : (current?.notes ?? null),
        review_date: field === 'review_date' ? value : (current?.review_date ?? null),
      });
      const newAsm: Assessment = {
        control_db_id: selectedControl.id,
        control_id: selectedControl.control_id,
        control_name: selectedControl.name,
        category: selectedControl.category,
        tier: selectedControl.tier,
        assessment_id: updated.id,
        status: updated.status,
        notes: updated.notes,
        review_date: updated.review_date,
        reviewed_by: updated.reviewed_by,
      };
      setDrawerAssessment(newAsm);
      setAssessmentMap((prev) => new Map(prev).set(selectedControl.id, newAsm));
    } finally {
      setSaving(false);
    }
  };

  // ── Evidence handlers ────────────────────────────────────────────────
  const handleAddText = async () => {
    if (!currentTenant || !selectedControl || !textInput.trim()) return;
    const ev = await assessmentApi.addTextEvidence(currentTenant.id, selectedControl.control_id, textInput.trim());
    setEvidence((p) => [...p, ev]);
    setTextInput('');
    // Refresh assessment map so assessment_id is populated
    if (!drawerAssessment?.assessment_id) {
      const data = await assessmentApi.list(currentTenant.id);
      const map = new Map<string, Assessment>();
      for (const a of (data.assessments ?? [])) map.set(a.control_db_id, a);
      setAssessmentMap(map);
    }
  };

  const handleFileUpload = async (file: File) => {
    if (!currentTenant || !selectedControl) return;
    const ev = await assessmentApi.uploadFileEvidence(currentTenant.id, selectedControl.control_id, file);
    setEvidence((p) => [...p, ev]);
    if (!drawerAssessment?.assessment_id) {
      const data = await assessmentApi.list(currentTenant.id);
      const map = new Map<string, Assessment>();
      for (const a of (data.assessments ?? [])) map.set(a.control_db_id, a);
      setAssessmentMap(map);
    }
  };

  // ── Group controls by domain (respecting tier filter) ───────────────
  const visibleControls = selectedTier === null
    ? controls
    : controls.filter((c) => c.tier <= selectedTier);

  const grouped = DOMAIN_ORDER.map((domain) => ({
    domain,
    controls: visibleControls.filter((c) => c.category === domain),
  })).filter((g) => g.controls.length > 0);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#6b7280', fontFamily: 'system-ui, sans-serif' }}>
        Loading controls…
      </div>
    );
  }

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: '#111827' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Controls</h1>
        <p style={{ fontSize: 13, color: '#6b7280', margin: '4px 0 0' }}>
          SMB1001:2026 compliance register — {controls.length} controls across {grouped.length} domains
        </p>
      </div>

      {/* Tier filter bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>Filter by level:</span>
        <button
          onClick={() => setSelectedTier(null)}
          style={{
            padding: '4px 12px', fontSize: 12, fontWeight: 500, borderRadius: 6, cursor: 'pointer',
            border: `1px solid ${selectedTier === null ? '#6b7280' : '#e5e7eb'}`,
            backgroundColor: selectedTier === null ? '#374151' : '#fff',
            color: selectedTier === null ? '#fff' : '#374151',
          }}
        >
          All
        </button>
        {TIERS.map((t) => (
          <button
            key={t.tier}
            onClick={() => setSelectedTier(selectedTier === t.tier ? null : t.tier)}
            style={{
              padding: '4px 12px', fontSize: 12, fontWeight: 600, borderRadius: 6, cursor: 'pointer',
              border: `1px solid ${selectedTier === t.tier ? t.color : '#e5e7eb'}`,
              backgroundColor: selectedTier === t.tier ? t.bg : '#fff',
              color: selectedTier === t.tier ? t.color : '#6b7280',
              transition: 'all 0.15s',
            }}
          >
            {t.tier === 3 ? `★ ${t.name}` : t.name}
          </button>
        ))}
      </div>

      {/* Domain sections */}
      {grouped.map(({ domain, controls: domainControls }) => {
        const color = DOMAIN_COLORS[domain] ?? '#2563eb';
        const passCount = domainControls.filter((c) => assessmentMap.get(c.id)?.status === 'pass').length;
        return (
          <div key={domain} style={{ marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 4, height: 20, backgroundColor: color, borderRadius: 2, flexShrink: 0 }} />
              <h2 style={{ fontSize: 15, fontWeight: 600, margin: 0, color: '#111827' }}>{domain}</h2>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                {passCount}/{domainControls.length} passed
              </span>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 10,
            }}>
              {domainControls.map((control) => {
                const asm = assessmentMap.get(control.id);
                const overdue = isOverdue(asm?.review_date ?? null);
                const statusInfo = STATUS_COLORS[asm?.status ?? 'not_assessed'];
                return (
                  <div
                    key={control.id}
                    onClick={() => openDrawer(control)}
                    style={{
                      backgroundColor: overdue ? '#fff1f0' : '#fff',
                      border: `1px solid ${overdue ? '#fca5a5' : '#e5e7eb'}`,
                      borderRadius: 8,
                      padding: '12px 14px',
                      cursor: 'pointer',
                      transition: 'box-shadow 0.15s, border-color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.10)';
                      if (!overdue) (e.currentTarget as HTMLDivElement).style.borderColor = '#9ca3af';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLDivElement).style.boxShadow = 'none';
                      (e.currentTarget as HTMLDivElement).style.borderColor = overdue ? '#fca5a5' : '#e5e7eb';
                    }}
                  >
                    {/* Top row */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color,
                        backgroundColor: `${color}18`, borderRadius: 4,
                        padding: '2px 6px', letterSpacing: '0.02em',
                      }}>
                        {control.control_id}
                      </span>
                      {(() => { const ti = tierInfo(control.tier); return (
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: ti.color,
                          backgroundColor: ti.bg, borderRadius: 4,
                          padding: '2px 5px',
                        }}>
                          {ti.name}
                        </span>
                      ); })()}
                      {control.validation_type === 'automated' && (
                        <span style={{
                          fontSize: 10, color: '#2563eb',
                          backgroundColor: '#dbeafe', borderRadius: 4,
                          padding: '2px 5px',
                        }}>auto</span>
                      )}
                    </div>

                    {/* Name */}
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#111827', lineHeight: 1.4, marginBottom: 10 }}>
                      {control.name}
                    </div>

                    {/* Bottom row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600,
                        backgroundColor: statusInfo.bg, color: statusInfo.color,
                        borderRadius: 4, padding: '2px 7px',
                      }}>
                        {STATUS_LABELS[asm?.status ?? 'not_assessed']}
                      </span>
                      {asm?.review_date && (
                        <span style={{ fontSize: 11, color: overdue ? '#dc2626' : '#6b7280', fontWeight: overdue ? 600 : 400 }}>
                          {overdue ? '⚠ ' : ''}{new Date(asm.review_date + 'T00:00:00').toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

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
        {selectedControl && (
          <DrawerContent
            control={selectedControl}
            assessment={drawerAssessment}
            evidence={evidence}
            evidenceLoading={evidenceLoading}
            textInput={textInput}
            saving={saving}
            canEdit={canEdit}
            onClose={closeDrawer}
            onSaveField={saveField}
            onTextInputChange={setTextInput}
            onAddText={handleAddText}
            onDownloadEvidence={(evidenceId, filename) =>
              void assessmentApi.downloadEvidence(currentTenant!.id, selectedControl!.control_id, evidenceId, filename)
            }
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
          if (file) handleFileUpload(file);
          e.target.value = '';
        }}
      />
    </div>
  );
}

// ── Drawer Content ───────────────────────────────────────────────────────────

interface DrawerProps {
  control: Control;
  assessment: Assessment | null;
  evidence: AssessmentEvidence[];
  evidenceLoading: boolean;
  textInput: string;
  saving: boolean;
  canEdit: boolean;
  onClose: () => void;
  onSaveField: (field: 'status' | 'notes' | 'review_date', value: string | null) => void;
  onTextInputChange: (v: string) => void;
  onAddText: () => void;
  onDownloadEvidence: (evidenceId: string, filename: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
}

function DrawerContent({
  control, assessment, evidence, evidenceLoading, textInput,
  saving, canEdit, onClose, onSaveField, onTextInputChange, onAddText, onDownloadEvidence, fileInputRef,
}: DrawerProps) {
  const color = DOMAIN_COLORS[control.category] ?? '#2563eb';
  const overdue = isOverdue(assessment?.review_date ?? null);
  const [localNotes, setLocalNotes] = useState(assessment?.notes ?? '');

  useEffect(() => {
    setLocalNotes(assessment?.notes ?? '');
  }, [assessment?.notes]);

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
                {control.control_id}
              </span>
              {(() => { const ti = tierInfo(control.tier); return (
                <span style={{ fontSize: 11, fontWeight: 600, color: ti.color, backgroundColor: ti.bg, borderRadius: 4, padding: '2px 6px' }}>
                  {ti.name}
                </span>
              ); })()}
              {control.validation_type === 'automated' && (
                <span style={{ fontSize: 11, color: '#2563eb', backgroundColor: '#dbeafe', borderRadius: 4, padding: '2px 6px' }}>
                  Automated
                </span>
              )}
            </div>
            <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#111827', lineHeight: 1.3 }}>
              {control.name}
            </h2>
            <p style={{ fontSize: 12, color: '#9ca3af', margin: '4px 0 0' }}>{control.category}</p>
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
          {control.description}
        </p>

        {/* Evidence requirements */}
        {control.evidence_requirements && (
          <div style={{
            backgroundColor: '#fffbeb', border: '1px solid #fde68a',
            borderRadius: 6, padding: '10px 12px', marginBottom: 14,
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#92400e', margin: '0 0 4px' }}>Evidence Requirements</p>
            <p style={{ fontSize: 12, color: '#78350f', margin: 0, lineHeight: 1.5 }}>{control.evidence_requirements}</p>
          </div>
        )}

        {/* Remediation guidance */}
        {control.remediation_guidance && (
          <div style={{
            backgroundColor: '#fffbeb', border: '1px solid #fde68a',
            borderRadius: 6, padding: '10px 12px', marginBottom: 14,
          }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#92400e', margin: '0 0 4px' }}>Remediation Guidance</p>
            <p style={{ fontSize: 12, color: '#78350f', margin: 0, lineHeight: 1.5 }}>{control.remediation_guidance}</p>
          </div>
        )}

        {/* Assessment form */}
        <div style={{ borderTop: '1px solid #f3f4f6', paddingTop: 16, marginBottom: 0 }}>
          {saving && <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 8px', textAlign: 'right' }}>Saving…</p>}

          {/* Status */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
              Assessment Status
            </label>
            <select
              value={assessment?.status ?? 'not_assessed'}
              disabled={!canEdit}
              onChange={(e) => onSaveField('status', e.target.value)}
              style={{
                width: '100%', padding: '7px 10px', fontSize: 13,
                border: '1px solid #d1d5db', borderRadius: 6, color: '#111827',
                backgroundColor: canEdit ? '#fff' : '#f9fafb',
              }}
            >
              {ASSESSMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          {/* Review Date */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: overdue ? '#dc2626' : '#374151', marginBottom: 5 }}>
              {overdue ? '⚠ Review Date (Overdue)' : 'Next Review Date'}
            </label>
            <input
              type="date"
              value={assessment?.review_date ?? ''}
              disabled={!canEdit}
              onChange={(e) => onSaveField('review_date', e.target.value || null)}
              style={{
                width: '100%', padding: '7px 10px', fontSize: 13,
                border: `1px solid ${overdue ? '#fca5a5' : '#d1d5db'}`, borderRadius: 6,
                color: overdue ? '#dc2626' : '#111827',
                backgroundColor: canEdit ? '#fff' : '#f9fafb',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Notes */}
          <div style={{ marginBottom: 4 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 5 }}>
              Notes
            </label>
            <textarea
              value={localNotes}
              disabled={!canEdit}
              onChange={(e) => setLocalNotes(e.target.value)}
              onBlur={() => onSaveField('notes', localNotes || null)}
              placeholder="Add compliance notes, observations, or remediation actions…"
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
                      <button
                        onClick={() => onDownloadEvidence(ev.id, ev.file_name ?? '')}
                        style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          padding: 0, textAlign: 'left',
                        }}
                      >
                        <span style={{ fontSize: 13, fontWeight: 500, color: '#2563eb', wordBreak: 'break-all', textDecoration: 'underline' }}>
                          {ev.file_name}
                        </span>
                        {ev.file_size != null && (
                          <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 6 }}>
                            ({Math.round(ev.file_size / 1024)}KB)
                          </span>
                        )}
                      </button>
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
                  value={textInput}
                  onChange={(e) => onTextInputChange(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') onAddText(); }}
                  placeholder="Add text evidence…"
                  style={{
                    flex: 1, padding: '7px 10px', fontSize: 13,
                    border: '1px solid #d1d5db', borderRadius: 6, color: '#111827',
                  }}
                />
                <button
                  onClick={onAddText}
                  disabled={!textInput.trim()}
                  style={{
                    padding: '7px 14px', fontSize: 13, fontWeight: 500,
                    backgroundColor: textInput.trim() ? '#2563eb' : '#e5e7eb',
                    color: textInput.trim() ? '#fff' : '#9ca3af',
                    border: 'none', borderRadius: 6,
                    cursor: textInput.trim() ? 'pointer' : 'not-allowed',
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
