import { resolve } from 'node:path';
import { openDatabase } from '../db/database.mjs';
import { applyMigrations } from '../db/migrate.mjs';

const db = openDatabase(resolve(process.env.DATA_DIR ?? 'data', 'dashboard.sqlite3'));
try {
  const applied = applyMigrations(db, resolve('server/db/migrations'));
  console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is current');
} finally {
  db.close();
}
