import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { openDatabase } from '../db/database.mjs';
import { applyMigrations } from '../db/migrate.mjs';
import { upsertRecords } from '../db/records.mjs';
import { upsertTasks } from '../db/tasks.mjs';

export function seedDemo(db, fixturesDir) {
  const records = JSON.parse(readFileSync(join(fixturesDir, 'records.json'), 'utf8'));
  const tasks = JSON.parse(readFileSync(join(fixturesDir, 'tasks.json'), 'utf8'));
  upsertRecords(db, records);
  upsertTasks(db, tasks);
  return { records: records.length, tasks: tasks.length };
}

const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;

if (isMain) {
  const db = openDatabase(resolve(process.env.DATA_DIR ?? 'data', 'dashboard.sqlite3'));
  try {
    applyMigrations(db, resolve('db/migrations'));
    const result = seedDemo(db, resolve('fixtures/demo'));
    console.log(`Seeded demo data: ${result.records} records, ${result.tasks} tasks`);
  } finally {
    db.close();
  }
}
