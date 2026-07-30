# Local SQLite Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the browser-to-cloud and silent-mock runtime with one local Node application, one SQLite file, honest empty/error states, local TODO persistence, and one-command Docker startup.

**Architecture:** A Node HTTP process serves the React production build and a six-route same-origin API. The API reads and writes `data/dashboard.sqlite3` through Node's built-in SQLite module; Webpack Dev Server proxies `/api` to the local Node process during development. Self Vault import and clean GitHub publication are separate follow-up plans.

**Tech Stack:** React 18, TypeScript, Webpack 5, Node.js 24.15 or newer, built-in `node:http`, built-in `node:sqlite`, built-in `node:test`, SQLite, Docker Compose.

## Global Constraints

- Runtime data path must be `Browser -> same-origin /api -> SQLite`.
- SQLite is the only runtime source of truth.
- Business schema is limited to `records` and `tasks`; `schema_migrations` is infrastructure-only.
- `tasks.kind` is `goal` or `todo`; `tasks.period` is `year`, `month`, or `null`.
- Investment, thoughts, career, and projects are read-only in the first release.
- TODO creation and status changes remain writable.
- Career data contains only `A公司`, `Y公司`, and `H公司` aliases and has no compensation field.
- No cloud fallback, business mock fallback, external runtime CDN, authentication system, PostgreSQL, or full CRUD.
- Default Docker port binds to `127.0.0.1`.
- Do not publish or push this legacy Git history; clean GitHub publication is Plan 3.

---

## Target File Map

### Runtime database

- Create `db/migrations/001_initial.sql`: initial SQLite schema and indexes.
- Create `server/db/database.mjs`: open/close SQLite and configure pragmas.
- Create `server/db/migrate.mjs`: ordered SQL migration runner.
- Create `server/db/records.mjs`: record reads and deterministic upserts.
- Create `server/db/tasks.mjs`: task reads, creates, updates, and deterministic upserts.

### HTTP application

- Create `server/http/response.mjs`: JSON, body parsing, and error helpers.
- Create `server/http/handler.mjs`: API routing and static SPA delivery.
- Create `server/index.mjs`: production process entrypoint and configuration.
- Create `scripts/dev.mjs`: start API and Webpack Dev Server together.
- Create `server/cli/migrate.mjs`: explicit migration command.
- Create `server/cli/seed-demo.mjs`: optional anonymous demo seed.

### Frontend

- Create `src/api/types.ts`: API-facing record and task contracts.
- Create `src/api/client.ts`: same-origin API client.
- Create `src/hooks/useRecords.ts`: loading/error/data state for one record domain.
- Create `src/hooks/useTasks.ts`: loading/error/data state plus task mutations.
- Create `src/components/common/ErrorState.tsx`: explicit load failure UI.
- Modify record and task pages to consume the local API.

### Packaging and documentation

- Modify `package.json`, `package-lock.json`, `webpack.config.js`, `tsconfig.json`, `.gitignore`, and `index.html`.
- Create `Dockerfile`, `compose.yaml`, `.dockerignore`, `.nvmrc`, `.env.example`, and `README.md`.
- Delete legacy client code, generated cloud migrations, business mocks, private plan/asset metadata, and obsolete screenshot.

---

### Task 1: SQLite schema and migration runner

**Files:**
- Create: `db/migrations/001_initial.sql`
- Create: `server/db/database.mjs`
- Create: `server/db/migrate.mjs`
- Test: `server/db/migrate.test.mjs`

**Interfaces:**
- Produces: `openDatabase(filename: string): DatabaseSync`
- Produces: `applyMigrations(db: DatabaseSync, migrationsDir: string): string[]`
- Later tasks consume the migrated `records` and `tasks` tables.

- [ ] **Step 1: Write the failing migration test**

```js
// server/db/migrate.test.mjs
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { openDatabase } from './database.mjs';
import { applyMigrations } from './migrate.mjs';

test('applies the initial schema exactly once', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-db-'));
  const db = openDatabase(join(root, 'dashboard.sqlite3'));
  try {
    const migrationsDir = resolve('db/migrations');
    assert.deepEqual(applyMigrations(db, migrationsDir), ['001_initial.sql']);
    assert.deepEqual(applyMigrations(db, migrationsDir), []);

    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type = 'table' AND name IN ('records', 'tasks', 'schema_migrations')
      ORDER BY name
    `).all().map(({ name }) => name);
    assert.deepEqual(tables, ['records', 'schema_migrations', 'tasks']);
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run:

