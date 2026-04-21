import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTenant } from '../contexts/TenantContext';
import { taskApi, tenantApi } from '../services/api';
import type { Task, TaskStatus, TaskPriority } from '../types';

const STATUS_LABELS: Record<TaskStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const PRIORITY_COLORS: Record<TaskPriority, { bg: string; color: string }> = {
  critical: { bg: '#fef2f2', color: '#991b1b' },
  high:     { bg: '#fff7ed', color: '#9a3412' },
  medium:   { bg: '#fefce8', color: '#854d0e' },
  low:      { bg: '#f0fdf4', color: '#166534' },
};

const STATUS_COLORS: Record<TaskStatus, { bg: string; color: string }> = {
  open:        { bg: '#eff6ff', color: '#1d4ed8' },
  in_progress: { bg: '#fff7ed', color: '#9a3412' },
  resolved:    { bg: '#f0fdf4', color: '#166534' },
  closed:      { bg: '#f3f4f6', color: '#6b7280' },
};

const ACTIVE_STATUSES: TaskStatus[] = ['open', 'in_progress'];

interface UserOption { id: string; email: string; first_name: string | null; last_name: string | null; }

const BLANK_FORM = {
  title: '',
  description: '',
  priority: 'medium' as TaskPriority,
  assigned_to: '',
  due_date: '',
  control_ref: '',
};

