import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { openDatabase } from './database.mjs';
import { applyMigrations } from './migrate.mjs';
import { insertThought, listThoughts } from './thoughts.mjs';

function localDate(year, month, day, hour = 0, minute = 0) {
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

async function withDatabase(run) {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-thoughts-'));
  const db = openDatabase(join(root, 'db.sqlite3'));
  try {
    applyMigrations(db, resolve('db/migrations'));
    await run(db);
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
}

test('inserts a trimmed thought with normalized explicit tags', async () => {
  await withDatabase((db) => {
    const createdAt = localDate(2026, 8, 4, 2);
    const result = insertThought(db, {
      title: '  标题  ',
      content: '  正文  ',
      tags: [' 明确 ', '明确', '  ', '第二个'],
    }, createdAt);

    assert.equal(result.inserted, true);
    assert.deepEqual(result.thought, {
      id: result.thought.id,
      title: '标题',
      content: '正文',
      tags: ['明确', '第二个'],
      createdAt: createdAt.toISOString(),
    });
    assert.match(result.thought.id, /^thought:2026-08-04:[a-f0-9]{64}$/);
  });
});

test('suppresses the same trimmed title and content on the same local day', async () => {
  await withDatabase((db) => {
    const input = { title: '  标题  ', content: '  正文  ', tags: [' 明确 ', '明确'] };
    const first = insertThought(db, input, localDate(2026, 8, 4, 2));
    const second = insertThought(db, input, localDate(2026, 8, 4, 12));

    assert.equal(first.inserted, true);
    assert.equal(second.inserted, false);
    assert.deepEqual(second.thought, first.thought);
    assert.deepEqual(first.thought.tags, ['明确']);
    assert.equal(listThoughts(db).length, 1);
  });
});

test('uses local calendar boundaries instead of UTC dates or rolling 24-hour windows', async () => {
  await withDatabase((db) => {
    const input = { title: '自然日边界', content: '按运行机器的本地日期去重' };
    const startOfLocalDay = localDate(2026, 8, 4, 0, 5);
    const endOfLocalDay = localDate(2026, 8, 4, 23, 55);
    const nextLocalDay = localDate(2026, 8, 5, 0, 5);

    assert.equal(startOfLocalDay.getDate(), endOfLocalDay.getDate());
    if (startOfLocalDay.getTimezoneOffset() !== 0) {
      assert.notEqual(startOfLocalDay.getUTCDate(), endOfLocalDay.getUTCDate());
    }

    assert.equal(insertThought(db, input, startOfLocalDay).inserted, true);
    assert.equal(insertThought(db, input, endOfLocalDay).inserted, false);
    assert.equal(insertThought(db, input, nextLocalDay).inserted, true);
    assert.equal(nextLocalDay.getTime() - endOfLocalDay.getTime(), 10 * 60 * 1000);
    assert.equal(listThoughts(db).length, 2);
  });
});

test('lists thoughts newest-first', async () => {
  await withDatabase((db) => {
    insertThought(db, { title: '较早', content: '第一条' }, localDate(2026, 8, 3, 2));
    insertThought(db, { title: '较新', content: '第二条', tags: [] }, localDate(2026, 8, 4, 2));

    assert.deepEqual(listThoughts(db).map(({ title }) => title), ['较新', '较早']);
  });
});

test('rejects invalid or expanded thought input without writing', async () => {
  await withDatabase((db) => {
    const invalidInputs = [
      null,
      [],
      { title: ' ', content: '正文' },
      { title: '标题', content: ' ' },
      { title: '标题', content: '正文', tags: ['明确', 1] },
      { title: '标题', content: '正文', source: 'conversation' },
    ];

    for (const input of invalidInputs) {
      assert.throws(() => insertThought(db, input), /thought|title|content|tags|field/i);
    }
    assert.deepEqual(listThoughts(db), []);
  });
});