```bash
node --test server/db/migrate.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `server/db/database.mjs`.

- [ ] **Step 3: Add the minimal schema**

```sql
-- db/migrations/001_initial.sql
CREATE TABLE records (
  id TEXT PRIMARY KEY,
  domain TEXT NOT NULL CHECK (domain IN ('investment', 'thought', 'career', 'project')),
  type TEXT NOT NULL CHECK (type IN ('knowledge', 'idea', 'decision', 'experience', 'project')),
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active',
  occurred_at TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  payload_json TEXT NOT NULL DEFAULT '{}',
  source_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX records_domain_occurred_at
ON records(domain, occurred_at DESC);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('goal', 'todo')),
  period TEXT CHECK (period IN ('year', 'month') OR period IS NULL),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  target_at TEXT,
  completed_at TEXT,
  source_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX tasks_kind_status ON tasks(kind, status);
CREATE INDEX tasks_target_at ON tasks(target_at);
```

- [ ] **Step 4: Implement database opening and migrations**

```js
// server/db/database.mjs
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

export function openDatabase(filename) {
  mkdirSync(dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');
  return db;
}
```

```js
// server/db/migrate.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function applyMigrations(db, migrationsDir) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    )
  `);
  const applied = new Set(
    db.prepare('SELECT name FROM schema_migrations').all().map(({ name }) => name),
  );
  const pending = readdirSync(migrationsDir)
    .filter((name) => /^\d+_.+\.sql$/.test(name) && !applied.has(name))
    .sort();

  for (const name of pending) {
    const sql = readFileSync(join(migrationsDir, name), 'utf8');
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(sql);
      db.prepare(
        'INSERT INTO schema_migrations(name, applied_at) VALUES (?, ?)',
      ).run(name, new Date().toISOString());
      db.exec('COMMIT');
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  return pending;
}
```

- [ ] **Step 5: Run the migration test**

Run:

```bash
node --test server/db/migrate.test.mjs
```

Expected: PASS, with an experimental/release-candidate SQLite warning allowed.

- [ ] **Step 6: Commit**

```bash
git add db/migrations/001_initial.sql server/db/database.mjs server/db/migrate.mjs server/db/migrate.test.mjs
git commit -m "feat: add local sqlite schema"
```

---

### Task 2: Records and tasks persistence

**Files:**
- Create: `server/db/records.mjs`
- Create: `server/db/tasks.mjs`
- Test: `server/db/records.test.mjs`
- Test: `server/db/tasks.test.mjs`

**Interfaces:**
- Consumes: migrated SQLite database from Task 1.
- Produces: `listRecords(db, { domain, type? })`, `getRecord(db, id)`, `upsertRecords(db, records)`.
- Produces: `listTasks(db, { kind })`, `createTask(db, input)`, `updateTask(db, id, patch)`, `upsertTasks(db, tasks)`.

- [ ] **Step 1: Write failing record-store tests**

```js
// server/db/records.test.mjs
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { openDatabase } from './database.mjs';
import { applyMigrations } from './migrate.mjs';
import { getRecord, listRecords, upsertRecords } from './records.mjs';

test('upserts and filters records while decoding JSON fields', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-records-'));
  const db = openDatabase(join(root, 'db.sqlite3'));
  applyMigrations(db, resolve('db/migrations'));
  try {
    upsertRecords(db, [{
      id: 'record-1',
      domain: 'thought',
      type: 'idea',
      title: '示例想法',
      content: '仅用于测试',
      status: 'active',
      occurredAt: '2026-07-30',
      tags: ['示例'],
      payload: { category: '生活' },
      sourceRef: null,
    }]);
    assert.equal(listRecords(db, { domain: 'investment' }).length, 0);
    const row = getRecord(db, 'record-1');
    assert.deepEqual(row.tags, ['示例']);
    assert.deepEqual(row.payload, { category: '生活' });
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Write failing task-store tests**

```js
// server/db/tasks.test.mjs
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { openDatabase } from './database.mjs';
import { applyMigrations } from './migrate.mjs';
import { createTask, listTasks, updateTask } from './tasks.mjs';

test('creates a local todo and completes it', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-tasks-'));
  const db = openDatabase(join(root, 'db.sqlite3'));
  applyMigrations(db, resolve('db/migrations'));
  try {
    const created = createTask(db, {
      title: '验证本地持久化',
      description: '',
    });
    assert.equal(created.kind, 'todo');
    const completed = updateTask(db, created.id, { status: 'completed' });
    assert.equal(completed.status, 'completed');
    assert.ok(completed.completedAt);
    assert.equal(listTasks(db, { kind: 'todo' }).length, 1);
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 3: Run both tests and verify missing-module failures**

Run:

```bash
node --test server/db/records.test.mjs server/db/tasks.test.mjs
```

Expected: FAIL for missing `records.mjs` and `tasks.mjs`.

- [ ] **Step 4: Implement records persistence**

```js
// server/db/records.mjs
function decode(row) {
  if (!row) return null;
  return {
    id: row.id,
    domain: row.domain,
    type: row.type,
    title: row.title,
    content: row.content,
    status: row.status,
    occurredAt: row.occurred_at,
    tags: JSON.parse(row.tags_json),
    payload: JSON.parse(row.payload_json),
    sourceRef: row.source_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listRecords(db, { domain, type } = {}) {
  const conditions = [];
  const values = [];
  if (domain) { conditions.push('domain = ?'); values.push(domain); }
  if (type) { conditions.push('type = ?'); values.push(type); }
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  return db.prepare(`
    SELECT * FROM records ${where}
    ORDER BY COALESCE(occurred_at, updated_at) DESC, id
  `).all(...values).map(decode);
}

export function getRecord(db, id) {
  return decode(db.prepare('SELECT * FROM records WHERE id = ?').get(id));
}

export function upsertRecords(db, records) {
  const statement = db.prepare(`
    INSERT INTO records (
      id, domain, type, title, content, status, occurred_at,
      tags_json, payload_json, source_ref, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      domain = excluded.domain,
      type = excluded.type,
      title = excluded.title,
      content = excluded.content,
      status = excluded.status,
      occurred_at = excluded.occurred_at,
      tags_json = excluded.tags_json,
      payload_json = excluded.payload_json,
      source_ref = excluded.source_ref,
      updated_at = excluded.updated_at
  `);
  const now = new Date().toISOString();
  for (const record of records) {
    statement.run(
      record.id, record.domain, record.type, record.title, record.content ?? '',
      record.status ?? 'active', record.occurredAt ?? null,
      JSON.stringify(record.tags ?? []), JSON.stringify(record.payload ?? {}),
      record.sourceRef ?? null, record.createdAt ?? now, now,
    );
  }
}
```

- [ ] **Step 5: Implement tasks persistence**

```js
// server/db/tasks.mjs
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
```

- [ ] **Step 6: Run the persistence tests**

Run:

```bash
node --test server/db/records.test.mjs server/db/tasks.test.mjs
```

Expected: 2 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add server/db/records.mjs server/db/tasks.mjs server/db/records.test.mjs server/db/tasks.test.mjs
git commit -m "feat: persist records and tasks locally"
```

---

### Task 3: Same-origin API and static server

**Files:**
- Create: `server/http/response.mjs`
- Create: `server/http/handler.mjs`
- Create: `server/http/handler.test.mjs`
- Create: `server/index.mjs`
- Create: `server/cli/migrate.mjs`
- Create: `scripts/dev.mjs`
- Modify: `webpack.config.js`

**Interfaces:**
- Consumes: database/store functions from Tasks 1–2.
- Produces: `createHandler({ db, publicDir }): (request, response) => Promise<void>`.
- Produces API response envelope `{ data: T }` and error envelope `{ error: { code, message } }`.

- [ ] **Step 1: Write the failing API integration test**

```js
// server/http/handler.test.mjs
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { openDatabase } from '../db/database.mjs';
import { applyMigrations } from '../db/migrate.mjs';
import { createHandler } from './handler.mjs';

test('serves health and local todo CRUD', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-api-'));
  const db = openDatabase(join(root, 'db.sqlite3'));
  applyMigrations(db, resolve('db/migrations'));
  const server = createServer(createHandler({ db, publicDir: root }));
  await new Promise((resolveListen) => server.listen(0, '127.0.0.1', resolveListen));
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  try {
    assert.equal((await fetch(`${base}/api/health`)).status, 200);
    const created = await fetch(`${base}/api/tasks`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ title: '本地任务', description: '' }),
    }).then((response) => response.json());
    assert.equal(created.data.title, '本地任务');

    const patched = await fetch(`${base}/api/tasks/${created.data.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    }).then((response) => response.json());
    assert.equal(patched.data.status, 'completed');
  } finally {
    await new Promise((resolveClose) => server.close(resolveClose));
    db.close();
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Run the API test and verify it fails**

Run:

```bash
node --test server/http/handler.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `handler.mjs`.

- [ ] **Step 3: Implement response helpers**

```js
// server/http/response.mjs
export function sendJson(response, status, payload) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

export async function readJson(request, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limit) throw Object.assign(new Error('请求内容过大'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw Object.assign(new Error('请求 JSON 无效'), { status: 400 });
  }
}

export function sendError(response, error) {
  const status = Number(error.status) || 500;
  sendJson(response, status, {
    error: {
      code: status === 500 ? 'INTERNAL_ERROR' : 'INVALID_REQUEST',
      message: status === 500 ? '本地服务暂时不可用' : error.message,
    },
  });
}
```

- [ ] **Step 4: Implement exact API routes and SPA fallback**

Implement `server/http/handler.mjs` with these route rules:

```js
if (method === 'GET' && pathname === '/api/health') {
  return sendJson(response, 200, { data: { status: 'ok' } });
}
if (method === 'GET' && pathname === '/api/records') {
  return sendJson(response, 200, {
    data: listRecords(db, {
      domain: url.searchParams.get('domain') || undefined,
      type: url.searchParams.get('type') || undefined,
    }),
  });
}
if (method === 'GET' && /^\/api\/records\/[^/]+$/.test(pathname)) {
  const item = getRecord(db, decodeURIComponent(pathname.split('/').at(-1)));
  return item
    ? sendJson(response, 200, { data: item })
    : sendJson(response, 404, { error: { code: 'NOT_FOUND', message: '记录不存在' } });
}
if (method === 'GET' && pathname === '/api/tasks') {
  return sendJson(response, 200, {
    data: listTasks(db, { kind: url.searchParams.get('kind') || undefined }),
  });
}
if (method === 'POST' && pathname === '/api/tasks') {
  const body = await readJson(request);
  if (typeof body.title !== 'string' || !body.title.trim()) {
    throw Object.assign(new Error('任务标题不能为空'), { status: 400 });
  }
  return sendJson(response, 201, { data: createTask(db, body) });
}
if (method === 'PATCH' && /^\/api\/tasks\/[^/]+$/.test(pathname)) {
  const body = await readJson(request);
  const allowed = new Set(['pending', 'in_progress', 'completed', 'cancelled']);
  if (!allowed.has(body.status)) {
    throw Object.assign(new Error('任务状态无效'), { status: 400 });
  }
  const item = updateTask(db, decodeURIComponent(pathname.split('/').at(-1)), body);
  return item
    ? sendJson(response, 200, { data: item })
    : sendJson(response, 404, { error: { code: 'NOT_FOUND', message: '任务不存在' } });
}
```

For non-API GET requests, resolve the requested path inside `publicDir`; serve the file when present and otherwise serve `index.html`. Reject any resolved path outside `publicDir`. All unhandled `/api` requests return a JSON 404. Wrap the handler in `try/catch` and call `sendError`.

- [ ] **Step 5: Add production and explicit migration entrypoints**

```js
// server/index.mjs
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { openDatabase } from './db/database.mjs';
import { applyMigrations } from './db/migrate.mjs';
import { createHandler } from './http/handler.mjs';

const dataDir = resolve(process.env.DATA_DIR ?? 'data');
const db = openDatabase(resolve(dataDir, 'dashboard.sqlite3'));
applyMigrations(db, resolve('db/migrations'));
const port = Number.parseInt(process.env.PORT ?? '3015', 10);
const host = process.env.HOST ?? '127.0.0.1';
const server = createServer(createHandler({ db, publicDir: resolve('dist') }));
server.listen(port, host, () => console.log(`Dashboard: http://${host}:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => { db.close(); process.exit(0); }));
}
```

```js
// server/cli/migrate.mjs
import { resolve } from 'node:path';
import { openDatabase } from '../db/database.mjs';
import { applyMigrations } from '../db/migrate.mjs';

const db = openDatabase(resolve(process.env.DATA_DIR ?? 'data', 'dashboard.sqlite3'));
try {
  const applied = applyMigrations(db, resolve('db/migrations'));
  console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is current');
} finally {
  db.close();
}
```

- [ ] **Step 6: Add local development orchestration**

Create `scripts/dev.mjs` using `spawn`:

```js
import { spawn } from 'node:child_process';

const commands = [
  spawn(process.execPath, ['server/index.mjs'], {
    stdio: 'inherit',
    env: { ...process.env, PORT: '3016' },
  }),
  spawn('npm', ['exec', 'webpack', 'serve'], { stdio: 'inherit', shell: true }),
];
const stop = () => commands.forEach((child) => child.kill('SIGTERM'));
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
Promise.race(commands.map((child) => new Promise((resolve) => child.on('exit', resolve))))
  .finally(stop);
```

Add this Webpack development proxy:

```js
proxy: [
  {
    context: ['/api'],
    target: 'http://127.0.0.1:3016',
  },
],
```

- [ ] **Step 7: Run API and migration tests**

Run:

```bash
node --test
DATA_DIR=/private/tmp/my-dashboard-plan1 node server/cli/migrate.mjs
```

Expected: all Node tests PASS and migration command prints `Applied: 001_initial.sql`.

- [ ] **Step 8: Commit**

```bash
git add server/http server/index.mjs server/cli/migrate.mjs scripts/dev.mjs webpack.config.js
git commit -m "feat: serve local dashboard api"
```

---

### Task 4: Frontend record API and read-only pages

**Files:**
- Create: `src/api/types.ts`
- Create: `src/api/client.ts`
- Create: `src/hooks/useRecords.ts`
- Create: `src/components/common/ErrorState.tsx`
- Modify: `src/pages/Investment.tsx`
- Modify: `src/components/investment/KnowledgeList.tsx`
- Modify: `src/components/investment/ReviewTimeline.tsx`
- Delete: `src/components/investment/NewsList.tsx`
- Modify: `src/pages/Thoughts.tsx`
- Modify: `src/pages/Career.tsx`
- Modify: `src/pages/Projects.tsx`
- Test: `scripts/migration/frontend-record-contract.test.mjs`

**Interfaces:**
- Consumes: `GET /api/records?domain=<domain>` from Task 3.
- Produces: `listRecords(domain, type?)`, `useRecords(domain)`, and typed page payloads.

- [ ] **Step 1: Add a failing source-contract test**

```js
// scripts/migration/frontend-record-contract.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const files = [
  'src/pages/Thoughts.tsx',
  'src/pages/Career.tsx',
  'src/pages/Projects.tsx',
  'src/components/investment/KnowledgeList.tsx',
  'src/components/investment/ReviewTimeline.tsx',
];

test('record pages use the local API without silent mock fallback', async () => {
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /supabase|mock[A-Z]|onedaycloud/);
  }
  const career = await readFile('src/pages/Career.tsx', 'utf8');
  assert.doesNotMatch(career, /salary|PASSWORD|showPasswordModal/);
});
```

- [ ] **Step 2: Run the contract test and verify it fails on current imports/mocks**

Run:

```bash
node --test scripts/migration/frontend-record-contract.test.mjs
```

Expected: FAIL on the first legacy record page.

- [ ] **Step 3: Add exact frontend API contracts**

```ts
// src/api/types.ts
export type RecordDomain = 'investment' | 'thought' | 'career' | 'project';
export type RecordType = 'knowledge' | 'idea' | 'decision' | 'experience' | 'project';

