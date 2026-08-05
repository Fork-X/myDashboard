import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { openDatabase } from './database.mjs';
import {
  appendGoalProgress,
  createGoal,
  deleteGoal,
  listGoals,
  updateGoal,
} from './goals.mjs';
import { applyMigrations } from './migrate.mjs';

async function withDatabase(run) {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-goals-'));
  const db = openDatabase(join(root, 'db.sqlite3'));
  try {
    applyMigrations(db, resolve('db/migrations'));
    await run(db);
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
}

test('creates a trimmed active goal with an empty progress timeline by default', async () => {
  await withDatabase((db) => {
    const now = new Date('2026-08-04T02:00:00.000Z');
    const goal = createGoal(db, { title: '  持续目标  ', description: '  说明  ' }, now);

    assert.deepEqual(goal, {
      id: goal.id,
      title: '持续目标',
      description: '说明',
      status: 'active',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      progress: [],
    });
    assert.deepEqual(listGoals(db), [goal]);
  });
});

test('supports all statuses and partial title, description, and status patches', async () => {
  await withDatabase((db) => {
    const statuses = ['active', 'paused', 'completed', 'abandoned'];
    for (const [index, status] of statuses.entries()) {
      const createdAt = new Date(`2026-08-04T0${index}:00:00.000Z`);
      const goal = createGoal(db, { title: `目标 ${status}`, status }, createdAt);
      assert.equal(goal.status, status);
    }

    const original = createGoal(
      db,
      { title: '旧标题', description: '旧说明' },
      new Date('2026-08-04T10:00:00.000Z'),
    );
    const renamed = updateGoal(
      db,
      original.id,
      { title: '  新标题  ' },
      new Date('2026-08-04T11:00:00.000Z'),
    );
    assert.equal(renamed.title, '新标题');
    assert.equal(renamed.description, '旧说明');
    assert.equal(renamed.status, 'active');

    const redescribed = updateGoal(
      db,
      original.id,
      { description: '  新说明  ' },
      new Date('2026-08-04T12:00:00.000Z'),
    );
    assert.equal(redescribed.title, '新标题');
    assert.equal(redescribed.description, '新说明');
    assert.equal(redescribed.status, 'active');

    const paused = updateGoal(
      db,
      original.id,
      { status: 'paused' },
      new Date('2026-08-04T13:00:00.000Z'),
    );
    assert.equal(paused.title, '新标题');
    assert.equal(paused.description, '新说明');
    assert.equal(paused.status, 'paused');
    assert.equal(paused.updatedAt, '2026-08-04T13:00:00.000Z');
  });
});

test('rejects unknown or invalid goal fields without modifying the goal', async () => {
  await withDatabase((db) => {
    const goal = createGoal(db, { title: '原目标' });
    const invalidCreates = [
      null,
      [],
      { title: ' ' },
      { title: '目标', description: 1 },
      { title: '目标', status: 'unknown' },
      { title: '目标', source: 'Self' },
    ];
    for (const input of invalidCreates) {
      assert.throws(() => createGoal(db, input), /goal|title|description|status|field/i);
    }

    const invalidPatches = [
      null,
      [],
      {},
      { title: ' ' },
      { description: 1 },
      { status: 'unknown' },
      { source: 'Self' },
    ];
    for (const patch of invalidPatches) {
      assert.throws(() => updateGoal(db, goal.id, patch), /goal|patch|title|description|status|field/i);
    }
    assert.deepEqual(listGoals(db), [goal]);
  });
});

test('appends trimmed progress newest-first and returns null for missing goals', async () => {
  await withDatabase((db) => {
    const goal = createGoal(db, { title: '持续目标' });
    const firstAt = new Date('2026-08-04T02:00:00.000Z');
    const secondAt = new Date('2026-08-04T03:00:00.000Z');
    const first = appendGoalProgress(db, goal.id, { content: '  第一条进展  ' }, firstAt);
    const second = appendGoalProgress(db, goal.id, { content: '第二条进展' }, secondAt);

    assert.deepEqual(first, {
      id: first.id,
      goalId: goal.id,
      content: '第一条进展',
      createdAt: firstAt.toISOString(),
    });
    assert.deepEqual(second, {
      id: second.id,
      goalId: goal.id,
      content: '第二条进展',
      createdAt: secondAt.toISOString(),
    });
    assert.deepEqual(listGoals(db)[0].progress, [second, first]);
    assert.equal(appendGoalProgress(db, 'missing', { content: '不应写入' }), null);
    assert.throws(() => appendGoalProgress(db, goal.id, { content: ' ' }), /content/i);
  });
});

test('database rejects progress mutation and goals with progress cannot be deleted', async () => {
  await withDatabase((db) => {
    const goal = createGoal(db, { title: '持续目标' });
    const progress = appendGoalProgress(db, goal.id, { content: '第一条进展' });

    assert.throws(
      () => db.prepare('UPDATE goal_progress SET content = ? WHERE id = ?').run('篡改', progress.id),
      /immutable/i,
    );
    assert.throws(
      () => db.prepare('DELETE FROM goal_progress WHERE id = ?').run(progress.id),
      /immutable/i,
    );
    assert.throws(
      () => deleteGoal(db, goal.id),
      (error) => error.status === 409 && error.message === '已有进展的目标不能删除',
    );
    assert.equal(listGoals(db)[0].progress.length, 1);
  });
});

test('deletes a goal without progress and returns null for missing goals', async () => {
  await withDatabase((db) => {
    const goal = createGoal(db, { title: '可删除目标' });

    assert.deepEqual(deleteGoal(db, goal.id), goal);
    assert.deepEqual(listGoals(db), []);
    assert.equal(updateGoal(db, goal.id, { status: 'paused' }), null);
    assert.equal(deleteGoal(db, goal.id), null);
  });
});
