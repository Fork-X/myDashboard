import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { createChatSessionManager } from './session-manager.mjs';
import {
  appendMessage,
  createConversation,
  getConversation,
} from '../db/conversations.mjs';
import { openDatabase } from '../db/database.mjs';
import { applyMigrations } from '../db/migrate.mjs';

function fakeQuery(events, capture) {
  let wake = null;
  return {
    [Symbol.asyncIterator]: async function* iterate() {
      for (const event of events) yield event;
      while (!capture.closed) {
        await new Promise((resolvePromise) => {
          wake = resolvePromise;
        });
      }
    },
    close: async () => {
      capture.closed = true;
      wake?.();
    },
    interrupt: async () => undefined,
  };
}

async function withManager(run, { events = [], maxActive } = {}) {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-chat-'));
  const db = openDatabase(join(root, 'db.sqlite3'));
  const captures = [];
  try {
    applyMigrations(db, resolve('server/db/migrations'));
    const manager = createChatSessionManager({
      db,
      projectRoot: resolve('.'),
      maxActive,
      queryFn: ({ prompt, options }) => {
        const capture = { options, prompt, closed: false };
        captures.push(capture);
        return fakeQuery(events, capture);
      },
    });
    await run({ db, manager, captures });
    await manager.closeAll();
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
}

function collectEvents(manager, conversationId) {
  const events = [];
  manager.subscribe(conversationId, (event) => events.push(event));
  return events;
}

async function waitFor(condition) {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    if (condition()) return;
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
  }
  throw new Error('condition not met in time');
}

test('send persists the user message and starts an SDK session', async () => {
  await withManager(async ({ db, manager, captures }) => {
    const conversation = createConversation(db);
    const events = collectEvents(manager, conversation.id);

    const saved = await manager.send(conversation.id, '  你好  ');
    assert.equal(saved.role, 'user');
    assert.equal(saved.content, '你好');
    assert.equal(manager.isBusy(conversation.id), true);
    assert.equal(manager.activeCount(), 1);

    assert.equal(captures.length, 1);
    assert.equal(captures[0].options.includePartialMessages, true);
    assert.deepEqual(captures[0].options.allowedTools, [
      'WebSearch',
      'WebFetch',
      'Read',
      'Glob',
      'Grep',
      'ImageSearch',
      'Agent',
      'Skill',
      'TodoWrite',
    ]);

    assert.deepEqual(events.map((event) => event.type), ['status', 'message']);
    assert.equal(events[1].message.content, '你好');

    const detail = getConversation(db, conversation.id);
    assert.equal(detail.messages.length, 1);
  });
});

test('streams deltas and persists the assistant message on turn end', async () => {
  const sdkEvents = [
    { type: 'stream_event', event: { delta: { type: 'thinking_delta', thinking: '想一想' } } },
    { type: 'stream_event', event: { delta: { type: 'text_delta', text: '你' } } },
    { type: 'stream_event', event: { delta: { type: 'text_delta', text: '好' } } },
    {
      type: 'assistant',
      message: {
        content: [
          { type: 'thinking', thinking: '想一想' },
          { type: 'text', text: '你好' },
        ],
      },
    },
    { type: 'result', subtype: 'success' },
  ];
  await withManager(async ({ db, manager }) => {
    const conversation = createConversation(db);
    const received = collectEvents(manager, conversation.id);
    await manager.send(conversation.id, 'hi');

    await waitFor(() => received.some((event) => event.type === 'turn_end'));

    assert.deepEqual(
      received.map((event) => event.type),
      ['status', 'message', 'thinking', 'delta', 'delta', 'message', 'turn_end'],
    );
    assert.equal(manager.isBusy(conversation.id), false);

    const detail = getConversation(db, conversation.id);
    assert.equal(detail.messages.length, 2);
    assert.equal(detail.messages[1].role, 'assistant');
    assert.equal(detail.messages[1].content, '你好');
    assert.equal(detail.messages[1].thinking, '想一想');
  }, { events: sdkEvents });
});

