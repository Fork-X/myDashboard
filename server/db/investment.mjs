import { randomUUID } from 'node:crypto';

// ── helpers ────────────────────────────────────────────────────────────────

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be a JSON object`);
  }
}

function rejectUnknownFields(value, allowed, name) {
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) throw new TypeError(`unknown ${name} field: ${field}`);
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`${name} must be a non-empty string`);
  }
  return value.trim();
}

function optionalText(value, name) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') throw new TypeError(`${name} must be a string`);
  return value.trim();
}

function isoDate(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError(`${name} must be an ISO date (YYYY-MM-DD)`);
  }
  return value;
}

function integer(value, name, min = 0) {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min) {
    throw new TypeError(`${name} must be an integer >= ${min}`);
  }
  return value;
}

function boolean(value, name) {
  if (typeof value !== 'boolean') throw new TypeError(`${name} must be a boolean`);
  return value;
}

function tagsArray(value) {
  if (!Array.isArray(value)) throw new TypeError('tags must be an array of strings');
  const normalized = [];
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== 'string') throw new TypeError('tags must contain only strings');
    const tag = item.trim();
    if (tag && !seen.has(tag)) { seen.add(tag); normalized.push(tag); }
  }
  return normalized;
}

function idArray(value) {
  if (!Array.isArray(value)) throw new TypeError('ticker ids must be an array');
  for (const item of value) {
    if (typeof item !== 'string' || !item.trim()) {
      throw new TypeError('ticker ids must be non-empty strings');
    }
  }
  return value;
}

function timestamp(now) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('timestamp must be a valid Date');
  }
  return now.toISOString();
}

function transact(db, operation) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    if (db.isTransaction) db.exec('ROLLBACK');
    throw error;
  }
}

// ── tickers ─────────────────────────────────────────────────────────────────

const TICKER_FIELDS = new Set(['symbol', 'name', 'market', 'notes']);

function validateTicker(input) {
  requireObject(input, 'ticker input');
  rejectUnknownFields(input, TICKER_FIELDS, 'ticker');
  return {
    symbol: requiredText(input.symbol, 'ticker symbol'),
    name: requiredText(input.name, 'ticker name'),
    market: optionalText(input.market, 'ticker market'),
    notes: optionalText(input.notes, 'ticker notes'),
  };
}

function decodeTicker(row) {
  if (!row) return null;
  return {
    id: row.id,
    symbol: row.symbol,
    name: row.name,
    market: row.market,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

function findTicker(db, id) {
  return decodeTicker(db.prepare(`
    SELECT id, symbol, name, market, notes, created_at
    FROM tickers WHERE id = ?
  `).get(id));
}

export function listTickers(db) {
  return db.prepare(`
    SELECT id, symbol, name, market, notes, created_at
    FROM tickers ORDER BY symbol, id
  `).all().map(decodeTicker);
}

export function createTicker(db, input, now = new Date()) {
  const ticker = validateTicker(input);
  const createdAt = timestamp(now);
  return transact(db, () => {
    const existing = db.prepare(
      'SELECT id FROM tickers WHERE symbol = ?',
    ).get(ticker.symbol);
    if (existing) return findTicker(db, existing.id);
    const id = randomUUID();
    db.prepare(`
      INSERT INTO tickers (id, symbol, name, market, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, ticker.symbol, ticker.name, ticker.market, ticker.notes, createdAt);
    return findTicker(db, id);
  });
}

export function deleteTicker(db, id) {
  return transact(db, () => {
    const current = findTicker(db, id);
    if (!current) return null;
    db.prepare('DELETE FROM tickers WHERE id = ?').run(id);
    return current;
  });
}

// ── events ──────────────────────────────────────────────────────────────────

const EVENT_CREATE_FIELDS = new Set([
  'name', 'eventStartDate', 'eventEndDate', 'dateConfidence',
  'ambushDays', 'tags', 'tickerIds', 'notes',
]);
const EVENT_PATCH_FIELDS = new Set([
  'name', 'eventStartDate', 'eventEndDate', 'dateConfidence',
  'ambushDays', 'tags', 'tickerIds', 'notes', 'status',
]);

