import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function applyMigrations(db, migrationsDir) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
  const applied = new Set(
    db.prepare('SELECT name FROM schema_migrations').all().map(({ name }) => name),
  );
  const pending = readdirSync(migrationsDir)
    .filter((name) => /^\d+_.+\.sql$/.test(name) && !applied.has(name))
    .sort();

  for (const name of pending) {
    const sql = readFileSync(join(migrationsDir, name), 'utf8');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(sql);
      db.prepare(
        'INSERT INTO schema_migrations(name, applied_at) VALUES (?, ?)',
      ).run(name, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  return pending;
}
