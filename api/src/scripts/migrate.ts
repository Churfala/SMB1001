/**
 * Database migration runner.
 * Reads all .sql files from the /migrations directory in alphabetical order
 * and applies any that have not already been run.
 *
 * Usage: node dist/scripts/migrate.js
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function migrate(): Promise<void> {
  const client = await pool.connect();

  try {
    // Create migration tracking table if it doesn't exist
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id       SERIAL PRIMARY KEY,
        name     VARCHAR(255) UNIQUE NOT NULL,
        run_at   TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // In Docker: /app/dist/scripts → resolve to /app/migrations via env or fallback
    const migrationsDir = process.env.MIGRATIONS_DIR
      ? path.resolve(process.env.MIGRATIONS_DIR)
      : path.resolve(__dirname, '../../migrations');

    if (!fs.existsSync(migrationsDir)) {
      console.error(`Migrations directory not found: ${migrationsDir}`);
      process.exit(1);
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found.');
      return;
    }

    for (const file of files) {
      const { rows } = await client.query(
        'SELECT id FROM _migrations WHERE name = $1',
        [file],
      );

      if (rows.length > 0) {
        console.log(`  skip  ${file} (already applied)`);
        continue;
      }

      console.log(`  run   ${file} ...`);
      const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`  ✓     ${file}`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      }
    }

    console.log('\nAll migrations applied successfully.');
  } catch (err) {
    console.error('\nMigration failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
