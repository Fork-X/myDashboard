import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { openDatabase } from './database.mjs';
import {
  convertInboxItem,
  createDirection,
  createEvent,
  createInboxItem,
  createTicker,
  deleteDirection,
  deleteEvent,
  deleteTicker,
  ignoreInboxItem,
  listAllTags,
  listDirections,
  listEvents,
  listInboxItems,
  listTickers,
  updateDirection,
  updateEvent,
  updateInboxItem,
} from './investment.mjs';
import { applyMigrations } from './migrate.mjs';

async function withDatabase(run) {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-investment-'));
  const db = openDatabase(join(root, 'db.sqlite3'));
  try {
    applyMigrations(db, resolve('server/db/migrations'));
    await run(db);
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
}

// ── tickers ─────────────────────────────────────────────────────────────────

test('creates a ticker with required fields', async () => {
  await withDatabase((db) => {
    const now = new Date('2026-08-07T10:00:00.000Z');
    const ticker = createTicker(db, { symbol: '600XXX', name: '航天电子' }, now);

    assert.deepEqual(ticker, {
      id: ticker.id,
      symbol: '600XXX',
      name: '航天电子',
      market: '',
      notes: '',
      createdAt: now.toISOString(),
    });
    assert.deepEqual(listTickers(db), [ticker]);
  });
});

test('deduplicates tickers by symbol', async () => {
  await withDatabase((db) => {
    const first = createTicker(db, { symbol: '600XXX', name: '航天电子' });
    const second = createTicker(db, { symbol: '600XXX', name: '航天电子 v2' });
    assert.equal(second.id, first.id);
    assert.equal(second.name, '航天电子');
    assert.equal(listTickers(db).length, 1);
  });
});

test('deletes a ticker', async () => {
  await withDatabase((db) => {
    const ticker = createTicker(db, { symbol: '000001', name: '平安银行' });
    assert.deepEqual(deleteTicker(db, ticker.id), ticker);
    assert.deepEqual(listTickers(db), []);
    assert.equal(deleteTicker(db, ticker.id), null);
  });
});

// ── events ──────────────────────────────────────────────────────────────────

test('creates an event with all fields', async () => {
  await withDatabase((db) => {
    const now = new Date('2026-08-07T10:00:00.000Z');
    const event = createEvent(db, {
      name: '朱雀三号首飞',
      eventStartDate: '2026-09-15',
      eventEndDate: '2026-09-15',
      dateConfidence: 'fuzzy',
      ambushDays: 60,
      tags: ['航天', '卫星'],
      tickerIds: ['ticker-1'],
      notes: '关注发射进度',
    }, now);

    assert.deepEqual(event, {
      id: event.id,
      name: '朱雀三号首飞',
      eventStartDate: '2026-09-15',
      eventEndDate: '2026-09-15',
      dateConfidence: 'fuzzy',
      ambushDays: 60,
      tags: ['航天', '卫星'],
      tickerIds: ['ticker-1'],
      notes: '关注发射进度',
      status: 'active',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
  });
});

test('creates an event with minimal defaults', async () => {
  await withDatabase((db) => {
    const event = createEvent(db, {
      name: '简单事件',
      eventStartDate: '2026-10-01',
      eventEndDate: '2026-10-03',
    });

    assert.equal(event.name, '简单事件');
    assert.equal(event.dateConfidence, 'exact');
    assert.equal(event.ambushDays, 60);
    assert.deepEqual(event.tags, []);
    assert.deepEqual(event.tickerIds, []);
    assert.equal(event.notes, '');
    assert.equal(event.status, 'active');
  });
});

test('updates and deletes an event', async () => {
  await withDatabase((db) => {
    const event = createEvent(db, {
      name: '可编辑事件',
      eventStartDate: '2026-10-01',
      eventEndDate: '2026-10-01',
    });

    const updated = updateEvent(db, event.id, {
      name: '已编辑事件',
      tags: ['半导体'],
      status: 'archived',
    });
    assert.equal(updated.name, '已编辑事件');
    assert.deepEqual(updated.tags, ['半导体']);
    assert.equal(updated.status, 'archived');

    assert.deepEqual(deleteEvent(db, event.id), updated);
    assert.deepEqual(listEvents(db), []);
    assert.equal(updateEvent(db, event.id, { name: '不存在' }), null);
    assert.equal(deleteEvent(db, event.id), null);
  });
});

test('lists events ordered by start date', async () => {
  await withDatabase((db) => {
    const later = createEvent(db, {
      name: '后发生', eventStartDate: '2026-12-01', eventEndDate: '2026-12-01',
    });
    const earlier = createEvent(db, {
      name: '先发生', eventStartDate: '2026-09-01', eventEndDate: '2026-09-01',
    });
    const events = listEvents(db);
    assert.equal(events[0].id, earlier.id);
    assert.equal(events[1].id, later.id);
  });
});

test('rejects invalid event fields', async () => {
  await withDatabase((db) => {
    assert.throws(() => createEvent(db, {}), /event/i);
    assert.throws(() => createEvent(db, {
      name: 'x', eventStartDate: '2026-01-01', eventEndDate: '2026-01-01', unknown: 1,
    }), /unknown/i);
    assert.throws(() => createEvent(db, {
      name: 'x', eventStartDate: 'not-a-date', eventEndDate: '2026-01-01',
    }), /ISO date/i);
    const event = createEvent(db, {
      name: '原始', eventStartDate: '2026-10-01', eventEndDate: '2026-10-01',
    });
    assert.throws(() => updateEvent(db, event.id, {}), /empty/i);
    assert.throws(() => updateEvent(db, event.id, { unknown: 1 }), /unknown/i);
  });
});

// ── directions ──────────────────────────────────────────────────────────────

test('creates and manages directions', async () => {
  await withDatabase((db) => {
    const now = new Date('2026-08-07T10:00:00.000Z');
    const dir = createDirection(db, {
      name: '商业航天',
      description: '关注中国商业航天发射计划',
      keywords: '火箭,发射,卫星,航天',
      priority: 10,
      scanIntervalHours: 12,
    }, now);

    assert.deepEqual(dir, {
      id: dir.id,
      name: '商业航天',
      description: '关注中国商业航天发射计划',
      keywords: '火箭,发射,卫星,航天',
      domain: 'stock',
      enabled: true,
      priority: 10,
      scanIntervalHours: 12,
      lastScannedAt: null,
      createdAt: now.toISOString(),
    });

    const updated = updateDirection(db, dir.id, { enabled: false, priority: 5 });
    assert.equal(updated.enabled, false);
    assert.equal(updated.priority, 5);

    assert.deepEqual(deleteDirection(db, dir.id), updated);
    assert.deepEqual(listDirections(db), []);
  });
});

test('directions ordered by priority desc', async () => {
  await withDatabase((db) => {
    createDirection(db, { name: '低优', priority: 1 });
    createDirection(db, { name: '高优', priority: 10 });
    createDirection(db, { name: '中优', priority: 5 });
    const dirs = listDirections(db);
    assert.equal(dirs[0].name, '高优');
    assert.equal(dirs[1].name, '中优');
    assert.equal(dirs[2].name, '低优');
  });
});

// ── inbox items ─────────────────────────────────────────────────────────────

test('creates and lists inbox items', async () => {
  await withDatabase((db) => {
    const now = new Date('2026-08-07T10:00:00.000Z');
    const item = createInboxItem(db, {
      sourceSummary: '朱雀三号预计9月中旬首飞',
      sourceUrl: 'https://example.com/news',
      aiEventName: '朱雀三号首飞',
      aiEventStartDate: '2026-09-15',
      aiEventEndDate: '2026-09-20',
      dateConfidence: 'fuzzy',
      aiTags: ['航天', '卫星'],
    }, now);

    assert.deepEqual(item, {
      id: item.id,
      directionId: null,
      domain: null,
      sourceSummary: '朱雀三号预计9月中旬首飞',
      sourceUrl: 'https://example.com/news',
      aiEventName: '朱雀三号首飞',
      aiEventStartDate: '2026-09-15',
      aiEventEndDate: '2026-09-20',
      dateConfidence: 'fuzzy',
      aiTags: ['航天', '卫星'],
      aiTickers: [],
      status: 'pending',
      convertedEventId: null,
      scannedAt: now.toISOString(),
      createdAt: now.toISOString(),
    });
    assert.deepEqual(listInboxItems(db), [item]);
  });
});

test('updates inbox item AI fields', async () => {
  await withDatabase((db) => {
    const item = createInboxItem(db, {
      sourceSummary: '原始摘要',
      aiEventName: '旧名称',
      aiEventStartDate: '2026-09-01',
    });

    const updated = updateInboxItem(db, item.id, {
      aiEventName: '新名称',
      aiEventStartDate: '2026-09-12',
      dateConfidence: 'exact',
      aiTags: ['航天'],
    });
    assert.equal(updated.aiEventName, '新名称');
    assert.equal(updated.aiEventStartDate, '2026-09-12');
    assert.equal(updated.dateConfidence, 'exact');
    assert.deepEqual(updated.aiTags, ['航天']);
  });
});

test('converts inbox item to event', async () => {
  await withDatabase((db) => {
    const item = createInboxItem(db, {
      sourceSummary: '天龙三号10月发射',
      aiEventName: '天龙三号发射',
      aiEventStartDate: '2026-10-15',
      aiEventEndDate: '2026-10-15',
      dateConfidence: 'exact',
      aiTags: ['航天'],
    });

    const result = convertInboxItem(db, item.id);
    assert.equal(result.item.status, 'converted');
    assert.ok(result.item.convertedEventId);
    assert.equal(result.event.name, '天龙三号发射');
    assert.equal(result.event.eventStartDate, '2026-10-15');
    assert.deepEqual(result.event.tags, ['航天']);
    assert.equal(listEvents(db).length, 1);
  });
});

test('ignores inbox item', async () => {
  await withDatabase((db) => {
    const item = createInboxItem(db, { sourceSummary: '无关信息' });
    const ignored = ignoreInboxItem(db, item.id);
    assert.equal(ignored.status, 'ignored');
    assert.throws(() => updateInboxItem(db, item.id, { aiEventName: 'x' }), /只能修改/i);
    assert.throws(() => convertInboxItem(db, item.id), /只能转换/i);
    assert.throws(() => ignoreInboxItem(db, item.id), /只能忽略/i);
  });
});

test('rejects invalid inbox item operations', async () => {
  await withDatabase((db) => {
    assert.throws(() => createInboxItem(db, {}), /source|inbox|object/i);
    assert.throws(() => createInboxItem(db, { sourceSummary: ' ' }), /source|non-empty/i);
    const item = createInboxItem(db, { sourceSummary: '有效摘要' });
    assert.throws(() => updateInboxItem(db, item.id, {}), /empty/i);
    assert.throws(() => updateInboxItem(db, item.id, { unknown: 1 }), /unknown/i);
    assert.equal(updateInboxItem(db, 'missing', { aiEventName: 'x' }), null);
    assert.equal(convertInboxItem(db, 'missing'), null);
    assert.equal(ignoreInboxItem(db, 'missing'), null);
  });
});

// ── tag aggregation ─────────────────────────────────────────────────────────

test('aggregates unique tags from all events', async () => {
  await withDatabase((db) => {
    createEvent(db, {
      name: '事件1', eventStartDate: '2026-10-01', eventEndDate: '2026-10-01',
      tags: ['航天', '卫星'],
    });
    createEvent(db, {
      name: '事件2', eventStartDate: '2026-11-01', eventEndDate: '2026-11-01',
      tags: ['航天', '半导体'],
    });
    assert.deepEqual(listAllTags(db), ['半导体', '卫星', '航天']);
  });
});