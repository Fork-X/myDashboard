import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { openDatabase } from '../db/database.mjs';
import { applyMigrations } from '../db/migrate.mjs';
import { upsertRecords } from '../db/records.mjs';
import { seedDemo } from './seed-demo.mjs';

test('loads clearly synthetic demo data without overwriting local rows', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-demo-'));
  const db = openDatabase(join(root, 'db.sqlite3'));
  applyMigrations(db, resolve('db/migrations'));
  try {
    upsertRecords(db, [{
      id: 'local:thought:keep',
      domain: 'thought',
      type: 'idea',
      title: '本地保留记录',
      content: '不能被演示数据覆盖',
    }]);

    const result = seedDemo(db, resolve('fixtures/demo'));

    assert.ok(result.records > 0);
    assert.ok(result.tasks > 0);
    assert.equal(
      db.prepare("SELECT count(*) AS count FROM records WHERE id LIKE 'demo:%'").get().count,
      result.records,
    );
    assert.equal(
      db.prepare("SELECT count(*) AS count FROM tasks WHERE id LIKE 'demo:%'").get().count,
      result.tasks,
    );
    assert.equal(
      db.prepare("SELECT content FROM records WHERE id = 'local:thought:keep'").get().content,
      '不能被演示数据覆盖',
    );
    assert.equal(
      db.prepare("SELECT count(*) AS count FROM records WHERE id NOT LIKE 'demo:%'").get().count,
      1,
    );
    assert.equal(
      db.prepare(`
        SELECT count(*) AS count FROM (
          SELECT id, title FROM records WHERE id LIKE 'demo:%'
          UNION ALL
          SELECT id, title FROM tasks WHERE id LIKE 'demo:%'
        ) WHERE title NOT LIKE '%示例%' AND title NOT LIKE '%演示%'
      `).get().count,
      0,
    );
    assert.deepEqual(
      db.prepare(`
        SELECT DISTINCT json_extract(payload_json, '$.companyAlias') AS companyAlias
        FROM records WHERE id LIKE 'demo:%' AND domain = 'career'
        ORDER BY companyAlias
      `).all().map(({ companyAlias }) => companyAlias),
      ['A公司', 'H公司', 'Y公司'],
    );
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
});
