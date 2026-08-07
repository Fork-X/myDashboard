import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { createDistiller } from './distiller.mjs';
import { appendMessage, createConversation } from '../db/conversations.mjs';
import { openDatabase } from '../db/database.mjs';
import { applyMigrations } from '../db/migrate.mjs';

function assistantText(text) {
  return {
    type: 'assistant',
    message: { content: [{ type: 'text', text }] },
  };
}

async function withDistiller(events, run) {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-distill-'));
  const db = openDatabase(join(root, 'db.sqlite3'));
  const captures = [];
  try {
    applyMigrations(db, resolve('server/db/migrations'));
    const distiller = createDistiller({
      db,
      projectRoot: resolve('.'),
      queryFn: ({ prompt, options }) => {
        captures.push({ prompt, options });
        return (async function* generate() {
          for (const event of events) yield event;
        }());
      },
    });
    await run({ db, distiller, captures });
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
}

test('returns null for a missing conversation and shouldSave=false for an empty one', async () => {
  await withDistiller([], async ({ db, distiller, captures }) => {
    assert.equal(await distiller.distill('missing'), null);

    const conversation = createConversation(db);
    assert.deepEqual(await distiller.distill(conversation.id), {
      shouldSave: false,
      reason: '对话还没有消息，先聊几句再沉淀',
    });
    assert.equal(captures.length, 0);
  });
});

test('parses a savable draft from the skill JSON output', async () => {
  const draft = {
    shouldSave: true,
    title: '  暂缓标签体系  ',
    content: '  先用全文搜索。  ',
    tags: [' 决策 ', '决策', '看板'],
  };
  await withDistiller([assistantText(`好的。\n${JSON.stringify(draft)}\n`)], async ({
    db, distiller, captures,
  }) => {
    const conversation = createConversation(db);
    appendMessage(db, conversation.id, { role: 'user', content: '要不要做标签体系？' });
    appendMessage(db, conversation.id, { role: 'assistant', content: '可以先观察主题分布。' });

    const result = await distiller.distill(conversation.id, ' 工具决策 ');
    assert.equal(result.shouldSave, true);
    assert.equal(result.title, '暂缓标签体系');
    assert.equal(result.content, '先用全文搜索。');
    assert.deepEqual(result.tags, ['决策', '看板']);

    assert.equal(captures.length, 1);
    const [{ prompt, options }] = captures;
    assert.deepEqual(options.skills, ['distill']);
    assert.deepEqual(options.settingSources, ['project']);
    assert.equal(typeof prompt, 'string');
    assert.match(prompt, /要不要做标签体系？/);
    assert.match(prompt, /可以先观察主题分布。/);
    assert.match(prompt, /关注角度：工具决策/);
  });
});

test('passes through shouldSave=false with a reason', async () => {
  await withDistiller([
    assistantText(JSON.stringify({ shouldSave: false, reason: ' 只是闲聊 ' })),
  ], async ({ db, distiller }) => {
    const conversation = createConversation(db);
    appendMessage(db, conversation.id, { role: 'user', content: '今天天气不错' });

    assert.deepEqual(await distiller.distill(conversation.id), {
      shouldSave: false,
      reason: '只是闲聊',
    });
  });
});

test('rejects unparseable or malformed skill output with a 502 error', async () => {
  for (const events of [
    [assistantText('完全不是 JSON')],
    [assistantText('{"title":"缺少 shouldSave"}')],
    [assistantText(JSON.stringify({ shouldSave: true, title: '只有标题' }))],
    [assistantText(JSON.stringify({ shouldSave: true, title: '标题', content: '正文', tags: [1] }))],
  ]) {
    await withDistiller(events, async ({ db, distiller }) => {
      const conversation = createConversation(db);
      appendMessage(db, conversation.id, { role: 'user', content: '内容' });
      await assert.rejects(
        () => distiller.distill(conversation.id),
        (error) => error.status === 502,
      );
    });
  }
});
