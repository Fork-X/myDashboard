import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { openDatabase } from './db/database.mjs';
import { applyMigrations } from './db/migrate.mjs';
import { createDirection, listDirections, listInboxItems } from './db/investment.mjs';
import { createScanner } from './scanner.mjs';

async function withDatabase(run) {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-scanner-'));
  const db = openDatabase(join(root, 'db.sqlite3'));
  try {
    applyMigrations(db, resolve('server/db/migrations'));
    await run(db);
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
}

/** queryFn stub: emits one assistant message carrying `text`, optionally held by `gate`. */
function aiReply(text, gate = Promise.resolve()) {
  return () => (async function* generate() {
    await gate;
    yield { type: 'assistant', message: { content: [{ type: 'text', text }] } };
  })();
}

test('rejects a concurrent scan for the same direction', async () => {
  await withDatabase(async (db) => {
    let release;
    const gate = new Promise((resolveGate) => { release = resolveGate; });
    const scanner = createScanner({ db, queryFn: aiReply('[]', gate) });
    const dir = createDirection(db, { name: 'AI' });

    const first = scanner.scanDirection(dir.id);
    await assert.rejects(scanner.scanDirection(dir.id), /正在扫描中/);

    release();
    const result = await first;
    assert.equal(result.count, 0);

    // After the scan finishes, the direction can be scanned again.
    await scanner.scanDirection(dir.id);
  });
});

test('drops malformed items but keeps valid ones and marks the scan done', async () => {
  await withDatabase(async (db) => {
    const payload = JSON.stringify([
      { sourceSummary: '', aiEventName: '缺摘要的坏条目' },
      { sourceSummary: '星舰第七次试飞定于下月', aiEventName: '星舰试飞', aiEventStartDate: '2026-09-01' },
    ]);
    const scanner = createScanner({ db, queryFn: aiReply(payload) });
    const dir = createDirection(db, { name: '商业航天' });

    const result = await scanner.scanDirection(dir.id);
    assert.equal(result.count, 1);

    const inbox = listInboxItems(db);
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0].sourceSummary, '星舰第七次试飞定于下月');

    // Partial failure must not erase the scan record — otherwise the next
    // polling tick would rescan and duplicate the already-saved items.
    const after = listDirections(db).find((d) => d.id === dir.id);
    assert.ok(after.lastScannedAt);
  });
});
