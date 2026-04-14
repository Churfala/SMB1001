import axios, { AxiosInstance, AxiosError } from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

let authToken: string | null = null;
let refreshTokenValue: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function setRefreshToken(token: string | null): void {
  refreshTokenValue = token;
}

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

const api: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    if (error.response?.status === 401 && refreshTokenValue) {
      try {
        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, {
          refreshToken: refreshTokenValue,
        });
        authToken = data.accessToken;
        setAuthToken(data.accessToken);
        localStorage.setItem('accessToken', data.accessToken);

        if (error.config) {
          error.config.headers.Authorization = `Bearer ${authToken}`;
          return api.request(error.config);
        }
      } catch {
        onUnauthorized?.();
      }
    } else if (error.response?.status === 401) {
      onUnauthorized?.();
    }
    return Promise.reject(error);
  },
);

// Auth
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data),
  refresh: (refreshToken: string) =>
    api.post('/auth/refresh', { refreshToken }).then((r) => r.data),
  me: () => api.get('/auth/me').then((r) => r.data),
  changePassword: (currentPassword: string, newPassword: string) =>
    api.post('/auth/change-password', { currentPassword, newPassword }).then((r) => r.data),
};

// Tenants
export const tenantApi = {
  list: () => api.get('/tenants').then((r) => r.data),
  getOne: (id: string) => api.get(`/tenants/${id}`).then((r) => r.data),
  create: (name: string, slug: string) =>
    api.post('/tenants', { name, slug }).then((r) => r.data),
  update: (id: string, data: Record<string, unknown>) =>
    api.put(`/tenants/${id}`, data).then((r) => r.data),
  listUsers: (tenantId: string) =>
    api.get(`/tenants/${tenantId}/users`).then((r) => r.data),
  createUser: (tenantId: string, data: Record<string, unknown>) =>
    api.post(`/tenants/${tenantId}/users`, data).then((r) => r.data),
  updateUser: (tenantId: string, userId: string, data: Record<string, unknown>) =>
    api.put(`/tenants/${tenantId}/users/${userId}`, data).then((r) => r.data),
  deleteUser: (tenantId: string, userId: string) =>
    api.delete(`/tenants/${tenantId}/users/${userId}`),
  delete: (id: string) => api.delete(`/tenants/${id}`),
  listIntegrations: (tenantId: string) =>
    api.get(`/tenants/${tenantId}/integrations`).then((r) => r.data),
  upsertIntegration: (tenantId: string, data: Record<string, unknown>) =>
    api.post(`/tenants/${tenantId}/integrations`, data).then((r) => r.data),
  deleteIntegration: (tenantId: string, integrationId: string) =>
    api.delete(`/tenants/${tenantId}/integrations/${integrationId}`),
  getSecureScore: (tenantId: string) =>
    api.get(`/tenants/${tenantId}/secure-score`).then((r) => r.data),
};

