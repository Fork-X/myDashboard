import { createHash } from 'node:crypto';

const allowedFields = new Set(['title', 'content', 'tags']);

function normalizeRequiredText(value, field) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`thought ${field} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeTags(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new TypeError('thought tags must be an array of strings');
  }

  const tags = [];
  const seen = new Set();
  for (const valueItem of value) {
    if (typeof valueItem !== 'string') {
      throw new TypeError('thought tags must contain only strings');
    }
    const tag = valueItem.trim();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }
  return tags;
}

export function validateThoughtInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new TypeError('thought input must be a JSON object');
  }
  for (const field of Object.keys(input)) {
    if (!allowedFields.has(field)) {
      throw new TypeError(`unknown thought field: ${field}`);
    }
  }
  return {
    title: normalizeRequiredText(input.title, 'title'),
    content: normalizeRequiredText(input.content, 'content'),
    tags: normalizeTags(input.tags),
  };
}

function thoughtId({ title, content }, now) {
  const localDay = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part, index) => index === 0 ? String(part) : String(part).padStart(2, '0'))
    .join('-');
  const digest = createHash('sha256')
    .update(`${title}\0${content}`)
    .digest('hex');
  return `thought:${localDay}:${digest}`;
}

function decode(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: JSON.parse(row.tags_json),
    createdAt: row.created_at,
  };
}

export function listThoughts(db) {
  return db.prepare(`
    SELECT id, title, content, tags_json, created_at
    FROM thoughts
    ORDER BY created_at DESC, id
  `).all().map(decode);
}

export function insertThought(db, input, now = new Date()) {
  const thought = validateThoughtInput(input);
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('thought timestamp must be a valid Date');
  }
  const id = thoughtId(thought, now);
  const result = db.prepare(`
    INSERT INTO thoughts (id, title, content, tags_json, created_at)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(id, thought.title, thought.content, JSON.stringify(thought.tags), now.toISOString());

  return {
    thought: decode(db.prepare(`
      SELECT id, title, content, tags_json, created_at
      FROM thoughts
      WHERE id = ?
    `).get(id)),
    inserted: result.changes === 1,
  };
}