test('suppresses the SDK init result that carries no assistant output', async () => {
  const sdkEvents = [
    { type: 'result', subtype: 'success' },
    { type: 'stream_event', event: { delta: { type: 'text_delta', text: '答' } } },
    {
      type: 'assistant',
      message: { content: [{ type: 'text', text: '答' }] },
    },
    { type: 'result', subtype: 'success' },
  ];
  await withManager(async ({ db, manager }) => {
    const conversation = createConversation(db);
    const received = collectEvents(manager, conversation.id);
    await manager.send(conversation.id, 'hi');

    await waitFor(() => received.some((event) => event.type === 'turn_end'));

    assert.deepEqual(
      received.map((event) => event.type),
      ['status', 'message', 'delta', 'message', 'turn_end'],
    );
  }, { events: sdkEvents });
});

test('surfaces a failed result as an error event instead of closing silently', async () => {
  const sdkEvents = [{
    type: 'result',
    subtype: 'error_during_execution',
    is_error: true,
    terminal_reason: 'auth_expired',
    errors: ['Local login has expired. Run "qodercli login" to refresh.'],
  }];
  await withManager(async ({ db, manager }) => {
    const conversation = createConversation(db);
    const received = collectEvents(manager, conversation.id);
    await manager.send(conversation.id, 'hi');

    await waitFor(() => received.some((event) => event.type === 'error'));

    const failure = received.find((event) => event.type === 'error');
    assert.match(failure.message, /qodercli login/);
    assert.equal(received.some((event) => event.type === 'turn_end'), false);
    assert.equal(manager.isBusy(conversation.id), false);
  }, { events: sdkEvents });
});

test('falls back to the reported errors when the failure is not auth related', async () => {
  const sdkEvents = [{
    type: 'result',
    subtype: 'error_during_execution',
    is_error: true,
    errors: ['model quota exhausted'],
  }];
  await withManager(async ({ db, manager }) => {
    const conversation = createConversation(db);
    const received = collectEvents(manager, conversation.id);
    await manager.send(conversation.id, 'hi');

    await waitFor(() => received.some((event) => event.type === 'error'));

    assert.equal(received.find((event) => event.type === 'error').message, 'model quota exhausted');
  }, { events: sdkEvents });
});

test('replays recent history as context when reactivating a conversation', async () => {
  await withManager(async ({ db, manager, captures }) => {
    const conversation = createConversation(db);
    appendMessage(db, conversation.id, { role: 'user', content: '之前的问题' });
    appendMessage(db, conversation.id, { role: 'assistant', content: '之前的回答' });

    await manager.send(conversation.id, '继续');

    const iterator = captures[0].prompt[Symbol.asyncIterator]();
    const first = await iterator.next();
    assert.equal(first.value.shouldQuery, false);
    const text = first.value.message.content[0].text;
    assert.match(text, /历史对话记录/);
    assert.match(text, /用户: 之前的问题/);
    assert.match(text, /AI: 之前的回答/);
  });
});

test('rejects a new session when all active sessions are busy', async () => {
  await withManager(async ({ db, manager }) => {
    const first = createConversation(db);
    const second = createConversation(db);
    const third = createConversation(db);
    const thirdEvents = collectEvents(manager, third.id);

    await manager.send(first.id, 'one');
    await manager.send(second.id, 'two');
    assert.equal(manager.activeCount(), 2);

    const saved = await manager.send(third.id, 'three');
    assert.equal(saved.role, 'user');
    assert.equal(manager.activeCount(), 2);

    await waitFor(() => thirdEvents.some((event) => event.type === 'error'));
    assert.match(thirdEvents.find((event) => event.type === 'error').message, /已达上限/);

    const detail = getConversation(db, third.id);
    assert.equal(detail.messages.length, 1);
    assert.equal(detail.messages[0].content, 'three');
  }, { maxActive: 2 });
});

test('evicts the oldest idle session when capacity is needed', async () => {
  const sdkEvents = [{ type: 'result', subtype: 'success' }];
  await withManager(async ({ db, manager, captures }) => {
    const first = createConversation(db);
    const second = createConversation(db);
    const third = createConversation(db);

    await manager.send(first.id, 'one');
    await manager.send(second.id, 'two');
    await waitFor(() => !manager.isBusy(first.id) && !manager.isBusy(second.id));

    await manager.send(third.id, 'three');
    assert.equal(manager.activeCount(), 2);
    assert.equal(captures.length, 3);
    assert.equal(captures[0].closed, true);
  }, { events: sdkEvents, maxActive: 2 });
});

test('send returns null for a missing conversation', async () => {
  await withManager(async ({ manager }) => {
    assert.equal(await manager.send('missing', 'hi'), null);
    assert.equal(manager.activeCount(), 0);
  });
});