export interface RecordItem<TPayload extends object = Record<string, unknown>> {
  id: string;
  domain: RecordDomain;
  type: RecordType;
  title: string;
  content: string;
  status: string;
  occurredAt: string | null;
  tags: string[];
  payload: TPayload;
  sourceRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CareerPayload {
  companyAlias: 'A公司' | 'Y公司' | 'H公司';
  position: string;
  startDate: string;
  endDate: string | null;
  responsibilities: string;
  projects: string[];
  isCurrent: boolean;
}

export interface ProjectPayload {
  techStack: string[];
  repositoryUrl: string | null;
  demoUrl: string | null;
  currentFocus: string;
}
```

```ts
// src/api/client.ts
import type { RecordDomain, RecordItem } from './types';

export class ApiError extends Error {}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...init?.headers },
  });
  const payload = await response.json();
  if (!response.ok) throw new ApiError(payload.error?.message ?? '本地服务不可用');
  return payload.data as T;
}

export function listRecords(domain: RecordDomain, type?: string) {
  const query = new URLSearchParams({ domain });
  if (type) query.set('type', type);
  return request<RecordItem[]>(`/api/records?${query}`);
}

export { request };
```

- [ ] **Step 4: Implement the shared record hook and error state**

```ts
// src/hooks/useRecords.ts
import { useEffect, useState } from 'react';
import { ApiError, listRecords } from '../api/client';
import type { RecordDomain, RecordItem } from '../api/types';

