import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import {
  appendMessage,
  createConversation,
  deleteConversation,
  getConversation,
  listConversations,
} from './conversations.mjs';
import { openDatabase } from './database.mjs';
import { applyMigrations } from './migrate.mjs';

async function withDatabase(run) {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-conversations-'));
  const db = openDatabase(join(root, 'db.sqlite3'));
  try {
    applyMigrations(db, resolve('server/db/migrations'));
    await run(db);
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
}

test('creates an empty conversation and lists it', async () => {
  await withDatabase((db) => {
    const now = new Date('2026-08-06T02:00:00.000Z');
    const conversation = createConversation(db, now);

    assert.deepEqual(conversation, {
      id: conversation.id,
      title: '',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      messageCount: 0,
    });
    assert.deepEqual(listConversations(db), [conversation]);
    assert.deepEqual(getConversation(db, conversation.id), { ...conversation, messages: [] });
  });
});

test('first user message sets the title and bumps updated_at', async () => {
  await withDatabase((db) => {
    const conversation = createConversation(db, new Date('2026-08-06T02:00:00.000Z'));
    const messageTime = new Date('2026-08-06T03:00:00.000Z');
    const message = appendMessage(db, conversation.id, {
      role: 'user',
      content: '  个人看板要不要做标签体系？这个问题值得展开讨论一下  ',
    }, messageTime);

    assert.equal(message.role, 'user');
    assert.equal(message.content, '个人看板要不要做标签体系？这个问题值得展开讨论一下');
    assert.equal(message.thinking, null);

    const updated = getConversation(db, conversation.id);
    assert.equal(updated.title, '个人看板要不要做标签体系？这个问题值得展开讨论一');
    assert.equal(updated.title.length, 24);
    assert.equal(updated.updatedAt, messageTime.toISOString());
    assert.equal(updated.messageCount, 1);
    assert.deepEqual(updated.messages, [message]);
  });
});

test('assistant message with thinking is stored; title is not overwritten', async () => {
  await withDatabase((db) => {
    const conversation = createConversation(db, new Date('2026-08-06T02:00:00.000Z'));
    appendMessage(db, conversation.id, { role: 'user', content: '原标题' });
    appendMessage(db, conversation.id, {
      role: 'assistant',
      content: '回答',
      thinking: '推理过程',
    });

    const updated = getConversation(db, conversation.id);
    assert.equal(updated.title, '原标题');
    assert.equal(updated.messageCount, 2);
    assert.equal(updated.messages[1].thinking, '推理过程');
  });
});

test('appending to a missing conversation returns null', async () => {
  await withDatabase((db) => {
    assert.equal(appendMessage(db, 'missing', { role: 'user', content: 'hi' }), null);
    assert.equal(getConversation(db, 'missing'), null);
    assert.equal(deleteConversation(db, 'missing'), null);
  });
});

test('deleting a conversation cascades its messages', async () => {
  await withDatabase((db) => {
    const conversation = createConversation(db);
    appendMessage(db, conversation.id, { role: 'user', content: 'hi' });
    appendMessage(db, conversation.id, { role: 'assistant', content: 'hello' });

    const removed = deleteConversation(db, conversation.id);
    assert.equal(removed.id, conversation.id);
    assert.equal(getConversation(db, conversation.id), null);
    assert.equal(
      db.prepare('SELECT COUNT(*) AS count FROM messages').get().count,
      0,
    );
  });
});

test('rejects invalid messages', async () => {
  await withDatabase((db) => {
    const conversation = createConversation(db);
    assert.throws(
      () => appendMessage(db, conversation.id, { role: 'robot', content: 'hi' }),
      /message role is invalid/,
    );
    assert.throws(
      () => appendMessage(db, conversation.id, { role: 'user', content: '   ' }),
      /message content must be a non-empty string/,
    );
    assert.throws(
      () => appendMessage(db, conversation.id, { role: 'user', content: 'hi', thinking: 42 }),
      /message thinking must be a string/,
    );
  });
});

test('lists conversations ordered by most recent activity', async () => {
  await withDatabase((db) => {
    const older = createConversation(db, new Date('2026-08-06T02:00:00.000Z'));
    const newer = createConversation(db, new Date('2026-08-06T04:00:00.000Z'));
    appendMessage(db, older.id, { role: 'user', content: '活跃起来' },
      new Date('2026-08-06T05:00:00.000Z'));

    assert.deepEqual(
      listConversations(db).map((conversation) => conversation.id),
      [older.id, newer.id],
    );
  });
});
