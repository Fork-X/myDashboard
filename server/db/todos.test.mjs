import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { openDatabase } from './database.mjs';
import { applyMigrations } from './migrate.mjs';
import {
  createTodo,
  deleteTodo,
  listTodos,
  updateTodo,
} from './todos.mjs';

async function withDatabase(run) {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-todos-'));
  const db = openDatabase(join(root, 'db.sqlite3'));
  try {
    applyMigrations(db, resolve('db/migrations'));
    await run(db);
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
}

test('creates a normalized pending todo with independent quadrant defaults', async () => {
  await withDatabase((db) => {
    const now = new Date('2026-08-04T02:00:00.000Z');
    const todo = createTodo(db, {
      title: '  本地事项  ',
      tags: [' 工作 ', '工作', ' ', '学习'],
    }, now);

    assert.deepEqual(todo, {
      id: todo.id,
      title: '本地事项',
      status: 'pending',
      isImportant: false,
      isUrgent: false,
      tags: ['工作', '学习'],
      createdAt: now.toISOString(),
      completedAt: null,
    });
    assert.match(todo.id, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    assert.deepEqual(listTodos(db), [todo]);
  });
});

test('supports all statuses and both orthogonal quadrant booleans', async () => {
  await withDatabase((db) => {
    const statuses = ['pending', 'in_progress', 'completed', 'cancelled'];
    for (const [index, status] of statuses.entries()) {
      const now = new Date(`2026-08-04T0${index}:00:00.000Z`);
      const todo = createTodo(db, {
        title: `事项 ${status}`,
        status,
        isImportant: index % 2 === 0,
        isUrgent: index >= 2,
      }, now);
      assert.equal(todo.status, status);
      assert.equal(todo.isImportant, index % 2 === 0);
      assert.equal(todo.isUrgent, index >= 2);
      assert.equal(todo.completedAt, status === 'completed' ? now.toISOString() : null);
    }

    const quadrants = listTodos(db).map(({ isImportant, isUrgent }) => (
      `${isImportant}:${isUrgent}`
    ));
    assert.deepEqual(new Set(quadrants), new Set([
      'false:false', 'true:false', 'false:true', 'true:true',
    ]));
  });
});

test('partially edits title, quadrant, tags, and completion lifecycle', async () => {
  await withDatabase((db) => {
    const created = createTodo(db, {
      title: '旧标题',
      isImportant: false,
      isUrgent: true,
      tags: ['旧标签'],
    }, new Date('2026-08-04T02:00:00.000Z'));

    const edited = updateTodo(db, created.id, {
      title: '  新标题  ',
      isImportant: true,
      isUrgent: false,
      tags: [' 新标签 ', '新标签', '', '第二个'],
    }, new Date('2026-08-04T03:00:00.000Z'));
    assert.equal(edited.title, '新标题');
    assert.equal(edited.status, 'pending');
    assert.equal(edited.isImportant, true);
    assert.equal(edited.isUrgent, false);
    assert.deepEqual(edited.tags, ['新标签', '第二个']);
    assert.equal(edited.createdAt, created.createdAt);
    assert.equal(edited.completedAt, null);

    const completedAt = new Date('2026-08-04T04:00:00.000Z');
    const completed = updateTodo(db, created.id, { status: 'completed' }, completedAt);
    assert.equal(completed.completedAt, completedAt.toISOString());

    const retitled = updateTodo(
      db,
      created.id,
      { title: '完成后改标题' },
      new Date('2026-08-04T05:00:00.000Z'),
    );
    assert.equal(retitled.completedAt, completedAt.toISOString());

    const reopened = updateTodo(
      db,
      created.id,
      { status: 'pending' },
      new Date('2026-08-04T06:00:00.000Z'),
    );
    assert.equal(reopened.completedAt, null);

    const completedAgain = updateTodo(
      db,
      created.id,
      { status: 'completed' },
      new Date('2026-08-04T07:00:00.000Z'),
    );
    assert.equal(completedAgain.completedAt, '2026-08-04T07:00:00.000Z');
    const cancelled = updateTodo(
      db,
      created.id,
      { status: 'cancelled' },
      new Date('2026-08-04T08:00:00.000Z'),
    );
    assert.equal(cancelled.completedAt, null);
  });
});

test('strictly rejects malformed, unknown, and non-boolean fields without writing', async () => {
  await withDatabase((db) => {
    const invalidCreates = [
      null,
      [],
      { title: ' ' },
      { title: '事项', status: 'unknown' },
      { title: '事项', isImportant: 1 },
      { title: '事项', isUrgent: 'false' },
      { title: '事项', tags: '工作' },
      { title: '事项', tags: ['工作', 1] },
      { title: '事项', priority: 'high' },
    ];
    for (const input of invalidCreates) {
      assert.throws(() => createTodo(db, input), /todo|title|status|boolean|tags|field/i);
    }
    assert.deepEqual(listTodos(db), []);

    const todo = createTodo(db, { title: '原事项' });
    const invalidPatches = [
      null,
      [],
      {},
      { title: ' ' },
      { status: 'unknown' },
      { isImportant: 0 },
      { isUrgent: null },
      { tags: ['工作', false] },
      { source: 'external' },
    ];
    for (const patch of invalidPatches) {
      assert.throws(() => updateTodo(db, todo.id, patch), /todo|patch|title|status|boolean|tags|field/i);
    }
    assert.deepEqual(listTodos(db), [todo]);
  });
});

test('lists newest-first, deletes exactly one todo, and returns null for missing IDs', async () => {
  await withDatabase((db) => {
    const older = createTodo(
      db,
      { title: '较早' },
      new Date('2026-08-04T02:00:00.000Z'),
    );
    const newer = createTodo(
      db,
      { title: '较新' },
      new Date('2026-08-04T03:00:00.000Z'),
    );

    assert.deepEqual(listTodos(db), [newer, older]);
    assert.deepEqual(deleteTodo(db, older.id), older);
    assert.deepEqual(listTodos(db), [newer]);
    assert.equal(updateTodo(db, 'missing', { status: 'completed' }), null);
    assert.equal(deleteTodo(db, 'missing'), null);
  });
});

test('wraps each successful mutation in its own transaction and rolls back failures', async () => {
  await withDatabase((db) => {
    const boundaries = [];
    const trackedDb = new Proxy(db, {
      get(target, property) {
        if (property === 'exec') {
          return (sql) => {
            if (sql === 'BEGIN IMMEDIATE' || sql === 'COMMIT' || sql === 'ROLLBACK') {
              boundaries.push(sql);
            }
            return target.exec(sql);
          };
        }
        const value = Reflect.get(target, property, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });

    const todo = createTodo(trackedDb, { title: '事务事项' });
    updateTodo(trackedDb, todo.id, { isUrgent: true });
    deleteTodo(trackedDb, todo.id);
    assert.deepEqual(boundaries, [
      'BEGIN IMMEDIATE', 'COMMIT',
      'BEGIN IMMEDIATE', 'COMMIT',
      'BEGIN IMMEDIATE', 'COMMIT',
    ]);

    const rollbackTodo = createTodo(db, { title: '保持原值' });
    db.exec(`
      CREATE TRIGGER reject_blocked_todo_title
      BEFORE UPDATE ON todos
      WHEN NEW.title = '禁止值'
      BEGIN
        SELECT RAISE(ABORT, 'blocked todo title');
      END;
    `);
    assert.throws(
      () => updateTodo(db, rollbackTodo.id, { title: '禁止值', isImportant: true }),
      /blocked todo title/,
    );
    assert.equal(db.isTransaction, false);
    assert.deepEqual(listTodos(db), [rollbackTodo]);
  });
});
