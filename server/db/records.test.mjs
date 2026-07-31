import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { openDatabase } from './database.mjs';
import { applyMigrations } from './migrate.mjs';
import { getRecord, listRecords, upsertRecords } from './records.mjs';

test('upserts and filters records while decoding JSON fields', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-records-'));
  const db = openDatabase(join(root, 'db.sqlite3'));
  applyMigrations(db, resolve('db/migrations'));
  try {
    upsertRecords(db, [{
      id: 'record-1',
      domain: 'thought',
      type: 'idea',
      title: '示例想法',
      content: '仅用于测试',
      status: 'active',
      occurredAt: '2026-07-30',
      tags: ['示例'],
      payload: { category: '生活' },
      sourceRef: null,
    }]);
    assert.equal(listRecords(db, { domain: 'investment' }).length, 0);
    const row = getRecord(db, 'record-1');
    assert.deepEqual(row.tags, ['示例']);
    assert.deepEqual(row.payload, { category: '生活' });
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
});