function validateEvent(input) {
  requireObject(input, 'event input');
  rejectUnknownFields(input, EVENT_CREATE_FIELDS, 'event');
  return {
    name: requiredText(input.name, 'event name'),
    eventStartDate: isoDate(input.eventStartDate, 'event start date'),
    eventEndDate: isoDate(input.eventEndDate, 'event end date'),
    dateConfidence: input.dateConfidence === 'fuzzy' ? 'fuzzy' : 'exact',
    ambushDays: input.ambushDays === undefined ? 60 : integer(input.ambushDays, 'ambush days', 1),
    tags: input.tags === undefined ? [] : tagsArray(input.tags),
    tickerIds: input.tickerIds === undefined ? [] : idArray(input.tickerIds),
    notes: optionalText(input.notes, 'event notes'),
  };
}

function validateEventPatch(patch) {
  requireObject(patch, 'event patch');
  rejectUnknownFields(patch, EVENT_PATCH_FIELDS, 'event patch');
  if (Object.keys(patch).length === 0) throw new TypeError('event patch must not be empty');
  const result = {};
  if (patch.name !== undefined) result.name = requiredText(patch.name, 'event name');
  if (patch.eventStartDate !== undefined) result.eventStartDate = isoDate(patch.eventStartDate, 'event start date');
  if (patch.eventEndDate !== undefined) result.eventEndDate = isoDate(patch.eventEndDate, 'event end date');
  if (patch.dateConfidence !== undefined) {
    result.dateConfidence = patch.dateConfidence === 'fuzzy' ? 'fuzzy' : 'exact';
  }
  if (patch.ambushDays !== undefined) result.ambushDays = integer(patch.ambushDays, 'ambush days', 1);
  if (patch.tags !== undefined) result.tags = tagsArray(patch.tags);
  if (patch.tickerIds !== undefined) result.tickerIds = idArray(patch.tickerIds);
  if (patch.notes !== undefined) result.notes = optionalText(patch.notes, 'event notes');
  if (patch.status !== undefined) {
    if (!['active', 'archived'].includes(patch.status)) {
      throw new TypeError('event status must be active or archived');
    }
    result.status = patch.status;
  }
  return result;
}

function decodeEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    eventStartDate: row.event_start_date,
    eventEndDate: row.event_end_date,
    dateConfidence: row.date_confidence,
    ambushDays: row.ambush_days,
    tags: JSON.parse(row.tags_json),
    tickerIds: JSON.parse(row.ticker_ids),
    notes: row.notes,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function findEvent(db, id) {
  return decodeEvent(db.prepare(`
    SELECT id, name, event_start_date, event_end_date, date_confidence,
           ambush_days, tags_json, ticker_ids, notes, status, created_at, updated_at
    FROM events WHERE id = ?
  `).get(id));
}

export function listEvents(db) {
  return db.prepare(`
    SELECT id, name, event_start_date, event_end_date, date_confidence,
           ambush_days, tags_json, ticker_ids, notes, status, created_at, updated_at
    FROM events
    ORDER BY event_start_date, id
  `).all().map(decodeEvent);
}

export function createEvent(db, input, now = new Date()) {
  const event = validateEvent(input);
  const createdAt = timestamp(now);
  return transact(db, () => {
    const id = randomUUID();
    db.prepare(`
      INSERT INTO events (
        id, name, event_start_date, event_end_date, date_confidence,
        ambush_days, tags_json, ticker_ids, notes, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?)
    `).run(
      id, event.name, event.eventStartDate, event.eventEndDate, event.dateConfidence,
      event.ambushDays, JSON.stringify(event.tags), JSON.stringify(event.tickerIds),
      event.notes, createdAt, createdAt,
    );
    return findEvent(db, id);
  });
}

