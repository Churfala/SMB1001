import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env';
import { pool } from './config/database';
import { redis } from './config/redis';
import { registerRoutes } from './routes';

async function runMigrations(): Promise<void> {
  const migrationsDir = path.resolve(__dirname, '../migrations');

  if (!fs.existsSync(migrationsDir)) {
    console.warn(`Migrations directory not found at ${migrationsDir}, skipping.`);
    return;
  }

  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id     SERIAL PRIMARY KEY,
        name   VARCHAR(255) UNIQUE NOT NULL,
        run_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
      const { rows } = await client.query('SELECT id FROM _migrations WHERE name = $1', [file]);
      if (rows.length > 0) {
        console.log(`Migration already applied: ${file}`);
        continue;
      }
      console.log(`Running migration: ${file}`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Migration complete: ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }
    console.log('All migrations up to date.');
  } finally {
    client.release();
  }
}

const app = Fastify({
  logger: {
    level: env.LOG_LEVEL,
    transport:
      env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  },
});

// Ensure the upload directory exists on startup
fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

async function main(): Promise<void> {
  // Run database migrations before accepting any requests
  await runMigrations();

  // CORS
  await app.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  });

  // Multipart file uploads
  await app.register(multipart, {
    limits: {
      fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024,
      files: 1,
    },
  });

  // Rate limiting (backed by Redis)
  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
    redis,
    keyGenerator: (request) => {
      return request.user?.sub ?? request.ip;
    },
  });

  // Health check (unauthenticated)
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version ?? '1.0.0',
  }));

  // Register all application routes
  await registerRoutes(app);

  // Global error handler
  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    const statusCode = error.statusCode ?? 500;
    return reply.status(statusCode).send({
      error: error.name || 'Internal Server Error',
      message: error.message || 'An unexpected error occurred',
      ...(env.NODE_ENV === 'development' ? { stack: error.stack } : {}),
    });
  });

  // 404 handler
  app.setNotFoundHandler((_request, reply) => {
    return reply.status(404).send({ error: 'Not Found', message: 'Route not found' });
  });

  // Connect to Redis (lazy-connect mode)
  // Note: @fastify/rate-limit will handle the connection
  // await redis.connect();
  // app.log.info('Redis connected');

  // Start listening
  await app.listen({ port: env.API_PORT, host: env.API_HOST });
  app.log.info(`API server listening on ${env.API_HOST}:${env.API_PORT}`);
}

main().catch((err) => {
  console.error('Failed to start API server:', err);
  process.exit(1);
});

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`Received ${signal}, shutting down gracefully...`);
  await app.close();
  await pool.end();
  await redis.quit();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