export default function Tasks() {
  const { user } = useAuth();
  const { currentTenant } = useTenant();
  const canMutate = user?.role === 'admin' || user?.role === 'auditor';

  const [tasks, setTasks]     = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [users, setUsers]     = useState<UserOption[]>([]);

  // Create form
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState(BLANK_FORM);
  const [saving, setSaving]       = useState(false);
  const [formMsg, setFormMsg]     = useState<{ ok: boolean; text: string } | null>(null);

  // Inline edit state: taskId → field → value
  const [editing, setEditing]   = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Task>>({});

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadTasks = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (statusFilter !== 'all') params.status = statusFilter;
      const d = await taskApi.list(currentTenant.id, params);
      setTasks(d.tasks ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [currentTenant?.id, statusFilter]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  useEffect(() => {
    if (!currentTenant) return;
    tenantApi.listUsers(currentTenant.id)
      .then((d) => setUsers(d.users ?? []))
      .catch(() => {});
  }, [currentTenant?.id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTenant || !form.title.trim()) return;
    setSaving(true); setFormMsg(null);
    try {
      await taskApi.create(currentTenant.id, {
        title:       form.title.trim(),
        description: form.description || undefined,
        priority:    form.priority,
        assigned_to: form.assigned_to || null,
        due_date:    form.due_date    || null,
        control_ref: form.control_ref || null,
      });
      setFormMsg({ ok: true, text: 'Task created.' });
      setForm(BLANK_FORM);
      setShowForm(false);
      await loadTasks();
    } catch (err: unknown) {
      setFormMsg({ ok: false, text: (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Failed to create task' });
    } finally { setSaving(false); }
  };

  const startEdit = (task: Task) => {
    setEditing(task.id);
    setEditData({
      title:       task.title,
      description: task.description ?? '',
      priority:    task.priority,
      status:      task.status,
      assigned_to: task.assigned_to ?? '',
      due_date:    task.due_date    ?? '',
      resolution_notes: task.resolution_notes ?? '',
    });
  };

  const saveEdit = async (task: Task) => {
    if (!currentTenant) return;
    const payload: Record<string, unknown> = {
      title:       editData.title,
      description: editData.description || null,
      priority:    editData.priority,
      status:      editData.status,
      assigned_to: (editData.assigned_to as string) || null,
      due_date:    (editData.due_date as string)    || null,
      resolution_notes: (editData.resolution_notes as string) || null,
    };
    try {
      await taskApi.update(currentTenant.id, task.id, payload);
      setEditing(null);
      await loadTasks();
    } catch { /* ignore */ }
  };

  const handleDelete = async (taskId: string) => {
    if (!currentTenant) return;
    try {
      await taskApi.remove(currentTenant.id, taskId);
      setDeleteConfirm(null);
      await loadTasks();
    } catch { /* ignore */ }
  };

  const openCount = tasks.filter((t) => ACTIVE_STATUSES.includes(t.status)).length;
  const overdueCount = tasks.filter(
    (t) => ACTIVE_STATUSES.includes(t.status) && t.due_date && new Date(t.due_date) < new Date(),
  ).length;

  if (!currentTenant) {
    return <p style={{ color: '#9ca3af', fontSize: 14 }}>No tenant selected.</p>;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#111827', margin: '0 0 4px' }}>Tasks</h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            {openCount} open{overdueCount > 0 && (
              <span style={{ color: '#dc2626', fontWeight: 600 }}> · {overdueCount} overdue</span>
            )}
          </p>
        </div>
        {canMutate && (
          <button
            onClick={() => { setShowForm((v) => !v); setFormMsg(null); }}
            style={btnStyle(false)}
          >
            {showForm ? 'Cancel' : '+ New Task'}
          </button>
        )}
      </div>

      {/* Create form */}
      {showForm && canMutate && (
        <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 20, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: '0 0 16px' }}>New Task</h3>
          <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={labelStyle}>Title <span style={{ color: '#ef4444' }}>*</span></label>
              <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                required style={inputStyle} placeholder="e.g. Enable MFA on all admin accounts" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Priority</label>
                <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as TaskPriority }))} style={inputStyle}>
                  {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                    <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Assign To</label>
                <select value={form.assigned_to} onChange={(e) => setForm((f) => ({ ...f, assigned_to: e.target.value }))} style={inputStyle}>
                  <option value="">— Unassigned —</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.first_name ? `${u.first_name} ${u.last_name ?? ''}`.trim() : u.email}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>Due Date</label>
                <input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Control Ref <span style={{ color: '#9ca3af', fontWeight: 400 }}>(optional)</span></label>
                <input value={form.control_ref} onChange={(e) => setForm((f) => ({ ...f, control_ref: e.target.value }))}
                  style={inputStyle} placeholder="e.g. 1.2" />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Steps to resolve, context, links…" />
            </div>
            {formMsg && (
              <div style={{ backgroundColor: formMsg.ok ? '#dcfce7' : '#fee2e2', color: formMsg.ok ? '#16a34a' : '#991b1b', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}>
                {formMsg.text}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" disabled={saving} style={btnStyle(saving)}>{saving ? 'Creating…' : 'Create Task'}</button>
              <button type="button" onClick={() => setShowForm(false)} style={ghostBtn}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Status filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid #e5e7eb' }}>
        {(['all', 'open', 'in_progress', 'resolved', 'closed'] as const).map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} style={{
            padding: '7px 16px', fontSize: 13, fontWeight: 500, border: 'none', cursor: 'pointer',
            borderBottom: statusFilter === s ? '2px solid #2563eb' : '2px solid transparent',
            backgroundColor: 'transparent',
            color: statusFilter === s ? '#2563eb' : '#6b7280',
          }}>
            {s === 'all' ? 'All' : STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading ? (
        <p style={{ color: '#9ca3af', fontSize: 14 }}>Loading…</p>
      ) : tasks.length === 0 ? (
        <div style={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          No tasks found.{canMutate && ' Click "+ New Task" to create one.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tasks.map((task) => {
            const isEditing = editing === task.id;
            const isOverdue = ACTIVE_STATUSES.includes(task.status) && task.due_date && new Date(task.due_date) < new Date();

            if (isEditing) {
              return (
                <div key={task.id} style={{ backgroundColor: '#fff', border: '2px solid #2563eb', borderRadius: 10, padding: 16 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Title</label>
                      <input value={editData.title as string} onChange={(e) => setEditData((d) => ({ ...d, title: e.target.value }))} style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Status</label>
                      <select value={editData.status as string} onChange={(e) => setEditData((d) => ({ ...d, status: e.target.value as TaskStatus }))} style={inputStyle}>
                        {(Object.keys(STATUS_LABELS) as TaskStatus[]).map((s) => (
                          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Priority</label>
                      <select value={editData.priority as string} onChange={(e) => setEditData((d) => ({ ...d, priority: e.target.value as TaskPriority }))} style={inputStyle}>
                        {(Object.keys(PRIORITY_LABELS) as TaskPriority[]).map((p) => (
                          <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Assign To</label>
                      <select value={editData.assigned_to as string} onChange={(e) => setEditData((d) => ({ ...d, assigned_to: e.target.value }))} style={inputStyle}>
                        <option value="">— Unassigned —</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.first_name ? `${u.first_name} ${u.last_name ?? ''}`.trim() : u.email}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Due Date</label>
                      <input type="date" value={editData.due_date as string} onChange={(e) => setEditData((d) => ({ ...d, due_date: e.target.value }))} style={inputStyle} />
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={labelStyle}>Description</label>
                      <textarea value={editData.description as string} onChange={(e) => setEditData((d) => ({ ...d, description: e.target.value }))}
                        rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
                    </div>
                    {(editData.status === 'resolved' || editData.status === 'closed') && (
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={labelStyle}>Resolution Notes</label>
                        <textarea value={editData.resolution_notes as string} onChange={(e) => setEditData((d) => ({ ...d, resolution_notes: e.target.value }))}
                          rows={2} style={{ ...inputStyle, resize: 'vertical' }} placeholder="How was this resolved?" />
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => saveEdit(task)} style={btnStyle(false)}>Save</button>
                    <button onClick={() => setEditing(null)} style={ghostBtn}>Cancel</button>
                  </div>
                </div>
              );
            }

            return (
              <div key={task.id} style={{
                backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px',
                borderLeft: isOverdue ? '4px solid #dc2626' : '4px solid transparent',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{task.title}</span>
                      {task.control_ref && (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: '1px 6px', borderRadius: 4, backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                          Control {task.control_code ?? task.control_ref}
                        </span>
                      )}
                    </div>
                    {task.description && (
                      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 8px', lineHeight: 1.5 }}>{task.description}</p>
                    )}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Badge style={STATUS_COLORS[task.status]}>{STATUS_LABELS[task.status]}</Badge>
                      <Badge style={PRIORITY_COLORS[task.priority]}>{PRIORITY_LABELS[task.priority]}</Badge>
                      {task.assigned_to_name && (
                        <span style={{ fontSize: 12, color: '#6b7280' }}>→ {task.assigned_to_name}</span>
                      )}
                      {task.due_date && (
                        <span style={{ fontSize: 12, color: isOverdue ? '#dc2626' : '#6b7280', fontWeight: isOverdue ? 600 : 400 }}>
                          {isOverdue ? 'Overdue: ' : 'Due: '}{new Date(task.due_date).toLocaleDateString()}
                        </span>
                      )}
                      {task.resolved_at && (
                        <span style={{ fontSize: 12, color: '#9ca3af' }}>
                          Resolved {new Date(task.resolved_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    {task.resolution_notes && (
                      <p style={{ fontSize: 12, color: '#6b7280', margin: '6px 0 0', fontStyle: 'italic' }}>
                        {task.resolution_notes}
                      </p>
                    )}
                  </div>
                  {canMutate && (
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {deleteConfirm === task.id ? (
                        <>
                          <span style={{ fontSize: 12, color: '#374151', alignSelf: 'center' }}>Delete?</span>
                          <button onClick={() => handleDelete(task.id)} style={dangerBtn}>Yes</button>
                          <button onClick={() => setDeleteConfirm(null)} style={ghostBtn}>No</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => startEdit(task)} style={ghostBtn}>Edit</button>
                          <button onClick={() => setDeleteConfirm(task.id)} style={dangerBtn}>Delete</button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Badge({ children, style }: { children: React.ReactNode; style: { bg: string; color: string } }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 4,
      backgroundColor: style.bg, color: style.color,
    }}>
      {children}
    </span>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 5 };
const inputStyle: React.CSSProperties = { width: '100%', border: '1px solid #d1d5db', borderRadius: 6, padding: '8px 12px', fontSize: 14, color: '#111827', boxSizing: 'border-box' };
const btnStyle = (disabled: boolean): React.CSSProperties => ({
  alignSelf: 'flex-start', backgroundColor: disabled ? '#93c5fd' : '#2563eb',
  color: '#fff', border: 'none', borderRadius: 8, padding: '9px 20px',
  fontSize: 14, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
});
const ghostBtn: React.CSSProperties = {
  backgroundColor: '#f3f4f6', color: '#374151', border: '1px solid #e5e7eb',
  borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
};
const dangerBtn: React.CSSProperties = {
  backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca',
  borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer',
};