export function updateEvent(db, id, patch, now = new Date()) {
  const eventPatch = validateEventPatch(patch);
  const updatedAt = timestamp(now);
  return transact(db, () => {
    const current = findEvent(db, id);
    if (!current) return null;
    db.prepare(`
      UPDATE events
      SET name = ?, event_start_date = ?, event_end_date = ?, date_confidence = ?,
          ambush_days = ?, tags_json = ?, ticker_ids = ?, notes = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(
      eventPatch.name ?? current.name,
      eventPatch.eventStartDate ?? current.eventStartDate,
      eventPatch.eventEndDate ?? current.eventEndDate,
      eventPatch.dateConfidence ?? current.dateConfidence,
      eventPatch.ambushDays ?? current.ambushDays,
      eventPatch.tags !== undefined ? JSON.stringify(eventPatch.tags) : JSON.stringify(current.tags),
      eventPatch.tickerIds !== undefined ? JSON.stringify(eventPatch.tickerIds) : JSON.stringify(current.tickerIds),
      eventPatch.notes ?? current.notes,
      eventPatch.status ?? current.status,
      updatedAt,
      id,
    );
    return findEvent(db, id);
  });
}

export function deleteEvent(db, id) {
  return transact(db, () => {
    const current = findEvent(db, id);
    if (!current) return null;
    db.prepare('DELETE FROM events WHERE id = ?').run(id);
    return current;
  });
}

// ── directions ──────────────────────────────────────────────────────────────

const DIRECTION_CREATE_FIELDS = new Set([
  'name', 'description', 'keywords', 'enabled', 'priority', 'scanIntervalHours',
  'domain',
]);
const DIRECTION_PATCH_FIELDS = new Set([
  'name', 'description', 'keywords', 'enabled', 'priority', 'scanIntervalHours',
  'domain',
]);

function validateDomain(value) {
  if (value === undefined || value === null) return 'stock';
  if (typeof value !== 'string' || !value.trim()) throw new TypeError('domain must be a non-empty string');
  return value.trim();
}

function validateDirection(input) {
  requireObject(input, 'direction input');
  rejectUnknownFields(input, DIRECTION_CREATE_FIELDS, 'direction');
  return {
    name: requiredText(input.name, 'direction name'),
    description: optionalText(input.description, 'direction description'),
    keywords: optionalText(input.keywords, 'direction keywords'),
    domain: validateDomain(input.domain),
    enabled: input.enabled === undefined ? true : boolean(input.enabled, 'enabled'),
    priority: input.priority === undefined ? 0 : integer(input.priority, 'priority'),
    scanIntervalHours: input.scanIntervalHours === undefined
      ? 6 : integer(input.scanIntervalHours, 'scan interval', 1),
  };
}

function validateDirectionPatch(patch) {
  requireObject(patch, 'direction patch');
  rejectUnknownFields(patch, DIRECTION_PATCH_FIELDS, 'direction patch');
  if (Object.keys(patch).length === 0) throw new TypeError('direction patch must not be empty');
  const result = {};
  if (patch.name !== undefined) result.name = requiredText(patch.name, 'direction name');
  if (patch.description !== undefined) result.description = optionalText(patch.description, 'direction description');
  if (patch.keywords !== undefined) result.keywords = optionalText(patch.keywords, 'direction keywords');
  if (patch.domain !== undefined) result.domain = validateDomain(patch.domain);
  if (patch.enabled !== undefined) result.enabled = boolean(patch.enabled, 'enabled');
  if (patch.priority !== undefined) result.priority = integer(patch.priority, 'priority');
  if (patch.scanIntervalHours !== undefined) {
    result.scanIntervalHours = integer(patch.scanIntervalHours, 'scan interval', 1);
  }
  return result;
}

function decodeDirection(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    keywords: row.keywords,
    domain: row.domain,
    enabled: row.enabled === 1,
    priority: row.priority,
    scanIntervalHours: row.scan_interval_hours,
    lastScannedAt: row.last_scanned_at,
    createdAt: row.created_at,
  };
}

function findDirection(db, id) {
  return decodeDirection(db.prepare(`
    SELECT id, name, description, keywords, domain,
           enabled, priority, scan_interval_hours, last_scanned_at, created_at
    FROM directions WHERE id = ?
  `).get(id));
}

export function listDirections(db) {
  return db.prepare(`
    SELECT id, name, description, keywords, domain,
           enabled, priority, scan_interval_hours, last_scanned_at, created_at
    FROM directions ORDER BY priority DESC, name, id
  `).all().map(decodeDirection);
}

export function createDirection(db, input, now = new Date()) {
  const direction = validateDirection(input);
  const createdAt = timestamp(now);
  return transact(db, () => {
    const id = randomUUID();
    db.prepare(`
      INSERT INTO directions (
        id, name, description, keywords, domain,
        enabled, priority, scan_interval_hours, last_scanned_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?)
    `).run(
      id, direction.name, direction.description, direction.keywords,
      direction.domain,
      Number(direction.enabled), direction.priority,
      direction.scanIntervalHours, createdAt,
    );
    return findDirection(db, id);
  });
}

export function updateDirection(db, id, patch, now = new Date()) {
  const dirPatch = validateDirectionPatch(patch);
  return transact(db, () => {
    const current = findDirection(db, id);
    if (!current) return null;
    db.prepare(`
      UPDATE directions
      SET name = ?, description = ?, keywords = ?, domain = ?,
          enabled = ?, priority = ?, scan_interval_hours = ?
      WHERE id = ?
    `).run(
      dirPatch.name ?? current.name,
      dirPatch.description ?? current.description,
      dirPatch.keywords ?? current.keywords,
      dirPatch.domain ?? current.domain,
      Number(dirPatch.enabled ?? current.enabled),
      dirPatch.priority ?? current.priority,
      dirPatch.scanIntervalHours ?? current.scanIntervalHours,
      id,
    );
    return findDirection(db, id);
  });
}

export function deleteDirection(db, id) {
  return transact(db, () => {
    const current = findDirection(db, id);
    if (!current) return null;
    db.prepare('DELETE FROM directions WHERE id = ?').run(id);
    return current;
  });
}

export function markDirectionScanned(db, id, now = new Date()) {
  db.prepare('UPDATE directions SET last_scanned_at = ? WHERE id = ?')
    .run(timestamp(now), id);
}

// ── inbox items ─────────────────────────────────────────────────────────────

const INBOX_PATCH_FIELDS = new Set([
  'aiEventName', 'aiEventStartDate', 'aiEventEndDate', 'dateConfidence',
  'aiTags', 'aiTickers',
]);

function validateInboxPatch(patch) {
  requireObject(patch, 'inbox patch');
  rejectUnknownFields(patch, INBOX_PATCH_FIELDS, 'inbox patch');
  if (Object.keys(patch).length === 0) throw new TypeError('inbox patch must not be empty');
  const result = {};
  if (patch.aiEventName !== undefined) result.aiEventName = requiredText(patch.aiEventName, 'AI event name');
  if (patch.aiEventStartDate !== undefined) result.aiEventStartDate = optionalText(patch.aiEventStartDate, 'AI event start date');
  if (patch.aiEventEndDate !== undefined) result.aiEventEndDate = optionalText(patch.aiEventEndDate, 'AI event end date');
  if (patch.dateConfidence !== undefined) {
    if (!['exact', 'fuzzy'].includes(patch.dateConfidence)) {
      throw new TypeError('date confidence must be exact or fuzzy');
    }
    result.dateConfidence = patch.dateConfidence;
  }
  if (patch.aiTags !== undefined) result.aiTags = tagsArray(patch.aiTags);
  if (patch.aiTickers !== undefined) {
    if (!Array.isArray(patch.aiTickers)) throw new TypeError('aiTickers must be an array');
    result.aiTickers = patch.aiTickers;
  }
  return result;
}

function decodeInboxItem(row) {
  if (!row) return null;
  return {
    id: row.id,
    directionId: row.direction_id,
    domain: row.domain,
    sourceSummary: row.source_summary,
    sourceUrl: row.source_url,
    aiEventName: row.ai_event_name,
    aiEventStartDate: row.ai_event_start_date,
    aiEventEndDate: row.ai_event_end_date,
    dateConfidence: row.date_confidence,
    aiTags: JSON.parse(row.ai_tags_json),
    aiTickers: JSON.parse(row.ai_tickers_json),
    status: row.status,
    convertedEventId: row.converted_event_id,
    scannedAt: row.scanned_at,
    createdAt: row.created_at,
  };
}

function findInboxItem(db, id) {
  return decodeInboxItem(db.prepare(`
    SELECT id, direction_id, domain, source_summary, source_url, ai_event_name,
           ai_event_start_date, ai_event_end_date, date_confidence,
           ai_tags_json, ai_tickers_json, status, converted_event_id,
           scanned_at, created_at
    FROM inbox_items WHERE id = ?
  `).get(id));
}

export function listInboxItems(db) {
  return db.prepare(`
    SELECT id, direction_id, domain, source_summary, source_url, ai_event_name,
           ai_event_start_date, ai_event_end_date, date_confidence,
           ai_tags_json, ai_tickers_json, status, converted_event_id,
           scanned_at, created_at
    FROM inbox_items
    ORDER BY scanned_at DESC, id
  `).all().map(decodeInboxItem);
}

export function createInboxItem(db, input, now = new Date()) {
  requireObject(input, 'inbox item input');
  const scannedAt = timestamp(now);
  return transact(db, () => {
    const id = randomUUID();
    db.prepare(`
      INSERT INTO inbox_items (
        id, direction_id, domain, source_summary, source_url, ai_event_name,
        ai_event_start_date, ai_event_end_date, date_confidence,
        ai_tags_json, ai_tickers_json, status, scanned_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)
    `).run(
      id,
      input.directionId ?? null,
      input.domain ?? null,
      requiredText(input.sourceSummary, 'source summary'),
      optionalText(input.sourceUrl, 'source URL'),
      optionalText(input.aiEventName, 'AI event name'),
      optionalText(input.aiEventStartDate, 'AI event start date'),
      optionalText(input.aiEventEndDate, 'AI event end date'),
      input.dateConfidence === 'exact' ? 'exact' : 'fuzzy',
      JSON.stringify(input.aiTags ?? []),
      JSON.stringify(input.aiTickers ?? []),
      scannedAt,
      scannedAt,
    );
    return findInboxItem(db, id);
  });
}

export function updateInboxItem(db, id, patch) {
  const inboxPatch = validateInboxPatch(patch);
  return transact(db, () => {
    const current = findInboxItem(db, id);
    if (!current) return null;
    if (current.status !== 'pending') {
      throw Object.assign(new Error('只能修改待确认的收件箱条目'), { status: 409 });
    }
    db.prepare(`
      UPDATE inbox_items
      SET ai_event_name = ?, ai_event_start_date = ?, ai_event_end_date = ?,
          date_confidence = ?, ai_tags_json = ?, ai_tickers_json = ?
      WHERE id = ?
    `).run(
      inboxPatch.aiEventName ?? current.aiEventName,
      inboxPatch.aiEventStartDate ?? current.aiEventStartDate,
      inboxPatch.aiEventEndDate ?? current.aiEventEndDate,
      inboxPatch.dateConfidence ?? current.dateConfidence,
      inboxPatch.aiTags !== undefined
        ? JSON.stringify(inboxPatch.aiTags) : JSON.stringify(current.aiTags),
      inboxPatch.aiTickers !== undefined
        ? JSON.stringify(inboxPatch.aiTickers) : JSON.stringify(current.aiTickers),
      id,
    );
    return findInboxItem(db, id);
  });
}

export function convertInboxItem(db, id, now = new Date()) {
  return transact(db, () => {
    const item = findInboxItem(db, id);
    if (!item) return null;
    if (item.status !== 'pending') {
      throw Object.assign(new Error('只能转换待确认的收件箱条目'), { status: 409 });
    }
    const createdAt = timestamp(now);
    const eventId = randomUUID();
    const eventName = item.aiEventName || item.sourceSummary.slice(0, 100);
    const startDate = item.aiEventStartDate || now.toISOString().slice(0, 10);
    const endDate = item.aiEventEndDate || item.aiEventStartDate || now.toISOString().slice(0, 10);
    db.prepare(`
      INSERT INTO events (
        id, name, event_start_date, event_end_date, date_confidence,
        ambush_days, tags_json, ticker_ids, notes, status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, 60, ?, '[]', '', 'active', ?, ?)
    `).run(
      eventId, eventName, startDate, endDate,
      item.dateConfidence,
      JSON.stringify(item.aiTags),
      createdAt, createdAt,
    );
    db.prepare(`
      UPDATE inbox_items SET status = 'converted', converted_event_id = ? WHERE id = ?
    `).run(eventId, id);
    return { item: findInboxItem(db, id), event: findEvent(db, eventId) };
  });
}

export function ignoreInboxItem(db, id) {
  return transact(db, () => {
    const current = findInboxItem(db, id);
    if (!current) return null;
    if (current.status !== 'pending') {
      throw Object.assign(new Error('只能忽略待确认的收件箱条目'), { status: 409 });
    }
    db.prepare("UPDATE inbox_items SET status = 'ignored' WHERE id = ?").run(id);
    return findInboxItem(db, id);
  });
}

// ── tag aggregation ─────────────────────────────────────────────────────────

export function listAllTags(db) {
  const tags = new Set();
  for (const row of db.prepare('SELECT tags_json FROM events').all()) {
    for (const tag of JSON.parse(row.tags_json)) tags.add(tag);
  }
  return [...tags].sort();
}