export function useRecords(domain: RecordDomain) {
  const [data, setData] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setLoading(true);
    listRecords(domain)
      .then((records) => { if (active) setData(records); })
      .catch((reason) => {
        if (active) setError(reason instanceof ApiError ? reason.message : '本地数据加载失败');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [domain]);
  return { data, loading, error };
}
```

```tsx
// src/components/common/ErrorState.tsx
import { AlertTriangle } from 'lucide-react';

export default function ErrorState({ message }: { message: string }) {
  return (
    <div className="vintage-card p-8 text-center">
      <AlertTriangle className="mx-auto mb-3 text-vintage-red" size={40} />
      <h3 className="font-bold text-vintage-dark">本地数据暂时不可用</h3>
      <p className="mt-2 text-sm text-vintage-brown">{message}</p>
    </div>
  );
}
```

- [ ] **Step 5: Migrate investment and remove the obsolete news tab**

In `Investment.tsx`, call `useRecords('investment')` once, render `Loading` or `ErrorState`, keep only:

```ts
const tabs = [
  { path: '', label: '投资知识', icon: BookOpen },
  { path: 'review', label: '复盘与决策', icon: Calendar },
];
```

Pass records into:

```tsx
<Route index element={<KnowledgeList records={data.filter((item) => item.type === 'knowledge')} />} />
<Route
  path="review"
  element={<ReviewTimeline records={data.filter((item) => ['experience', 'decision'].includes(item.type))} />}
/>
```

Convert `KnowledgeList` and `ReviewTimeline` to pure display components accepting `RecordItem[]`. Delete all `useEffect`, remote queries, and mock arrays. Remove `NewsList.tsx`.

- [ ] **Step 6: Migrate thoughts**

Use `useRecords('thought')`. Derive categories from `record.payload.category` when it is a string, otherwise use `record.type`. Preserve the current category buttons and detail modal. Replace database-specific date fields with `record.occurredAt ?? record.updatedAt`. Show `EmptyState` when the filtered list is empty and `ErrorState` on load failure.

- [ ] **Step 7: Migrate career without sensitive controls**

Use `useRecords('career')` and interpret `record.payload as CareerPayload`. Keep the timeline/card markup, but render only:

```tsx
<h3>{payload.position}</h3>
<span>{payload.companyAlias}</span>
<span>{payload.startDate} - {payload.endDate ?? '至今'}</span>
<p>{payload.responsibilities}</p>
```

Delete password state, password constants, compensation rendering, lock/eye icons, and the password modal.

- [ ] **Step 8: Migrate projects**

Use `useRecords('project')`, cast payload to `ProjectPayload`, and map:

```tsx
const project = {
  id: record.id,
  name: record.title,
  description: record.content,
  techStack: payload.techStack,
  repositoryUrl: payload.repositoryUrl,
  demoUrl: payload.demoUrl,
  currentFocus: payload.currentFocus,
};
```

Keep current cards and external links. Remove remote queries and project mocks.

- [ ] **Step 9: Run frontend contract, typecheck, and build**

Run:

```bash
node --test scripts/migration/frontend-record-contract.test.mjs
npm run typecheck
npm run build
```

Expected: source-contract test PASS, TypeScript PASS, Webpack production build PASS.

- [ ] **Step 10: Commit**

```bash
git add src/api src/hooks/useRecords.ts src/components/common/ErrorState.tsx src/pages src/components/investment scripts/migration/frontend-record-contract.test.mjs
git commit -m "feat: read dashboard records from local api"
```

---

### Task 5: Local goals and TODO behavior

**Files:**
- Modify: `src/api/types.ts`
- Modify: `src/api/client.ts`
- Create: `src/hooks/useTasks.ts`
- Modify: `src/components/todos/GoalsList.tsx`
- Modify: `src/components/todos/TodoList.tsx`
- Test: `scripts/migration/frontend-task-contract.test.mjs`

**Interfaces:**
- Consumes: task API from Task 3.
- Produces: typed `listTasks`, `createTask`, `patchTask`, and `useTasks`.

- [ ] **Step 1: Write a failing task-page source contract**

```js
// scripts/migration/frontend-task-contract.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('goal and todo pages use local task API only', async () => {
  for (const file of ['src/components/todos/GoalsList.tsx', 'src/components/todos/TodoList.tsx']) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, /supabase|mockGoals|onedaycloud/);
  }
});
```

- [ ] **Step 2: Run it and verify current imports fail**

Run:

```bash
node --test scripts/migration/frontend-task-contract.test.mjs
```

Expected: FAIL.

- [ ] **Step 3: Add task API types and functions**

```ts
// append to src/api/types.ts
export interface TaskItem {
  id: string;
  kind: 'goal' | 'todo';
  period: 'year' | 'month' | null;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  targetAt: string | null;
  completedAt: string | null;
  sourceRef: string | null;
  createdAt: string;
  updatedAt: string;
}
```

```ts
// append to src/api/client.ts
import type { TaskItem } from './types';

