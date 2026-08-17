import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { openDatabase } from './database.mjs';
import { applyMigrations } from './migrate.mjs';

test('applies the independent schema exactly once', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-db-'));
  const db = openDatabase(join(root, 'dashboard.sqlite3'));
  try {
    const migrationsDir = resolve('server/db/migrations');
    assert.deepEqual(
      applyMigrations(db, migrationsDir),
      ['001_initial.sql', '002_conversations.sql', '003_investment.sql', '004_domain.sql'],
    );
    assert.deepEqual(applyMigrations(db, migrationsDir), []);

    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all().map(({ name }) => name);
    assert.deepEqual(tables, [
      'conversations',
      'directions',
      'events',
      'goal_progress',
      'goals',
      'inbox_items',
      'messages',
      'schema_migrations',
      'thoughts',
      'tickers',
      'todos',
    ]);

    const columnsFor = (table) => db.prepare(`PRAGMA table_info(${table})`).all()
      .map(({ name }) => name);
    assert.deepEqual(columnsFor('thoughts'), [
      'id', 'title', 'content', 'tags_json', 'created_at',
    ]);
    assert.deepEqual(columnsFor('goals'), [
      'id', 'title', 'description', 'status', 'created_at', 'updated_at',
    ]);
    assert.deepEqual(columnsFor('goal_progress'), [
      'id', 'goal_id', 'content', 'created_at',
    ]);
    assert.deepEqual(columnsFor('todos'), [
      'id', 'title', 'status', 'is_important', 'is_urgent',
      'tags_json', 'created_at', 'completed_at',
    ]);
    assert.deepEqual(columnsFor('conversations'), [
      'id', 'title', 'created_at', 'updated_at',
    ]);
    assert.deepEqual(columnsFor('messages'), [
      'id', 'conversation_id', 'role', 'content', 'thinking', 'created_at',
    ]);

    assert.throws(() => db.prepare(`
      INSERT INTO todos(id, title, status, is_important, is_urgent, created_at)
      VALUES ('bad-status', 'bad', 'unknown', 0, 0, '2026-08-04T00:00:00.000Z')
    `).run(), /CHECK constraint failed/);
    assert.throws(() => db.prepare(`
      INSERT INTO todos(id, title, status, is_important, is_urgent, created_at)
      VALUES ('bad-important', 'bad', 'pending', 2, 0, '2026-08-04T00:00:00.000Z')
    `).run(), /CHECK constraint failed/);
    assert.throws(() => db.prepare(`
      INSERT INTO goals(id, title, status, created_at, updated_at)
      VALUES ('bad-goal-status', 'bad', 'unknown', '2026-08-04T00:00:00.000Z', '2026-08-04T00:00:00.000Z')
    `).run(), /CHECK constraint failed/);

    db.prepare(`
      INSERT INTO thoughts(id, title, content, created_at)
      VALUES ('thought-1', 'A thought', 'Its content', '2026-08-04T00:00:00.000Z')
    `).run();
    db.prepare(`
      INSERT INTO goals(id, title, created_at, updated_at)
      VALUES ('goal-1', 'A goal', '2026-08-04T00:00:00.000Z', '2026-08-04T00:00:00.000Z')
    `).run();
    db.prepare(`
      INSERT INTO goal_progress(id, goal_id, content, created_at)
      VALUES ('progress-1', 'goal-1', 'Made progress', '2026-08-04T00:00:00.000Z')
    `).run();

    assert.throws(() => db.prepare(`
      UPDATE thoughts SET title = 'Changed' WHERE id = 'thought-1'
    `).run(), /thoughts are immutable/);
    assert.throws(() => db.prepare(`
      DELETE FROM thoughts WHERE id = 'thought-1'
    `).run(), /thoughts are immutable/);
    assert.throws(() => db.prepare(`
      UPDATE goal_progress SET content = 'Changed' WHERE id = 'progress-1'
    `).run(), /goal progress is immutable/);
    assert.throws(() => db.prepare(`
      DELETE FROM goal_progress WHERE id = 'progress-1'
    `).run(), /goal progress is immutable/);
    assert.throws(() => db.prepare(`
      DELETE FROM goals WHERE id = 'goal-1'
    `).run(), /FOREIGN KEY constraint failed/);

    assert.throws(() => db.prepare(`
      INSERT INTO messages(id, conversation_id, role, content, created_at)
      VALUES ('bad-role', 'missing', 'robot', 'hi', '2026-08-04T00:00:00.000Z')
    `).run(), /CHECK constraint failed/);

    db.prepare(`
      INSERT INTO conversations(id, title, created_at, updated_at)
      VALUES ('conv-1', '', '2026-08-04T00:00:00.000Z', '2026-08-04T00:00:00.000Z')
    `).run();
    db.prepare(`
      INSERT INTO messages(id, conversation_id, role, content, created_at)
      VALUES ('msg-1', 'conv-1', 'user', 'hello', '2026-08-04T00:00:00.000Z')
    `).run();
    assert.throws(() => db.prepare(`
      UPDATE messages SET content = 'changed' WHERE id = 'msg-1'
    `).run(), /messages are immutable/);
    db.prepare('DELETE FROM conversations WHERE id = ?').run('conv-1');
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM messages WHERE conversation_id = ?')
        .get('conv-1').count,
      0,
    );
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
});
