function decode(row) {
  if (!row) return null;
  return {
    id: row.id,
    domain: row.domain,
    type: row.type,
    title: row.title,
    content: row.content,
    status: row.status,
    occurredAt: row.occurred_at,
    tags: JSON.parse(row.tags_json),
    payload: JSON.parse(row.payload_json),
    sourceRef: row.source_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listRecords(db, { domain, type } = {}) {
  const conditions = [];
  const values = [];
  if (domain) { conditions.push('domain = ?'); values.push(domain); }
  if (type) { conditions.push('type = ?'); values.push(type); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.prepare(`
    SELECT * FROM records ${where}
    ORDER BY COALESCE(occurred_at, updated_at) DESC, id
  `).all(...values).map(decode);
}

export function getRecord(db, id) {
  return decode(db.prepare('SELECT * FROM records WHERE id = ?').get(id));
}

export function upsertRecords(db, records) {
  const statement = db.prepare(`
    INSERT INTO records (
      id, domain, type, title, content, status, occurred_at,
      tags_json, payload_json, source_ref, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      domain = excluded.domain,
      type = excluded.type,
      title = excluded.title,
      content = excluded.content,
      status = excluded.status,
      occurred_at = excluded.occurred_at,
      tags_json = excluded.tags_json,
      payload_json = excluded.payload_json,
      source_ref = excluded.source_ref,
      updated_at = excluded.updated_at
  `);
  const now = new Date().toISOString();
  for (const record of records) {
    statement.run(
      record.id, record.domain, record.type, record.title, record.content ?? '',
      record.status ?? 'active', record.occurredAt ?? null,
      JSON.stringify(record.tags ?? []), JSON.stringify(record.payload ?? {}),
      record.sourceRef ?? null, record.createdAt ?? now, now,
    );
  }
}
