import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { openDatabase } from './database.mjs';
import { applyMigrations } from './migrate.mjs';

test('applies the initial schema exactly once', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-db-'));
  const db = openDatabase(join(root, 'dashboard.sqlite3'));
  try {
    const migrationsDir = resolve('db/migrations');
    assert.deepEqual(applyMigrations(db, migrationsDir), ['001_initial.sql']);
    assert.deepEqual(applyMigrations(db, migrationsDir), []);

    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name IN ('records', 'tasks', 'schema_migrations')
      ORDER BY name
    `).all().map(({ name }) => name);
    assert.deepEqual(tables, ['records', 'schema_migrations', 'tasks']);
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
});
