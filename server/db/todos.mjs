import { randomUUID } from 'node:crypto';

const todoFields = new Set(['title', 'status', 'isImportant', 'isUrgent', 'tags']);
const todoStatuses = new Set(['pending', 'in_progress', 'completed', 'cancelled']);

function requireObject(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError(`${name} must be a JSON object`);
  }
}

function rejectUnknownFields(value, name) {
  for (const field of Object.keys(value)) {
    if (!todoFields.has(field)) throw new TypeError(`unknown ${name} field: ${field}`);
  }
}

function title(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('todo title must be a non-empty string');
  }
  return value.trim();
}

function status(value) {
  if (!todoStatuses.has(value)) throw new TypeError('todo status is invalid');
  return value;
}

function boolean(value, name) {
  if (typeof value !== 'boolean') throw new TypeError(`todo ${name} must be a boolean`);
  return value;
}

function tags(value) {
  if (!Array.isArray(value)) throw new TypeError('todo tags must be an array of strings');
  const normalized = [];
  const seen = new Set();
  for (const item of value) {
    if (typeof item !== 'string') {
      throw new TypeError('todo tags must contain only strings');
    }
    const tag = item.trim();
    if (tag && !seen.has(tag)) {
      seen.add(tag);
      normalized.push(tag);
    }
  }
  return normalized;
}

function timestamp(now) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('todo timestamp must be a valid Date');
  }
  return now.toISOString();
}

function validateCreate(input) {
  requireObject(input, 'todo input');
  rejectUnknownFields(input, 'todo');
  return {
    title: title(input.title),
    status: input.status === undefined ? 'pending' : status(input.status),
    isImportant: input.isImportant === undefined
      ? false
      : boolean(input.isImportant, 'isImportant'),
    isUrgent: input.isUrgent === undefined ? false : boolean(input.isUrgent, 'isUrgent'),
    tags: input.tags === undefined ? [] : tags(input.tags),
  };
}

function validatePatch(patch) {
  requireObject(patch, 'todo patch');
  rejectUnknownFields(patch, 'todo patch');
  if (Object.keys(patch).length === 0) throw new TypeError('todo patch must not be empty');
  return {
    ...(patch.title === undefined ? {} : { title: title(patch.title) }),
    ...(patch.status === undefined ? {} : { status: status(patch.status) }),
    ...(patch.isImportant === undefined
      ? {}
      : { isImportant: boolean(patch.isImportant, 'isImportant') }),
    ...(patch.isUrgent === undefined
      ? {}
      : { isUrgent: boolean(patch.isUrgent, 'isUrgent') }),
    ...(patch.tags === undefined ? {} : { tags: tags(patch.tags) }),
  };
}

function decode(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    isImportant: row.is_important === 1,
    isUrgent: row.is_urgent === 1,
    tags: JSON.parse(row.tags_json),
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function findTodo(db, id) {
  return decode(db.prepare(`
    SELECT id, title, status, is_important, is_urgent, tags_json, created_at, completed_at
    FROM todos
    WHERE id = ?
  `).get(id));
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

export function listTodos(db) {
  return db.prepare(`
    SELECT id, title, status, is_important, is_urgent, tags_json, created_at, completed_at
    FROM todos
    ORDER BY created_at DESC, id
  `).all().map(decode);
}

export function createTodo(db, input, now = new Date()) {
  const todo = validateCreate(input);
  const createdAt = timestamp(now);
  const completedAt = todo.status === 'completed' ? createdAt : null;
  return transact(db, () => {
    const id = randomUUID();
    db.prepare(`
      INSERT INTO todos (
        id, title, status, is_important, is_urgent, tags_json, created_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      todo.title,
      todo.status,
      Number(todo.isImportant),
      Number(todo.isUrgent),
      JSON.stringify(todo.tags),
      createdAt,
      completedAt,
    );
    return findTodo(db, id);
  });
}

export function updateTodo(db, id, patch, now = new Date()) {
  const todoPatch = validatePatch(patch);
  const changedAt = timestamp(now);
  return transact(db, () => {
    const current = findTodo(db, id);
    if (!current) return null;
    const nextStatus = todoPatch.status ?? current.status;
    const completedAt = nextStatus === 'completed'
      ? (current.status === 'completed' ? current.completedAt ?? changedAt : changedAt)
      : null;
    db.prepare(`
      UPDATE todos
      SET title = ?, status = ?, is_important = ?, is_urgent = ?, tags_json = ?, completed_at = ?
      WHERE id = ?
    `).run(
      todoPatch.title ?? current.title,
      nextStatus,
      Number(todoPatch.isImportant ?? current.isImportant),
      Number(todoPatch.isUrgent ?? current.isUrgent),
      JSON.stringify(todoPatch.tags ?? current.tags),
      completedAt,
      id,
    );
    return findTodo(db, id);
  });
}

export function deleteTodo(db, id) {
  return transact(db, () => {
    const current = findTodo(db, id);
    if (!current) return null;
    db.prepare('DELETE FROM todos WHERE id = ?').run(id);
    return current;
  });
}
