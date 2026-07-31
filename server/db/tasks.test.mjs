import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { openDatabase } from './database.mjs';
import { applyMigrations } from './migrate.mjs';
import { createTask, listTasks, updateTask } from './tasks.mjs';

test('creates a local todo and completes it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-tasks-'));
  const db = openDatabase(join(root, 'db.sqlite3'));
  applyMigrations(db, resolve('db/migrations'));
  try {
    const created = createTask(db, {
      title: '验证本地持久化',
      description: '',
    });
    assert.equal(created.kind, 'todo');
    const completed = updateTask(db, created.id, { status: 'completed' });
    assert.equal(completed.status, 'completed');
    assert.ok(completed.completedAt);
    assert.equal(listTasks(db, { kind: 'todo' }).length, 1);
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
});
