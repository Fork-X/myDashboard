import { randomUUID } from 'node:crypto';

const goalFields = new Set(['title', 'description', 'status']);
const goalStatuses = new Set(['active', 'paused', 'completed', 'abandoned']);

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

function description(value) {
  if (typeof value !== 'string') throw new TypeError('goal description must be a string');
  return value.trim();
}

function status(value) {
  if (!goalStatuses.has(value)) throw new TypeError('goal status is invalid');
  return value;
}

function timestamp(now) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('goal timestamp must be a valid Date');
  }
  return now.toISOString();
}

function validateCreate(input) {
  requireObject(input, 'goal input');
  rejectUnknownFields(input, goalFields, 'goal');
  return {
    title: requiredText(input.title, 'goal title'),
    description: input.description === undefined ? '' : description(input.description),
    status: input.status === undefined ? 'active' : status(input.status),
  };
}

function validatePatch(patch) {
  requireObject(patch, 'goal patch');
  rejectUnknownFields(patch, goalFields, 'goal patch');
  if (Object.keys(patch).length === 0) throw new TypeError('goal patch must not be empty');
  return {
    ...(patch.title === undefined ? {} : { title: requiredText(patch.title, 'goal title') }),
    ...(patch.description === undefined ? {} : { description: description(patch.description) }),
    ...(patch.status === undefined ? {} : { status: status(patch.status) }),
  };
}

function validateProgress(input) {
  requireObject(input, 'goal progress input');
  rejectUnknownFields(input, new Set(['content']), 'goal progress');
  return { content: requiredText(input.content, 'goal progress content') };
}

function decodeProgress(row) {
  if (!row) return null;
  return {
    id: row.id,
    goalId: row.goal_id,
    content: row.content,
    createdAt: row.created_at,
  };
}

function progressForGoal(db, goalId) {
  return db.prepare(`
    SELECT id, goal_id, content, created_at
    FROM goal_progress
    WHERE goal_id = ?
    ORDER BY created_at DESC, id
  `).all(goalId).map(decodeProgress);
}

function decodeGoal(db, row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    progress: progressForGoal(db, row.id),
  };
}

function findGoal(db, id) {
  return decodeGoal(db, db.prepare(`
    SELECT id, title, description, status, created_at, updated_at
    FROM goals
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

export function listGoals(db) {
  return db.prepare(`
    SELECT id, title, description, status, created_at, updated_at
    FROM goals
    ORDER BY updated_at DESC, id
  `).all().map((row) => decodeGoal(db, row));
}

export function createGoal(db, input, now = new Date()) {
  const goal = validateCreate(input);
  const createdAt = timestamp(now);
  return transact(db, () => {
    const id = randomUUID();
    db.prepare(`
      INSERT INTO goals (id, title, description, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, goal.title, goal.description, goal.status, createdAt, createdAt);
    return findGoal(db, id);
  });
}

export function updateGoal(db, id, patch, now = new Date()) {
  const goalPatch = validatePatch(patch);
  const updatedAt = timestamp(now);
  return transact(db, () => {
    const current = findGoal(db, id);
    if (!current) return null;
    db.prepare(`
      UPDATE goals
      SET title = ?, description = ?, status = ?, updated_at = ?
      WHERE id = ?
    `).run(
      goalPatch.title ?? current.title,
      goalPatch.description ?? current.description,
      goalPatch.status ?? current.status,
      updatedAt,
      id,
    );
    return findGoal(db, id);
  });
}

export function deleteGoal(db, id) {
  const current = findGoal(db, id);
  if (!current) return null;
  try {
    return transact(db, () => {
      db.prepare('DELETE FROM goals WHERE id = ?').run(id);
      return current;
    });
  } catch (error) {
    if (/FOREIGN KEY constraint failed/i.test(error.message)) {
      throw Object.assign(new Error('已有进展的目标不能删除'), { status: 409 });
    }
    throw error;
  }
}

export function appendGoalProgress(db, goalId, input, now = new Date()) {
  const progress = validateProgress(input);
  const createdAt = timestamp(now);
  return transact(db, () => {
    if (!findGoal(db, goalId)) return null;
    const id = randomUUID();
    db.prepare(`
      INSERT INTO goal_progress (id, goal_id, content, created_at)
      VALUES (?, ?, ?, ?)
    `).run(id, goalId, progress.content, createdAt);
    return decodeProgress(db.prepare(`
      SELECT id, goal_id, content, created_at
      FROM goal_progress
      WHERE id = ?
    `).get(id));
  });
}
