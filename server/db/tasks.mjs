import { randomUUID } from 'node:crypto';

function decode(row) {
  if (!row) return null;
  return {
    id: row.id,
    kind: row.kind,
    period: row.period,
    title: row.title,
    description: row.description,
    status: row.status,
    targetAt: row.target_at,
    completedAt: row.completed_at,
    sourceRef: row.source_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listTasks(db, { kind } = {}) {
  const rows = kind
    ? db.prepare('SELECT * FROM tasks WHERE kind = ? ORDER BY target_at DESC, created_at DESC').all(kind)
    : db.prepare('SELECT * FROM tasks ORDER BY target_at DESC, created_at DESC').all();
  return rows.map(decode);
}

export function createTask(db, input) {
  const now = new Date().toISOString();
  const id = randomUUID();
  db.prepare(`
    INSERT INTO tasks (
      id, kind, period, title, description, status, target_at,
      completed_at, source_ref, created_at, updated_at
    ) VALUES (?, 'todo', NULL, ?, ?, 'pending', NULL, NULL, NULL, ?, ?)
  `).run(id, input.title.trim(), input.description?.trim() ?? '', now, now);
  return decode(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
}

export function updateTask(db, id, patch) {
  const current = decode(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
  if (!current) return null;
  const status = patch.status ?? current.status;
  const completedAt = status === 'completed'
    ? current.completedAt ?? new Date().toISOString()
    : null;
  db.prepare(`
    UPDATE tasks SET status = ?, completed_at = ?, updated_at = ? WHERE id = ?
  `).run(status, completedAt, new Date().toISOString(), id);
  return decode(db.prepare('SELECT * FROM tasks WHERE id = ?').get(id));
}

export function upsertTasks(db, tasks) {
  const statement = db.prepare(`
    INSERT INTO tasks (
      id, kind, period, title, description, status, target_at,
      completed_at, source_ref, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      kind = excluded.kind,
      period = excluded.period,
      title = excluded.title,
      description = excluded.description,
      status = excluded.status,
      target_at = excluded.target_at,
      completed_at = excluded.completed_at,
      source_ref = excluded.source_ref,
      updated_at = excluded.updated_at
  `);
  const now = new Date().toISOString();
  for (const task of tasks) {
    statement.run(
      task.id, task.kind, task.period ?? null, task.title,
      task.description ?? '', task.status ?? 'pending', task.targetAt ?? null,
      task.completedAt ?? null, task.sourceRef ?? null,
      task.createdAt ?? now, now,
    );
  }
}
