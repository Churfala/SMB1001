import 'dotenv/config';

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  API_PORT: parseInt(process.env.API_PORT || '3000', 10),
  API_HOST: process.env.API_HOST || '0.0.0.0',

  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_NAME: process.env.DB_NAME || 'smb1001',
  DB_USER: process.env.DB_USER || 'smb1001user',
  DB_PASSWORD: process.env.DB_PASSWORD || '',

  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,

  JWT_SECRET: process.env.JWT_SECRET || 'dev-jwt-secret-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '8h',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // 64-character hex string = 32 bytes for AES-256
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '0'.repeat(64),

  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  MAX_FILE_SIZE_MB: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),

  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  WORKER_CONCURRENCY: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),

  // Entra ID SSO (OIDC)
  ENTRA_TENANT_ID: process.env.ENTRA_TENANT_ID || '',
  ENTRA_CLIENT_ID: process.env.ENTRA_CLIENT_ID || '',
  ENTRA_CLIENT_SECRET: process.env.ENTRA_CLIENT_SECRET || '',
  ENTRA_REDIRECT_URI: process.env.ENTRA_REDIRECT_URI || '',
  ENTRA_SSO_TENANT_SLUG: process.env.ENTRA_SSO_TENANT_SLUG || 'msp-admin',
  ENTRA_AUTO_PROVISION: process.env.ENTRA_AUTO_PROVISION !== 'false',

  // Frontend URL (for SSO redirects)
  FRONTEND_URL: process.env.FRONTEND_URL ||
    (process.env.NODE_ENV === 'production' ? 'https://controlcheck.globaltechnology.nz' : 'http://localhost:5173'),
} as const;
