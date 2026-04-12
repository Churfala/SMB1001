import 'dotenv/config';

export const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: parseInt(process.env.DB_PORT || '5432', 10),
  DB_NAME: process.env.DB_NAME || 'smb1001',
  DB_USER: process.env.DB_USER || 'smb1001user',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: parseInt(process.env.REDIS_PORT || '6379', 10),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || '0'.repeat(64),
  WORKER_CONCURRENCY: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
} as const;
