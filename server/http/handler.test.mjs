import assert from 'node:assert/strict';
import { mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { createServer, request as createRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { openDatabase } from '../db/database.mjs';
import { applyMigrations } from '../db/migrate.mjs';
import { upsertRecords } from '../db/records.mjs';
import { createHandler } from './handler.mjs';

async function withTestServer(run, setup = async () => {}) {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-api-'));
  const db = openDatabase(join(root, 'db.sqlite3'));
  const server = createServer(createHandler({ db, publicDir: root }));
  try {
    applyMigrations(db, resolve('db/migrations'));
    await setup(root);
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
