import React from 'react';

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  pass: { bg: '#dcfce7', color: '#166534', label: 'Pass' },
  fail: { bg: '#fee2e2', color: '#991b1b', label: 'Fail' },
  partial: { bg: '#fef3c7', color: '#92400e', label: 'Partial' },
  not_applicable: { bg: '#f3f4f6', color: '#6b7280', label: 'N/A' },
  manual_review: { bg: '#dbeafe', color: '#1e40af', label: 'Review' },
  completed: { bg: '#dcfce7', color: '#166534', label: 'Completed' },
  running: { bg: '#dbeafe', color: '#1e40af', label: 'Running' },
  queued: { bg: '#e0e7ff', color: '#3730a3', label: 'Queued' },
  pending: { bg: '#f3f4f6', color: '#6b7280', label: 'Pending' },
  failed: { bg: '#fee2e2', color: '#991b1b', label: 'Failed' },
  cancelled: { bg: '#f3f4f6', color: '#9ca3af', label: 'Cancelled' },
};

const SEVERITY_STYLES: Record<string, { bg: string; color: string }> = {
  critical: { bg: '#fee2e2', color: '#991b1b' },
  high: { bg: '#fed7aa', color: '#9a3412' },
  medium: { bg: '#fef3c7', color: '#92400e' },
  low: { bg: '#f3f4f6', color: '#6b7280' },
};

interface StatusBadgeProps {
  status: string;
  size?: 'sm' | 'md';
}

export function StatusBadge({ status, size = 'sm' }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? { bg: '#f3f4f6', color: '#374151', label: status };
  const pad = size === 'md' ? '3px 10px' : '2px 7px';
  const fs = size === 'md' ? 12 : 11;

  return (
    <span style={{
      backgroundColor: style.bg,
      color: style.color,
      padding: pad,
      borderRadius: 4,
      fontSize: fs,
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {style.label}
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const style = SEVERITY_STYLES[severity] ?? { bg: '#f3f4f6', color: '#6b7280' };
  return (
    <span style={{
      backgroundColor: style.bg,
      color: style.color,
      padding: '2px 7px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      textTransform: 'uppercase',
    }}>
      {severity}
    </span>
  );
}