// Audits
export const auditApi = {
  list: (tenantId: string, limit = 20, offset = 0) =>
    api.get(`/tenants/${tenantId}/audits`, { params: { limit, offset } }).then((r) => r.data),
  create: (tenantId: string, name: string) =>
    api.post(`/tenants/${tenantId}/audits`, { name }).then((r) => r.data),
  getOne: (tenantId: string, auditId: string) =>
    api.get(`/tenants/${tenantId}/audits/${auditId}`).then((r) => r.data),
  getProgress: (tenantId: string, auditId: string) =>
    api.get(`/tenants/${tenantId}/audits/${auditId}/progress`).then((r) => r.data),
  run: (tenantId: string, auditId: string) =>
    api.post(`/tenants/${tenantId}/audits/${auditId}/run`).then((r) => r.data),
  finalise: (tenantId: string, auditId: string) =>
    api.post(`/tenants/${tenantId}/audits/${auditId}/finalise`).then((r) => r.data),
  cancel: (tenantId: string, auditId: string) =>
    api.post(`/tenants/${tenantId}/audits/${auditId}/cancel`).then((r) => r.data),
  updateResult: (tenantId: string, auditId: string, controlId: string, data: Record<string, unknown>) =>
    api.put(`/tenants/${tenantId}/audits/${auditId}/results/${controlId}`, data).then((r) => r.data),
  listEvidence: (tenantId: string, auditId: string, controlId: string) =>
    api.get(`/tenants/${tenantId}/audits/${auditId}/results/${controlId}/evidence`).then((r) => r.data),
  addTextEvidence: (tenantId: string, auditId: string, controlId: string, content: string) =>
    api.post(`/tenants/${tenantId}/audits/${auditId}/results/${controlId}/evidence/text`, { content }).then((r) => r.data),
  uploadFileEvidence: (tenantId: string, auditId: string, controlId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/tenants/${tenantId}/audits/${auditId}/results/${controlId}/evidence/file`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
  downloadEvidence: async (tenantId: string, auditId: string, controlId: string, evidenceId: string, filename: string) => {
    const res = await api.get(
      `/tenants/${tenantId}/audits/${auditId}/results/${controlId}/evidence/${evidenceId}/download`,
      { responseType: 'blob' },
    );
    const objectUrl = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objectUrl);
  },
  listSchedules: (tenantId: string) =>
    api.get(`/tenants/${tenantId}/schedules`).then((r) => r.data),
  createSchedule: (tenantId: string, data: Record<string, unknown>) =>
    api.post(`/tenants/${tenantId}/schedules`, data).then((r) => r.data),
  deleteSchedule: (tenantId: string, scheduleId: string) =>
    api.delete(`/tenants/${tenantId}/schedules/${scheduleId}`),
  runNow: (tenantId: string) =>
    api.post(`/tenants/${tenantId}/audits/run-now`).then((r) => r.data),
  getWeeklySchedule: (tenantId: string) =>
    api.get(`/tenants/${tenantId}/weekly-schedule`).then((r) => r.data),
  setWeeklySchedule: (tenantId: string, enabled: boolean) =>
    api.put(`/tenants/${tenantId}/weekly-schedule`, { enabled }).then((r) => r.data),
};

// Controls
export const controlApi = {
  list: (params?: Record<string, unknown>) =>
    api.get('/controls', { params }).then((r) => r.data),
  getOne: (id: string) =>
    api.get(`/controls/${id}`).then((r) => r.data),
};

// Assessments (compliance register — persistent, per-tenant, per-control)
export const assessmentApi = {
  list: (tenantId: string) =>
    api.get(`/tenants/${tenantId}/assessments`).then((r) => r.data),
  upsert: (tenantId: string, controlId: string, data: { status?: string | null; notes?: string | null; review_date?: string | null }) =>
    api.put(`/tenants/${tenantId}/assessments/${controlId}`, data).then((r) => r.data),
  listEvidence: (tenantId: string, controlId: string) =>
    api.get(`/tenants/${tenantId}/assessments/${controlId}/evidence`).then((r) => r.data),
  addTextEvidence: (tenantId: string, controlId: string, content: string) =>
    api.post(`/tenants/${tenantId}/assessments/${controlId}/evidence/text`, { content }).then((r) => r.data),
  uploadFileEvidence: (tenantId: string, controlId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post(`/tenants/${tenantId}/assessments/${controlId}/evidence/file`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((r) => r.data);
  },
  downloadEvidence: async (tenantId: string, controlId: string, evidenceId: string, filename: string) => {
    const res = await api.get(
      `/tenants/${tenantId}/assessments/${controlId}/evidence/${evidenceId}/download`,
      { responseType: 'blob' },
    );
    const objectUrl = URL.createObjectURL(res.data as Blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(objectUrl);
  },
  overdueCount: (tenantId: string) =>
    api.get(`/tenants/${tenantId}/assessments/overdue`).then((r) => r.data),
};

// Reports
export const reportApi = {
  get: (tenantId: string, auditId: string) =>
    api.get(`/tenants/${tenantId}/reports/${auditId}`).then((r) => r.data),
  csvUrl: (tenantId: string, auditId: string) =>
    `${BASE_URL}/tenants/${tenantId}/reports/${auditId}/csv`,
  pdfUrl: (tenantId: string, auditId: string) =>
    `${BASE_URL}/tenants/${tenantId}/reports/${auditId}/pdf`,
  downloadCSV: (tenantId: string, auditId: string) => {
    const url = reportApi.csvUrl(tenantId, auditId);
    const link = document.createElement('a');
    link.href = url;
    link.click();
  },
  downloadPDF: (tenantId: string, auditId: string) => {
    const url = reportApi.pdfUrl(tenantId, auditId);
    const link = document.createElement('a');
    link.href = url;
    link.click();
  },
};

// Settings
export const settingsApi = {
  getSsoPublic: () => api.get('/settings/sso/public').then((r) => r.data),
  getSso: () => api.get('/settings/sso').then((r) => r.data),
  updateSso: (data: Record<string, unknown>) =>
    api.put('/settings/sso', data).then((r) => r.data),
};

export default api;