export function listTasks(kind: 'goal' | 'todo') {
  return request<TaskItem[]>(`/api/tasks?kind=${kind}`);
}

export function createTask(input: { title: string; description: string }) {
  return request<TaskItem>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function patchTask(id: string, status: TaskItem['status']) {
  return request<TaskItem>(`/api/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}
```

- [ ] **Step 4: Implement task loading and mutation hook**

`useTasks(kind)` must expose:

```ts
{
  data: TaskItem[];
  loading: boolean;
  error: string | null;
  refresh(): Promise<void>;
  add(input: { title: string; description: string }): Promise<void>;
  setStatus(id: string, status: TaskItem['status']): Promise<void>;
}
```

The hook calls `refresh()` on mount, updates error state on failure, and refreshes after successful mutations. It does not optimistically mutate state.

- [ ] **Step 5: Migrate GoalsList**

Use `useTasks('goal')`. Keep grouping:

```ts
const yearGoals = data.filter((goal) => goal.period === 'year');
const monthGoals = data.filter((goal) => goal.period === 'month');
```

Keep existing visual cards/status labels. Render loading, explicit error, or honest empty state. Goals remain read-only.

- [ ] **Step 6: Migrate TodoList**

Use `useTasks('todo')`. Connect the current add form to `add`, completion/reopen/cancel buttons to `setStatus`, and keep the completion seal. Disable submit while saving and surface mutation failures through `ErrorState` or an inline message.

- [ ] **Step 7: Run tests and build**

Run:

```bash
node --test
npm run typecheck
npm run build
```

Expected: all Node tests PASS, TypeScript PASS, Webpack PASS.

- [ ] **Step 8: Commit**

```bash
git add src/api src/hooks/useTasks.ts src/components/todos scripts/migration/frontend-task-contract.test.mjs
git commit -m "feat: manage tasks in local sqlite"
```

---

### Task 6: Remove legacy runtime, mocks, internal metadata, and external CDNs

**Files:**
- Delete: `src/onedaycloud/`
- Delete: current `migrations/`
- Delete: `.plan/`
- Delete: `.assets_mapping`
- Delete: `assets/15440dfe-399d-430c-a8d5-518dd52414c6.jpg`
- Delete: `.npmrc`
- Modify: `package.json`
- Regenerate: `package-lock.json`
- Modify: `index.html`
- Modify: `.gitignore`
- Test: `scripts/migration/runtime-sanitization.test.mjs`

**Interfaces:**
- Consumes: all pages already migrated in Tasks 4–5.
- Produces: public-only dependency graph and a runtime with no external cloud/CDN calls.

- [ ] **Step 1: Write the failing sanitization test**

```js
// scripts/migration/runtime-sanitization.test.mjs
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

async function missing(path) {
  return access(path).then(() => false, () => true);
}

test('legacy runtime and private generated artifacts are absent', async () => {
  for (const path of [
    'src/onedaycloud',
    'migrations',
    '.plan',
    '.assets_mapping',
    'assets/15440dfe-399d-430c-a8d5-518dd52414c6.jpg',
  ]) assert.equal(await missing(path), true, `${path} must be removed`);

  const packageJson = await readFile('package.json', 'utf8');
  assert.doesNotMatch(packageJson, /oneday|supabase/i);
  const html = await readFile('index.html', 'utf8');
  assert.doesNotMatch(html, /https?:\/\//);
});
```

- [ ] **Step 2: Run it and verify it fails**

Run:

```bash
node --test scripts/migration/runtime-sanitization.test.mjs
```

Expected: FAIL because legacy paths still exist.

- [ ] **Step 3: Delete legacy and private artifacts**

Use `apply_patch` deletions for tracked text files/directories. Move the obsolete JPEG to Trash or delete it only after verifying the exact path. Do not touch unrelated files.

- [ ] **Step 4: Replace package metadata and scripts**

Replace `package.json` completely:

```json
{
  "name": "local-personal-dashboard",
  "private": true,
  "version": "0.1.0",
  "engines": {
    "node": ">=24.15.0"
  },
  "scripts": {
    "dev": "node scripts/dev.mjs",
    "build": "webpack --mode production",
    "start": "node server/index.mjs",
    "typecheck": "tsc --noEmit",
    "test": "node --test",
    "db:migrate": "node server/cli/migrate.mjs",
    "seed:demo": "node server/cli/seed-demo.mjs"
  },
  "dependencies": {
    "date-fns": "^2.30.0",
    "lucide-react": "^0.294.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.8.0"
  },
  "devDependencies": {
    "@babel/core": "^7.23.5",
    "@babel/preset-env": "^7.23.5",
    "@babel/preset-react": "^7.23.5",
    "@babel/preset-typescript": "^7.23.5",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "autoprefixer": "^10.4.16",
    "babel-loader": "^9.1.3",
    "css-loader": "^6.8.1",
    "html-webpack-plugin": "^5.5.3",
    "postcss": "^8.4.31",
    "postcss-loader": "^7.3.3",
    "style-loader": "^3.3.3",
    "tailwindcss": "^3.3.5",
    "typescript": "^5.3.3",
    "webpack": "^5.89.0",
    "webpack-cli": "^5.1.4",
    "webpack-dev-server": "^4.15.1"
  }
}
```

`framer-motion` and `recharts` are omitted because the current source does not import them.

- [ ] **Step 5: Regenerate the lock file from the public registry**

Run:

```bash
npm_config_registry=https://registry.npmjs.org npm install --package-lock-only
```

Expected: exit 0 and no private registry URL in `package-lock.json`.

- [ ] **Step 6: Remove runtime CDN links**

Reduce `index.html` head to local metadata and title:

```html
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="color-scheme" content="light">
<title>个人看板</title>
```

Use the existing CSS font stack with system serif fallbacks. Do not add a remote font.

- [ ] **Step 7: Harden ignored local data**

Append:

```gitignore
# Local dashboard data
data/
backups/
*.sqlite
*.sqlite3
*.sqlite-shm
*.sqlite-wal
import-map.local.json
```

- [ ] **Step 8: Run sanitization and project checks**

Run:

```bash
node --test
npm run typecheck
npm run build
rg -n -i "oneday|alibaba-inc|code\.alibaba|02vyt|career2024|salary" \
  --glob '!docs/superpowers/plans/**' \
  --glob '!docs/superpowers/specs/**' \
  --glob '!node_modules/**' \
  --glob '!package-lock.json' .
rg -n "registry\.anpm|alibaba-inc" package-lock.json
```

Expected: tests/typecheck/build PASS; both searches return no matches.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: remove legacy cloud runtime"
```

---

### Task 7: Anonymous demo seed, Docker, and operator documentation

**Files:**
- Create: `server/cli/seed-demo.mjs`
- Create: `fixtures/demo/records.json`
- Create: `fixtures/demo/tasks.json`
- Create: `Dockerfile`
- Create: `compose.yaml`
- Create: `.dockerignore`
- Create: `.nvmrc`
- Create: `.env.example`
- Create: `README.md`
- Test: `server/cli/seed-demo.test.mjs`

**Interfaces:**
- Consumes: migrations and stores from Tasks 1–2.
- Produces: `npm run seed:demo`, `docker compose up --build`, and documented direct run.

- [ ] **Step 1: Write a failing demo-seed test**

```js
// server/cli/seed-demo.test.mjs
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { openDatabase } from '../db/database.mjs';
import { applyMigrations } from '../db/migrate.mjs';
import { seedDemo } from './seed-demo.mjs';

test('loads clearly synthetic demo data without overwriting local rows', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-demo-'));
  const db = openDatabase(join(root, 'db.sqlite3'));
  applyMigrations(db, resolve('db/migrations'));
  try {
    const result = seedDemo(db, resolve('fixtures/demo'));
    assert.ok(result.records > 0);
    assert.ok(result.tasks > 0);
    assert.equal(db.prepare("SELECT count(*) AS count FROM records WHERE id LIKE 'demo:%'").get().count, result.records);
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
});
```

- [ ] **Step 2: Add anonymous fixtures and seed implementation**

All demo IDs start with `demo:`; all titles visibly include `示例` or `演示`; career fixture companies use only approved aliases; no personal paths, employers, compensation, or external links appear.

Implement:

```js
export function seedDemo(db, fixturesDir) {
  const records = JSON.parse(readFileSync(join(fixturesDir, 'records.json'), 'utf8'));
  const tasks = JSON.parse(readFileSync(join(fixturesDir, 'tasks.json'), 'utf8'));
  upsertRecords(db, records);
  upsertTasks(db, tasks);
  return { records: records.length, tasks: tasks.length };
}
```

When executed as a script, open `DATA_DIR/dashboard.sqlite3`, apply migrations, seed, print counts, and close.

- [ ] **Step 3: Add a single-service Docker image**

```dockerfile
FROM node:24.18-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run typecheck && npm test && npm run build

FROM node:24.18-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/app/data HOST=0.0.0.0 PORT=3015
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/db ./db
COPY --from=build /app/fixtures ./fixtures
EXPOSE 3015
CMD ["node", "server/index.mjs"]
```

```yaml
# compose.yaml
services:
  app:
    build: .
    ports:
      - "127.0.0.1:${DASHBOARD_PORT:-3015}:3015"
    volumes:
      - ./data:/app/data
    restart: unless-stopped
```

- [ ] **Step 4: Add Docker exclusions and version files**

`.dockerignore` excludes `.git`, `node_modules`, `dist`, `data`, `backups`, local env files, local import maps, coverage, and `docs/superpowers/plans`.

`.nvmrc` contains:

```text
24.18.0
```

`.env.example` contains:

```dotenv
DASHBOARD_PORT=3015
```

- [ ] **Step 5: Write the README around two supported paths**

Document:

1. `docker compose up --build` then `http://127.0.0.1:3015`.
2. `npm ci && npm run db:migrate && npm run dev`.
3. Empty database behavior.
4. Optional `npm run seed:demo`.
5. `data/dashboard.sqlite3` location.
6. Stop/restart commands.
7. Backup by stopping the app and copying the SQLite file plus any `-wal`/`-shm` sidecars, or by using SQLite's backup command when the app is live.
8. Self import is documented as a follow-up command after Plan 2.
9. No cloud account, credentials, or network connection is required at runtime.

- [ ] **Step 6: Verify Docker persistence**

Run:

```bash
docker compose build
docker compose up -d
curl --fail http://127.0.0.1:3015/api/health
docker compose exec app node server/cli/seed-demo.mjs
docker compose restart app
curl --fail "http://127.0.0.1:3015/api/records?domain=thought"
docker compose down
```

Expected: health returns `{"data":{"status":"ok"}}`; demo data remains after restart; `docker compose down` does not delete `./data/dashboard.sqlite3`.

- [ ] **Step 7: Run full local verification**

Run:

```bash
npm ci
npm test
npm run typecheck
npm run build
DATA_DIR=/private/tmp/my-dashboard-direct node server/cli/migrate.mjs
```

Expected: all commands PASS.

- [ ] **Step 8: Commit**

```bash
git add server/cli/seed-demo.mjs server/cli/seed-demo.test.mjs fixtures Dockerfile compose.yaml .dockerignore .nvmrc .env.example README.md
git commit -m "feat: package local dashboard for docker"
```

---

## Plan 1 Completion Gate

Before starting the Self import plan:

- `npm test`, `npm run typecheck`, and `npm run build` pass.
- Docker build and persistence checks pass.
- Fresh empty database produces honest empty states.
- Optional demo seed is visibly synthetic.
- Runtime browser requests are localhost-only.
- Current source contains no active legacy client, business mocks, compensation field, client password, or internal runtime URL.
- Git working tree is clean.
