import React, { useEffect, useState } from 'react';
import { controlApi } from '../services/api';
import { SeverityBadge } from '../components/StatusBadge';
import type { Control } from '../types';

export default function Controls() {
  const [controls, setControls] = useState<Control[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState('');
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const params: Record<string, string> = {};
    if (selectedCategory) params.category = selectedCategory;
    if (selectedSeverity) params.severity = selectedSeverity;

    controlApi.list(params).then((data) => {
      setControls(data.controls ?? []);
      if (data.categories) setCategories(data.categories);
    }).finally(() => setLoading(false));
  }, [selectedCategory, selectedSeverity]);

  const typeBadge = (t: string) => {
    const colors: Record<string, string> = { automated: '#16a34a', manual: '#6b7280', hybrid: '#7c3aed' };
    return (
      <span style={{ fontSize: 10, fontWeight: 600, color: colors[t] ?? '#6b7280', border: `1px solid ${colors[t] ?? '#6b7280'}`, borderRadius: 3, padding: '1px 5px', textTransform: 'uppercase' }}>
        {t}
      </span>
    );
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: 0 }}>SMB1001 Controls</h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '4px 0 0' }}>{controls.length} controls in the catalogue</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} style={selectStyle}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={selectedSeverity} onChange={(e) => setSelectedSeverity(e.target.value)} style={selectStyle}>
          <option value="">All Severities</option>
          {['critical', 'high', 'medium', 'low'].map((s) => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>
      </div>

      <div style={{ backgroundColor: '#fff', borderRadius: 10, border: '1px solid #e5e7eb' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#6b7280' }}>Loading…</div>
        ) : (
          controls.map((control, idx) => (
            <div key={control.id} style={{ borderTop: idx > 0 ? '1px solid #f3f4f6' : 'none' }}>
              <div
                onClick={() => setExpanded(expanded === control.id ? null : control.id)}
                style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', gap: 12, backgroundColor: expanded === control.id ? '#f9fafb' : '#fff' }}
              >
                <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', minWidth: 70 }}>{control.control_id}</span>
                <span style={{ flex: 1, fontSize: 14, color: '#111827', fontWeight: 500 }}>{control.name}</span>
                <span style={{ fontSize: 12, color: '#9ca3af', minWidth: 80 }}>{control.category}</span>
                <SeverityBadge severity={control.severity} />
                {typeBadge(control.validation_type)}
                <span style={{ color: '#9ca3af', fontSize: 12 }}>{expanded === control.id ? '▲' : '▼'}</span>
              </div>

              {expanded === control.id && (
                <div style={{ padding: '4px 16px 16px 16px', backgroundColor: '#f9fafb', borderTop: '1px solid #f3f4f6' }}>
                  <p style={{ fontSize: 13, color: '#374151', margin: '10px 0 12px' }}>{control.description}</p>
                  {control.evidence_requirements && (
                    <div style={{ marginBottom: 10 }}>
                      <strong style={{ fontSize: 12, color: '#374151' }}>Evidence Required:</strong>
                      <p style={{ fontSize: 12, color: '#6b7280', margin: '3px 0 0' }}>{control.evidence_requirements}</p>
                    </div>
                  )}
                  {control.remediation_guidance && (
                    <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '10px 12px' }}>
                      <strong style={{ fontSize: 12, color: '#92400e' }}>Remediation Guidance:</strong>
                      <p style={{ fontSize: 12, color: '#78350f', margin: '4px 0 0' }}>{control.remediation_guidance}</p>
                    </div>
                  )}
                  {control.references?.length > 0 && (
                    <div style={{ marginTop: 10, fontSize: 11, color: '#9ca3af' }}>
                      References: {control.references.join(' · ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  border: '1px solid #d1d5db',
  borderRadius: 6,
  padding: '6px 12px',
  fontSize: 13,
  color: '#374151',
  cursor: 'pointer',
  backgroundColor: '#fff',
};
