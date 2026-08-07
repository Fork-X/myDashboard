import { randomUUID } from 'node:crypto';

const messageRoles = new Set(['user', 'assistant']);
const TITLE_LENGTH = 24;

function timestamp(now) {
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) {
    throw new TypeError('conversation timestamp must be a valid Date');
  }
  return now.toISOString();
}

function requireContent(value) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError('message content must be a non-empty string');
  }
  return value.trim();
}

function requireRole(value) {
  if (!messageRoles.has(value)) throw new TypeError('message role is invalid');
  return value;
}

function normalizeThinking(value) {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new TypeError('message thinking must be a string');
  const trimmed = value.trim();
  return trimmed || null;
}

function decodeConversation(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    messageCount: row.message_count,
  };
}

function decodeMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.role,
    content: row.content,
    thinking: row.thinking,
    createdAt: row.created_at,
  };
}

function findConversation(db, id) {
  return decodeConversation(db.prepare(`
    SELECT c.id, c.title, c.created_at, c.updated_at,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
    FROM conversations c
    WHERE c.id = ?
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

export function createConversation(db, now = new Date()) {
  const createdAt = timestamp(now);
  return transact(db, () => {
    const id = randomUUID();
    db.prepare(`
      INSERT INTO conversations (id, title, created_at, updated_at)
      VALUES (?, '', ?, ?)
    `).run(id, createdAt, createdAt);
    return findConversation(db, id);
  });
}

export function listConversations(db) {
  return db.prepare(`
    SELECT c.id, c.title, c.created_at, c.updated_at,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) AS message_count
    FROM conversations c
    ORDER BY c.updated_at DESC, c.id
  `).all().map(decodeConversation);
}

export function getConversation(db, id) {
  const conversation = findConversation(db, id);
  if (!conversation) return null;
  const messages = db.prepare(`
    SELECT id, conversation_id, role, content, thinking, created_at
    FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at, rowid
  `).all(id).map(decodeMessage);
  return { ...conversation, messages };
}

export function appendMessage(db, conversationId, input, now = new Date()) {
  const message = {
    role: requireRole(input.role),
    content: requireContent(input.content),
    thinking: normalizeThinking(input.thinking),
  };
  const createdAt = timestamp(now);
  return transact(db, () => {
    const conversation = findConversation(db, conversationId);
    if (!conversation) return null;
    const id = randomUUID();
    db.prepare(`
      INSERT INTO messages (id, conversation_id, role, content, thinking, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, conversationId, message.role, message.content, message.thinking, createdAt);
    const title = !conversation.title && message.role === 'user'
      ? message.content.slice(0, TITLE_LENGTH)
      : conversation.title;
    db.prepare(`
      UPDATE conversations SET title = ?, updated_at = ? WHERE id = ?
    `).run(title, createdAt, conversationId);
    return decodeMessage(db.prepare(`
      SELECT id, conversation_id, role, content, thinking, created_at
      FROM messages WHERE id = ?
    `).get(id));
  });
}

export function deleteConversation(db, id) {
  return transact(db, () => {
    const current = findConversation(db, id);
    if (!current) return null;
    db.prepare('DELETE FROM conversations WHERE id = ?').run(id);
    return current;
  });
}
