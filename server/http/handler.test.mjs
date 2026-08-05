import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer, request as createRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { openDatabase } from '../db/database.mjs';
import { applyMigrations } from '../db/migrate.mjs';
import { upsertRecords } from '../db/records.mjs';
import { insertThought } from '../db/thoughts.mjs';
import { createHandler } from './handler.mjs';

async function withTestServer(run, setup = async () => {}) {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-api-'));
  const db = openDatabase(join(root, 'db.sqlite3'));
  const server = createServer(createHandler({ db, publicDir: root }));
  try {
    applyMigrations(db, resolve('db/migrations'));
    await setup(root, db);
    await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
    const { port } = server.address();
    await run({ base: `http://127.0.0.1:${port}`, root });
  } finally {
    if (server.listening) {
      await new Promise((resolveClose) => server.close(resolveClose));
    }
    db.close();
    await rm(root, { recursive: true, force: true });
  }
}

async function jsonRequest(url, method, body) {
  return fetch(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('rejects a static symlink that resolves outside publicDir', async () => {
  const outsideRoot = await mkdtemp(join(tmpdir(), 'dashboard-outside-'));
  try {
    await writeFile(join(outsideRoot, 'secret.txt'), 'outside contents');
    await withTestServer(async ({ base }) => {
      const response = await fetch(`${base}/linked.txt`);
      assert.equal(response.status, 403);
      assert.deepEqual(await response.json(), {
        error: {
          code: 'INVALID_REQUEST',
          message: '禁止访问公共目录之外的路径',
        },
      });
    }, async (root) => {
      await symlink(join(outsideRoot, 'secret.txt'), join(root, 'linked.txt'));
    });
  } finally {
    await rm(outsideRoot, { recursive: true, force: true });
  }
});

test('rejects a null POST task body as an invalid request', async () => {
  await withTestServer(async ({ base }) => {
    const response = await fetch(`${base}/api/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: 'null',
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: { code: 'INVALID_REQUEST', message: '任务标题不能为空' },
    });
  });
});

test('rejects a null PATCH task body as an invalid request', async () => {
  await withTestServer(async ({ base }) => {
    const created = await fetch(`${base}/api/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '本地任务', description: '' }),
    }).then((response) => response.json());
    const response = await fetch(`${base}/api/tasks/${created.data.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: 'null',
    });
    assert.equal(response.status, 400);
    assert.deepEqual(await response.json(), {
      error: { code: 'INVALID_REQUEST', message: '任务状态无效' },
    });
  });
});

test('serves thoughts newest-first through the read-only API shape', async () => {
  await withTestServer(async ({ base }) => {
    const response = await fetch(`${base}/api/thoughts`);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.deepEqual(body.data.map(({ title }) => title), ['较新', '较早']);
    assert.deepEqual(Object.keys(body.data[0]).sort(), [
      'content', 'createdAt', 'id', 'tags', 'title',
    ]);

    for (const method of ['POST', 'PATCH', 'DELETE']) {
      const writeResponse = await fetch(`${base}/api/thoughts`, { method });
      assert.equal(writeResponse.status, 404);
      assert.deepEqual(await writeResponse.json(), {
        error: { code: 'NOT_FOUND', message: '接口不存在' },
      });
    }
  }, async (_root, db) => {
    insertThought(db, { title: '较早', content: '第一条' }, new Date('2026-08-03T02:00:00.000Z'));
    insertThought(db, { title: '较新', content: '第二条', tags: ['明确'] }, new Date('2026-08-04T02:00:00.000Z'));
  });
});

test('serves continuous goal CRUD and append-only progress', async () => {
  await withTestServer(async ({ base }) => {
    const createResponse = await jsonRequest(`${base}/api/goals`, 'POST', {
      title: '  持续目标  ',
      description: '  说明  ',
    });
    assert.equal(createResponse.status, 201);
    const created = (await createResponse.json()).data;
    assert.equal(created.title, '持续目标');
    assert.equal(created.description, '说明');
    assert.equal(created.status, 'active');
    assert.deepEqual(created.progress, []);

    const patchResponse = await jsonRequest(`${base}/api/goals/${created.id}`, 'PATCH', {
      title: '更新后的目标',
      status: 'paused',
    });
    assert.equal(patchResponse.status, 200);
    const patched = (await patchResponse.json()).data;
    assert.equal(patched.title, '更新后的目标');
    assert.equal(patched.description, '说明');
    assert.equal(patched.status, 'paused');

    const progressResponse = await jsonRequest(
      `${base}/api/goals/${created.id}/progress`,
      'POST',
      { content: '  第一条进展  ' },
    );
    assert.equal(progressResponse.status, 201);
    const progress = (await progressResponse.json()).data;
    assert.equal(progress.goalId, created.id);
    assert.equal(progress.content, '第一条进展');

    const listResponse = await fetch(`${base}/api/goals`);
    assert.equal(listResponse.status, 200);
    const listed = (await listResponse.json()).data;
    assert.equal(listed.length, 1);
    assert.deepEqual(listed[0].progress, [progress]);

    const conflictResponse = await fetch(`${base}/api/goals/${created.id}`, { method: 'DELETE' });
    assert.equal(conflictResponse.status, 409);
    assert.deepEqual(await conflictResponse.json(), {
      error: { code: 'INVALID_REQUEST', message: '已有进展的目标不能删除' },
    });

    const deletable = (await jsonRequest(`${base}/api/goals`, 'POST', {
      title: '无进展目标',
    }).then((response) => response.json())).data;
    const deleteResponse = await fetch(`${base}/api/goals/${deletable.id}`, { method: 'DELETE' });
    assert.equal(deleteResponse.status, 200);
    assert.deepEqual((await deleteResponse.json()).data, deletable);
  });
});

test('returns 404 for missing goals and exposes no progress mutation routes', async () => {
  await withTestServer(async ({ base }) => {
    for (const [method, path, body] of [
      ['PATCH', '/api/goals/missing', { status: 'paused' }],
      ['DELETE', '/api/goals/missing'],
      ['POST', '/api/goals/missing/progress', { content: '进展' }],
    ]) {
      const response = body
        ? await jsonRequest(`${base}${path}`, method, body)
        : await fetch(`${base}${path}`, { method });
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), {
        error: { code: 'NOT_FOUND', message: '目标不存在' },
      });
    }

    for (const method of ['PATCH', 'DELETE']) {
      const response = await fetch(`${base}/api/goals/goal-id/progress`, { method });
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), {
        error: { code: 'NOT_FOUND', message: '接口不存在' },
      });
    }
  });
});

test('strictly validates goal and progress request bodies without writing', async () => {
  await withTestServer(async ({ base }) => {
    const invalidCreates = [
      null,
      [],
      { title: ' ' },
      { title: '目标', description: 1 },
      { title: '目标', status: 'unknown' },
      { title: '目标', source: 'Self' },
    ];
    for (const body of invalidCreates) {
      const response = await jsonRequest(`${base}/api/goals`, 'POST', body);
      assert.equal(response.status, 400);
    }

    const created = (await jsonRequest(`${base}/api/goals`, 'POST', {
      title: '原目标',
    }).then((response) => response.json())).data;
    const invalidPatches = [
      null,
      [],
      {},
      { title: ' ' },
      { description: 1 },
      { status: 'unknown' },
      { source: 'Self' },
    ];
    for (const body of invalidPatches) {
      const response = await jsonRequest(`${base}/api/goals/${created.id}`, 'PATCH', body);
      assert.equal(response.status, 400);
    }

    const invalidProgress = [
      null,
      [],
      { content: ' ' },
      { content: '进展', source: 'Self' },
    ];
    for (const body of invalidProgress) {
      const response = await jsonRequest(
        `${base}/api/goals/${created.id}/progress`,
        'POST',
        body,
      );
      assert.equal(response.status, 400);
    }

    const listed = await fetch(`${base}/api/goals`).then((response) => response.json());
    assert.equal(listed.data.length, 1);
    assert.equal(listed.data[0].title, '原目标');
    assert.equal(listed.data[0].status, 'active');
    assert.deepEqual(listed.data[0].progress, []);
  });
});

test('serves editable Eisenhower todo CRUD with normalized fields', async () => {
  await withTestServer(async ({ base }) => {
    const createResponse = await jsonRequest(`${base}/api/todos`, 'POST', {
      title: '  本地事项  ',
      isImportant: true,
      isUrgent: false,
      tags: [' 工作 ', '工作', ' ', '学习'],
    });
    assert.equal(createResponse.status, 201);
    const created = (await createResponse.json()).data;
    assert.equal(created.title, '本地事项');
    assert.equal(created.status, 'pending');
    assert.equal(created.isImportant, true);
    assert.equal(created.isUrgent, false);
    assert.deepEqual(created.tags, ['工作', '学习']);
    assert.equal(created.completedAt, null);

    const completeResponse = await jsonRequest(
      `${base}/api/todos/${created.id}`,
      'PATCH',
      {
        title: '  已完成事项  ',
        status: 'completed',
        isImportant: false,
        isUrgent: true,
        tags: ['完成'],
      },
    );
    assert.equal(completeResponse.status, 200);
    const completed = (await completeResponse.json()).data;
    assert.equal(completed.title, '已完成事项');
    assert.equal(completed.status, 'completed');
    assert.equal(completed.isImportant, false);
    assert.equal(completed.isUrgent, true);
    assert.deepEqual(completed.tags, ['完成']);
    assert.equal(Number.isNaN(Date.parse(completed.completedAt)), false);

    const reopenResponse = await jsonRequest(
      `${base}/api/todos/${created.id}`,
      'PATCH',
      { status: 'in_progress' },
    );
    assert.equal(reopenResponse.status, 200);
    assert.equal((await reopenResponse.json()).data.completedAt, null);

    const cancelResponse = await jsonRequest(
      `${base}/api/todos/${created.id}`,
      'PATCH',
      { status: 'cancelled' },
    );
    assert.equal(cancelResponse.status, 200);
    assert.equal((await cancelResponse.json()).data.completedAt, null);

    const older = await jsonRequest(`${base}/api/todos`, 'POST', {
      title: '另一事项',
    }).then((response) => response.json());
    const listResponse = await fetch(`${base}/api/todos`);
    assert.equal(listResponse.status, 200);
    const listed = (await listResponse.json()).data;
    assert.equal(listed.length, 2);
    assert.equal(listed[0].id, older.data.id);

    const deleteResponse = await fetch(`${base}/api/todos/${created.id}`, { method: 'DELETE' });
    assert.equal(deleteResponse.status, 200);
    assert.deepEqual((await deleteResponse.json()).data, {
      ...completed,
      status: 'cancelled',
      completedAt: null,
    });
    const remaining = await fetch(`${base}/api/todos`).then((response) => response.json());
    assert.deepEqual(remaining.data.map(({ id }) => id), [older.data.id]);
  });
});

test('deletes only the decoded todo ID and returns the deleted object', async () => {
  await withTestServer(async ({ base }) => {
    const response = await fetch(`${base}/api/todos/todo%2Fencoded`, { method: 'DELETE' });
    assert.equal(response.status, 200);
    const deleted = (await response.json()).data;
    assert.equal(deleted.id, 'todo/encoded');
    assert.equal(deleted.title, '编码 ID');

    const listed = await fetch(`${base}/api/todos`).then((item) => item.json());
    assert.deepEqual(listed.data.map(({ id }) => id), ['todo%2Fencoded']);
  }, async (_root, db) => {
    const createdAt = '2026-08-04T02:00:00.000Z';
    const insert = db.prepare(`
      INSERT INTO todos (
        id, title, status, is_important, is_urgent, tags_json, created_at, completed_at
      ) VALUES (?, ?, 'pending', 0, 0, '[]', ?, NULL)
    `);
    insert.run('todo/encoded', '编码 ID', createdAt);
    insert.run('todo%2Fencoded', '保留事项', createdAt);
  });
});

test('returns 404 for missing todos and 400 for malformed todo bodies without writing', async () => {
  await withTestServer(async ({ base }) => {
    for (const [method, path, body] of [
      ['PATCH', '/api/todos/missing', { status: 'completed' }],
      ['DELETE', '/api/todos/missing'],
    ]) {
      const response = body
        ? await jsonRequest(`${base}${path}`, method, body)
        : await fetch(`${base}${path}`, { method });
      assert.equal(response.status, 404);
      assert.deepEqual(await response.json(), {
        error: { code: 'NOT_FOUND', message: 'TODO 不存在' },
      });
    }

    const invalidCreates = [
      null,
      [],
      { title: ' ' },
      { title: '事项', status: 'unknown' },
      { title: '事项', isImportant: 1 },
      { title: '事项', isUrgent: 'false' },
      { title: '事项', tags: ['工作', 1] },
      { title: '事项', priority: 'high' },
    ];
    for (const body of invalidCreates) {
      const response = await jsonRequest(`${base}/api/todos`, 'POST', body);
      assert.equal(response.status, 400);
    }

    const created = await jsonRequest(`${base}/api/todos`, 'POST', {
      title: '原事项',
    }).then((response) => response.json());
    for (const body of [
      null,
      [],
      {},
      { title: ' ' },
      { status: 'unknown' },
      { isImportant: 0 },
      { isUrgent: null },
      { tags: '工作' },
      { source: 'Self' },
    ]) {
      const response = await jsonRequest(`${base}/api/todos/${created.data.id}`, 'PATCH', body);
      assert.equal(response.status, 400);
    }

    const invalidJson = await fetch(`${base}/api/todos`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{',
    });
    assert.equal(invalidJson.status, 400);

    const listed = await fetch(`${base}/api/todos`).then((response) => response.json());
    assert.equal(listed.data.length, 1);
    assert.equal(listed.data[0].id, created.data.id);
    assert.equal(listed.data[0].title, '原事项');
    assert.equal(listed.data[0].status, 'pending');
  });
});

test('serves health and local todo CRUD', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-api-'));
  const db = openDatabase(join(root, 'db.sqlite3'));
  applyMigrations(db, resolve('db/migrations'));
  await writeFile(join(root, 'index.html'), '<main>Dashboard shell</main>');
  await writeFile(join(root, 'bundle.js'), 'globalThis.dashboard = true;');
  upsertRecords(db, [{
    id: 'record%2Fone',
    domain: 'thought',
    type: 'idea',
    title: '测试记录',
  }]);
  const server = createServer(createHandler({ db, publicDir: root }));
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    const health = await fetch(`${base}/api/health`);
    assert.equal(health.status, 200);
    assert.deepEqual(await health.json(), { data: { status: 'ok' } });

    const records = await fetch(`${base}/api/records?domain=thought&type=idea`)
      .then((response) => response.json());
    assert.equal(records.data.length, 1);
    const record = await fetch(`${base}/api/records/record%252Fone`)
      .then((response) => response.json());
    assert.equal(record.data.id, 'record%2Fone');
    const missingRecord = await fetch(`${base}/api/records/missing`);
    assert.equal(missingRecord.status, 404);
    assert.deepEqual(await missingRecord.json(), {
      error: { code: 'NOT_FOUND', message: '记录不存在' },
    });

    const createResponse = await fetch(`${base}/api/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '本地任务', description: '' }),
    });
    assert.equal(createResponse.status, 201);
    const created = await createResponse.json();
    assert.equal(created.data.title, '本地任务');

    const patched = await fetch(`${base}/api/tasks/${created.data.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    }).then((response) => response.json());
    assert.equal(patched.data.status, 'completed');

    const tasks = await fetch(`${base}/api/tasks?kind=todo`)
      .then((response) => response.json());
    assert.equal(tasks.data.length, 1);

    const invalidTitle = await fetch(`${base}/api/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: ' ' }),
    });
    assert.equal(invalidTitle.status, 400);
    assert.deepEqual(await invalidTitle.json(), {
      error: { code: 'INVALID_REQUEST', message: '任务标题不能为空' },
    });

    const invalidStatus = await fetch(`${base}/api/tasks/${created.data.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'unknown' }),
    });
    assert.equal(invalidStatus.status, 400);
    assert.deepEqual(await invalidStatus.json(), {
      error: { code: 'INVALID_REQUEST', message: '任务状态无效' },
    });

    const unknownApi = await fetch(`${base}/api/tasks/${created.data.id}`);
    assert.equal(unknownApi.status, 404);
    assert.deepEqual(await unknownApi.json(), {
      error: { code: 'NOT_FOUND', message: '接口不存在' },
    });

    const bundle = await fetch(`${base}/bundle.js`);
    assert.equal(bundle.status, 200);
    assert.equal(await bundle.text(), 'globalThis.dashboard = true;');
    const fallback = await fetch(`${base}/thoughts/record`);
    assert.equal(fallback.status, 200);
    assert.equal(await fallback.text(), '<main>Dashboard shell</main>');

    const traversalStatus = await new Promise((resolveStatus, reject) => {
      const request = createRequest({
        host: '127.0.0.1',
        port,
        path: '/%2e%2e%2fprivate.txt',
      }, (response) => {
        response.resume();
        response.on('end', () => resolveStatus(response.statusCode));
      });
      request.on('error', reject);
      request.end();
    });
    assert.equal(traversalStatus, 403);
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
    db.close();
    await rm(root, { recursive: true, force: true });
  }
});
