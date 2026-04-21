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
  listUserExclusions: (tenantId: string, userId: string) =>
    api.get(`/tenants/${tenantId}/users/${userId}/exclusions`).then((r) => r.data),
  excludeTenant: (tenantId: string, userId: string, targetTenantId: string) =>
    api.put(`/tenants/${tenantId}/users/${userId}/exclusions/${targetTenantId}`).then((r) => r.data),
  includeTenant: (tenantId: string, userId: string, targetTenantId: string) =>
    api.delete(`/tenants/${tenantId}/users/${userId}/exclusions/${targetTenantId}`),
  delete: (id: string) => api.delete(`/tenants/${id}`),
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
  summary: (tenantId: string) =>
    api.get(`/tenants/${tenantId}/assessments/summary`).then((r) => r.data),
};

// Frameworks
export const frameworkApi = {
  list: () => api.get('/frameworks').then((r) => r.data),
};

// Tasks
export const taskApi = {
  list: (tenantId: string, params?: Record<string, string>) =>
    api.get(`/tenants/${tenantId}/tasks`, { params }).then((r) => r.data),
  summary: (tenantId: string) =>
    api.get(`/tenants/${tenantId}/tasks/summary`).then((r) => r.data),
  create: (tenantId: string, data: Record<string, unknown>) =>
    api.post(`/tenants/${tenantId}/tasks`, data).then((r) => r.data),
  update: (tenantId: string, taskId: string, data: Record<string, unknown>) =>
    api.put(`/tenants/${tenantId}/tasks/${taskId}`, data).then((r) => r.data),
  remove: (tenantId: string, taskId: string) =>
    api.delete(`/tenants/${tenantId}/tasks/${taskId}`),
};

// Audit logs
export const auditLogApi = {
  list: (tenantId: string, params?: Record<string, string | number>) =>
    api.get(`/tenants/${tenantId}/audit-logs`, { params }).then((r) => r.data),
};

// Settings
export const settingsApi = {
  getSsoPublic: () => api.get('/settings/sso/public').then((r) => r.data),
  getSso: () => api.get('/settings/sso').then((r) => r.data),
  updateSso: (data: Record<string, unknown>) =>
    api.put('/settings/sso', data).then((r) => r.data),
};

export default api;
