# Independent Personal Dashboard V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the legacy generic dashboard and Self-import model with an independent local-first dashboard that implements append-only AI thoughts plus editable continuous goals, immutable progress history, and editable Eisenhower-matrix TODOs.

**Architecture:** Keep one Node process serving React and same-origin HTTP APIs, with SQLite through `node:sqlite`. Introduce the new tables and routes alongside the old runtime long enough to keep intermediate commits testable, switch all frontend consumers, then remove the entire legacy schema/import/demo surface and squash the database into a new clean `001_initial.sql`.

**Tech Stack:** Node.js `>=24.15.0`, built-in `node:sqlite`, built-in `node:test`, React 18, TypeScript 5, React Router, Tailwind CSS, Webpack, Docker Compose.

## Global Constraints

- `myDashboard` is completely independent: no Self read, import, mapping, sync, compatibility layer, or write-back.
- Final business tables are exactly `thoughts`, `goals`, `goal_progress`, and `todos`; `records`, `tasks`, and business `type` fields must not remain.
- Do not add runtime or development dependencies.
- Preserve the existing Chinese vintage visual language, five page entries, same-origin Node API, SQLite-only storage, and optional one-container Docker runtime.
- Thoughts are read-only in the browser and append-only through the local CLI; no thought update or delete path.
- Goals and TODOs are both editable in the dashboard; goal progress is append-only and immutable.
- Investment, career, and project pages are honest placeholders with no business API calls or demo data.
- Fresh startup creates an empty database; do not add seed or demo commands.
- Do not store AI source text, conversation ID, message position, turn, numeric confidence, extraction-rule version, personal SQLite data, secrets, or Self artifacts.
- Every behavior change uses RED -> GREEN TDD with real code, `skip=0`, no mocked tested object, no weakened assertion, and no direct snapshot repair.
- The verified baseline contains 92 tests. The final suite must contain at least 92 meaningful tests with `fail=0` and `skip=0`; obsolete legacy tests must be replaced by coverage of the independent model rather than merely removed.
- Each implementation task gets one implementer, one task reviewer with both spec and quality verdicts, fixes for all Critical/Important findings, and a commit before the next task.
- Preserve unrelated user changes; stage only the files named by the current task.

---

### Task 1: Add the independent SQLite schema and invariants

**Files:**
- Create: `db/migrations/002_independent_dashboard.sql`
- Modify: `server/db/migrate.test.mjs`

**Interfaces:**
- Produces tables `thoughts`, `goals`, `goal_progress`, `todos` for Tasks 2-4.
- Produces SQLite triggers `thoughts_no_update`, `thoughts_no_delete`, `goal_progress_no_update`, and `goal_progress_no_delete`.
- Keeps legacy `001_initial.sql` temporarily so unchanged routes remain runnable until Task 8.

- [ ] **Step 1: Write the failing migration tests**

Add assertions that a fresh database applies both migrations, creates all four new tables with exact columns, rejects invalid status/boolean values, makes thoughts and progress immutable, and rejects deleting a goal with progress:

```js
assert.deepEqual(applyMigrations(db, migrationsDir), [
  '001_initial.sql',
  '002_independent_dashboard.sql',
]);

const columns = db.prepare('PRAGMA table_info(todos)').all()
  .map(({ name }) => name);
assert.deepEqual(columns, [
  'id', 'title', 'status', 'is_important', 'is_urgent',
  'tags_json', 'created_at', 'completed_at',
]);

assert.throws(() => db.prepare(`
  INSERT INTO todos(id, title, status, is_important, is_urgent, created_at)
  VALUES ('bad', 'bad', 'unknown', 0, 0, '2026-08-04T00:00:00.000Z')
`).run(), /CHECK constraint failed/);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test server/db/migrate.test.mjs`

Expected: FAIL because `002_independent_dashboard.sql` and the new tables do not exist.

- [ ] **Step 3: Add the new migration**

Implement the schema with these exact business constraints:

```sql
CREATE TABLE thoughts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  tags_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags_json)),
  created_at TEXT NOT NULL
);

CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE goal_progress (
  id TEXT PRIMARY KEY,
  goal_id TEXT NOT NULL REFERENCES goals(id) ON DELETE RESTRICT,
  content TEXT NOT NULL CHECK (length(trim(content)) > 0),
  created_at TEXT NOT NULL
);

CREATE TABLE todos (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL CHECK (length(trim(title)) > 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  is_important INTEGER NOT NULL DEFAULT 0 CHECK (is_important IN (0, 1)),
  is_urgent INTEGER NOT NULL DEFAULT 0 CHECK (is_urgent IN (0, 1)),
  tags_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(tags_json)),
  created_at TEXT NOT NULL,
  completed_at TEXT
);
```

Add indexes on `thoughts(created_at DESC)`, `goals(status, updated_at DESC)`, `goal_progress(goal_id, created_at DESC)`, and `todos(status, is_important, is_urgent, created_at DESC)`. Add `BEFORE UPDATE`/`BEFORE DELETE` triggers that `RAISE(ABORT, ...)` for thoughts and goal progress.

- [ ] **Step 4: Verify GREEN and the unchanged suite**

Run: `node --test server/db/migrate.test.mjs`

Expected: PASS with both migrations applied once and all database invariant assertions green.

Run: `npm test`

Expected: all assertions pass; if sandbox networking still rejects `server.listen`, rerun the exact command with approved escalation and record both outputs.

- [ ] **Step 5: Commit**

```bash
git add db/migrations/002_independent_dashboard.sql server/db/migrate.test.mjs
git commit -m "feat: add independent dashboard schema"
```

---

### Task 2: Implement append-only thought storage and preview-first CLI

**Files:**
- Create: `server/db/thoughts.mjs`
- Create: `server/db/thoughts.test.mjs`
- Create: `server/cli/import-thought.mjs`
- Create: `server/cli/import-thought.test.mjs`
- Modify: `server/http/handler.mjs`
- Modify: `server/http/handler.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces `listThoughts(db): Thought[]` sorted newest-first.
- Produces `insertThought(db, input, now = new Date()): { thought, inserted }`.
- Produces `GET /api/thoughts`.
- Produces `npm run thought:import -- --input /absolute/path/to/thought.json [--apply]`.

- [ ] **Step 1: Write failing repository, CLI, and route tests**

Cover trimming, explicit tag normalization, deterministic same-day duplicate suppression, preview zero writes, transactional apply, unknown flags, invalid/unknown JSON fields, module import without side effects, and API response shape:

```js
const input = { title: '  标题  ', content: '  正文  ', tags: [' 明确 ', '明确'] };
const first = insertThought(db, input, new Date('2026-08-04T02:00:00.000Z'));
const second = insertThought(db, input, new Date('2026-08-04T12:00:00.000Z'));
assert.equal(first.inserted, true);
assert.equal(second.inserted, false);
assert.deepEqual(first.thought.tags, ['明确']);
```

CLI preview must print validated `title`, `content`, and `tags`, report `mode: "preview"`, and leave `thoughts` empty. `--apply` must print `mode: "apply"` and persist exactly one row.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test server/db/thoughts.test.mjs server/cli/import-thought.test.mjs server/http/handler.test.mjs`

Expected: FAIL with missing thought modules, command, and route.

- [ ] **Step 3: Implement thought persistence and validation**

Use a content-derived ID without storing conversation metadata:

```js
function thoughtId({ title, content }, now) {
  const localDay = [now.getFullYear(), now.getMonth() + 1, now.getDate()]
    .map((part, index) => index === 0 ? String(part) : String(part).padStart(2, '0'))
    .join('-');
  const digest = createHash('sha256')
    .update(`${title.trim()}\0${content.trim()}`)
    .digest('hex');
  return `thought:${localDay}:${digest}`;
}
```

Normalize tags by trimming, dropping empty strings, preserving first occurrence order, and rejecting non-string entries. Store timestamps as `new Date().toISOString()`.

- [ ] **Step 4: Implement the preview-first CLI and GET route**

Parse only `--input <absolute-path>` and optional `--apply`. Reject relative paths and unknown keys. Importing the CLI module must not open a database. On apply, run `BEGIN IMMEDIATE`, call `insertThought`, and commit or roll back.

Add:

```json
"thought:import": "node server/cli/import-thought.mjs"
```

Add `GET /api/thoughts` to the handler without adding POST/PATCH/DELETE thought routes.

- [ ] **Step 5: Verify GREEN**

Run: `node --test server/db/thoughts.test.mjs server/cli/import-thought.test.mjs server/http/handler.test.mjs`

Expected: all focused tests pass; preview count remains zero and duplicate apply returns the existing row without adding a second row.

Run: `npm test`

Expected: full suite green under an environment allowed to bind the test server; `skip=0`.

- [ ] **Step 6: Commit**

```bash
git add server/db/thoughts.mjs server/db/thoughts.test.mjs server/cli/import-thought.mjs server/cli/import-thought.test.mjs server/http/handler.mjs server/http/handler.test.mjs package.json
git commit -m "feat: add append-only thought ingestion"
```

---

### Task 3: Implement continuous goals and immutable progress APIs

**Files:**
- Create: `server/db/goals.mjs`
- Create: `server/db/goals.test.mjs`
- Modify: `server/http/handler.mjs`
- Modify: `server/http/handler.test.mjs`

**Interfaces:**
- Produces `listGoals`, `createGoal`, `updateGoal`, `deleteGoal`, and `appendGoalProgress`.
- `listGoals` returns each goal with `progress: GoalProgress[]` newest-first.
- Produces `GET/POST /api/goals`, `PATCH/DELETE /api/goals/:id`, and `POST /api/goals/:id/progress`.

- [ ] **Step 1: Write failing goal repository tests**

Test defaults, all four states, partial title/description/status patches, unknown patch keys, append ordering, immutable progress, deletion without progress, and `409`-worthy deletion conflict with progress:

```js
const goal = createGoal(db, { title: '持续目标', description: '说明' }, now);
assert.equal(goal.status, 'active');
const progress = appendGoalProgress(db, goal.id, { content: '第一条进展' }, later);
assert.equal(progress.content, '第一条进展');
assert.throws(() => deleteGoal(db, goal.id), (error) => error.status === 409);
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test server/db/goals.test.mjs server/http/handler.test.mjs`

Expected: FAIL because the goals repository and routes do not exist.

- [ ] **Step 3: Implement minimal repository operations**

Return camelCase objects:

```js
{
  id, title, description, status,
  createdAt, updatedAt,
  progress: [{ id, goalId, content, createdAt }],
}
```

Only accept `title`, `description`, and `status` in goal patches. Use transactions for create/update/delete/append. Convert foreign-key deletion conflict into an error with `status = 409` and message `已有进展的目标不能删除`.

- [ ] **Step 4: Add HTTP routes and strict body validation**

Return `201` for create/append, `200` for list/update/delete, `404` for missing goals, `400` for invalid bodies, and `409` for deletion conflicts. Do not expose progress PATCH or DELETE routes.

- [ ] **Step 5: Verify GREEN**

Run: `node --test server/db/goals.test.mjs server/http/handler.test.mjs`

Expected: focused tests pass, including direct SQLite rejection of progress mutation.

Run: `npm test`

Expected: full suite green in an allowed network sandbox; `skip=0`.

- [ ] **Step 6: Commit**

```bash
git add server/db/goals.mjs server/db/goals.test.mjs server/http/handler.mjs server/http/handler.test.mjs
git commit -m "feat: add continuous goals and progress"
```

---

### Task 4: Implement editable Eisenhower TODO APIs

**Files:**
- Create: `server/db/todos.mjs`
- Create: `server/db/todos.test.mjs`
- Modify: `server/http/handler.mjs`
- Modify: `server/http/handler.test.mjs`

**Interfaces:**
- Produces `listTodos`, `createTodo`, `updateTodo`, and `deleteTodo`.
- Produces `GET/POST /api/todos` and `PATCH/DELETE /api/todos/:id`.
- TODO shape: `{ id, title, status, isImportant, isUrgent, tags, createdAt, completedAt }`.

- [ ] **Step 1: Write failing TODO repository and route tests**

Test default pending/false/false values, all states, free-tag normalization, title and quadrant edits, completed timestamp creation, completed timestamp clearing on reopen/cancel, deletion, missing IDs, unknown keys, and invalid booleans:

```js
const created = createTodo(db, {
  title: '本地事项',
  isImportant: true,
  isUrgent: false,
  tags: [' 工作 ', '工作', '学习'],
}, now);
assert.deepEqual(created.tags, ['工作', '学习']);
const done = updateTodo(db, created.id, { status: 'completed' }, later);
assert.equal(done.completedAt, later.toISOString());
const reopened = updateTodo(db, created.id, { status: 'pending' }, latest);
assert.equal(reopened.completedAt, null);
```

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test server/db/todos.test.mjs server/http/handler.test.mjs`

Expected: FAIL because TODO repository and routes do not exist.

- [ ] **Step 3: Implement TODO persistence**

Allow only `title`, `status`, `isImportant`, `isUrgent`, and `tags`. Reject unknown keys. Use `randomUUID()` for IDs, system timestamps, integer encoding for SQLite booleans, JSON encoding for normalized tags, and one transaction per mutation.

- [ ] **Step 4: Add TODO routes**

Create returns `201`; update/delete return `200`; list returns newest-first; missing IDs return `404`; malformed input returns `400`. DELETE removes exactly the decoded ID and returns the deleted object so the client can reconcile.

- [ ] **Step 5: Verify GREEN**

Run: `node --test server/db/todos.test.mjs server/http/handler.test.mjs`

Expected: all focused TODO and HTTP tests pass.

Run: `npm test`

Expected: full suite green in an allowed network sandbox; `skip=0`.

- [ ] **Step 6: Commit**

```bash
git add server/db/todos.mjs server/db/todos.test.mjs server/http/handler.mjs server/http/handler.test.mjs
git commit -m "feat: add editable eisenhower todos"
```

---

### Task 5: Add typed frontend clients and hooks for the new model

**Files:**
- Modify: `src/api/types.ts`
- Modify: `src/api/client.ts`
- Create: `src/hooks/useThoughts.ts`
- Create: `src/hooks/useGoals.ts`
- Create: `src/hooks/useTodos.ts`
- Create: `tests/frontend/new-model-contract.test.mjs`

**Interfaces:**
- Produces `ThoughtItem`, `GoalItem`, `GoalProgressItem`, `TodoItem`, `GoalStatus`, and `TodoStatus`.
- Produces API client functions matching the Task 2-4 routes.
- Produces hooks consumed by Tasks 6-7 while legacy exports remain temporarily for unchanged pages.

- [ ] **Step 1: Write failing TypeScript contract tests**

Transpile `src/api/client.ts` with the installed TypeScript package and a controlled `fetch` implementation. Assert exact paths, methods, encoded IDs, response validation, and rejection of invalid status/booleans/tags/dates. Assert source contracts do not define a new thought mutation:

```js
assert.doesNotMatch(clientSource, /createThought|updateThought|deleteThought/);
assert.match(clientSource, /export function listThoughts/);
assert.match(clientSource, /export function appendGoalProgress/);
assert.match(clientSource, /export function deleteTodo/);
```

- [ ] **Step 2: Run the contract test and verify RED**

Run: `node --test tests/frontend/new-model-contract.test.mjs`

Expected: FAIL because the new types, functions, and hooks are missing.

- [ ] **Step 3: Add exact frontend types and client functions**

Define:

```ts
export type GoalStatus = 'active' | 'paused' | 'completed' | 'abandoned';
export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface ThoughtItem {
  id: string; title: string; content: string; tags: string[]; createdAt: string;
}
export interface GoalProgressItem {
  id: string; goalId: string; content: string; createdAt: string;
}
export interface GoalItem {
  id: string; title: string; description: string; status: GoalStatus;
  createdAt: string; updatedAt: string; progress: GoalProgressItem[];
}
export interface TodoItem {
  id: string; title: string; status: TodoStatus;
  isImportant: boolean; isUrgent: boolean; tags: string[];
  createdAt: string; completedAt: string | null;
}
```

Add strict parsers and exact CRUD calls. Preserve the existing safe `request()` error envelope.

- [ ] **Step 4: Implement hooks with post-mutation refresh**

- `useThoughts()` loads only and exposes `{ data, loading, error }`.
- `useGoals()` exposes load, create, update, remove, and appendProgress.
- `useTodos()` exposes load, create, update, and remove.

Reuse the existing mounted/generation/mutation-lock pattern so stale requests cannot overwrite current data and concurrent mutations return a visible error.

- [ ] **Step 5: Verify GREEN**

Run: `node --test tests/frontend/new-model-contract.test.mjs`

Expected: contract tests pass with exact routes and no thought mutation export.

Run: `npm run typecheck`

Expected: PASS while legacy types remain temporarily available.

Run: `npm test`

Expected: full suite green in an allowed network sandbox.

- [ ] **Step 6: Commit**

```bash
git add src/api/types.ts src/api/client.ts src/hooks/useThoughts.ts src/hooks/useGoals.ts src/hooks/useTodos.ts tests/frontend/new-model-contract.test.mjs
git commit -m "feat: add independent dashboard client model"
```

---

### Task 6: Build the home, thoughts, and placeholder pages

**Files:**
- Modify: `src/pages/Home.tsx`
- Modify: `src/pages/Thoughts.tsx`
- Modify: `src/pages/Investment.tsx`
- Modify: `src/pages/Career.tsx`
- Modify: `src/pages/Projects.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/layout/Sidebar.tsx`
- Create: `src/components/common/ComingSoon.tsx`
- Create: `tests/frontend/read-only-pages-contract.test.mjs`

**Interfaces:**
- Consumes `useThoughts`, `useGoals`, and `useTodos`.
- Produces the approved lightweight home overview, read-only thought cards, and three honest placeholders.

- [ ] **Step 1: Write failing page contract tests**

Assert the home reads all three new hooks, the thought page has search/tag filtering but no fixed categories or mutation controls, and placeholders import no record hook/client:

```js
assert.match(home, /useThoughts\(\)/);
assert.match(home, /useGoals\(\)/);
assert.match(home, /useTodos\(\)/);
assert.doesNotMatch(thoughts, /categories|record\.type|useRecords/);
for (const source of [investment, career, projects]) {
  assert.match(source, /ComingSoon/);
  assert.doesNotMatch(source, /useRecords|listRecords|useEffect/);
}
```

- [ ] **Step 2: Run the page test and verify RED**

Run: `node --test tests/frontend/read-only-pages-contract.test.mjs`

Expected: FAIL because pages still use the legacy record model.

- [ ] **Step 3: Implement the home overview**

Show:

- latest thought or honest empty state;
- count of `active` goals plus newest progress across goals;
- important-and-urgent unfinished count plus total `pending`/`in_progress` count;
- five module cards, marking investment/career/project `待设计`.

Do not add an overview table or endpoint; derive from loaded hook data.

- [ ] **Step 4: Implement read-only thoughts and placeholders**

Thoughts show title, content, explicit tags, and `createdAt`; search title/content client-side; tag filter uses only tags present in loaded data. Keep the existing vintage Card/Modal language and remove category stamps. `ComingSoon` renders one shared vintage empty-state component for the three unimplemented modules.

- [ ] **Step 5: Verify GREEN**

Run: `node --test tests/frontend/read-only-pages-contract.test.mjs`

Expected: page contracts pass and placeholders have no business data imports.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: PASS; existing webpack size warnings may remain but no new compile error or warning category is allowed.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Home.tsx src/pages/Thoughts.tsx src/pages/Investment.tsx src/pages/Career.tsx src/pages/Projects.tsx src/App.tsx src/components/layout/Sidebar.tsx src/components/common/ComingSoon.tsx tests/frontend/read-only-pages-contract.test.mjs
git commit -m "feat: add independent dashboard overview"
```

---

### Task 7: Build editable goals and TODO four-quadrant planning UI

**Files:**
- Modify: `src/pages/Todos.tsx`
- Modify: `src/components/todos/GoalsList.tsx`
- Modify: `src/components/todos/TodoList.tsx`
- Create: `src/components/todos/GoalForm.tsx`
- Create: `src/components/todos/GoalProgressForm.tsx`
- Create: `src/components/todos/TodoForm.tsx`
- Create: `tests/frontend/planning-pages-contract.test.mjs`

**Interfaces:**
- Consumes `useGoals()` and `useTodos()`.
- Produces two tabs named `持续目标` and `TODO 四象限` under `/todos`.

- [ ] **Step 1: Write failing planning-page contract tests**

Assert both tabs, all goal statuses, progress append without progress mutation, four TODO quadrants, all TODO states, editable free tags, and confirmation before delete:

```js
assert.match(todosPage, /持续目标/);
assert.match(todosPage, /TODO 四象限/);
assert.match(goalList, /appendProgress/);
assert.doesNotMatch(goalList, /updateProgress|deleteProgress/);
assert.match(todoList, /isImportant/);
assert.match(todoList, /isUrgent/);
assert.match(todoList, /window\.confirm/);
```

- [ ] **Step 2: Run the planning test and verify RED**

Run: `node --test tests/frontend/planning-pages-contract.test.mjs`

Expected: FAIL because existing UI uses year/month goals and a flat legacy task list.

- [ ] **Step 3: Implement continuous goals UI**

Support create/edit/status/delete, show statuses in Chinese, append immutable progress, display progress newest-first, hide delete when progress exists, and still handle server conflict errors. Goal forms edit only title, description, and status.

- [ ] **Step 4: Implement TODO four-quadrant UI**

Render exact quadrants:

```ts
const quadrants = [
  { key: 'important-urgent', label: '重要且紧急', isImportant: true, isUrgent: true },
  { key: 'important-not-urgent', label: '重要不紧急', isImportant: true, isUrgent: false },
  { key: 'not-important-urgent', label: '紧急不重要', isImportant: false, isUrgent: true },
  { key: 'not-important-not-urgent', label: '不重要不紧急', isImportant: false, isUrgent: false },
];
```

Create/edit title, status, the two booleans, and comma-separated free tags. Complete/reopen/cancel controls use the API. Delete only after `window.confirm('确认删除这条 TODO？')`.

- [ ] **Step 5: Verify GREEN**

Run: `node --test tests/frontend/planning-pages-contract.test.mjs`

Expected: planning contracts pass with no target date, goal period, KR, description, or goal relation in TODO forms.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: PASS with no new warning category.

- [ ] **Step 6: Commit**

```bash
git add src/pages/Todos.tsx src/components/todos/GoalsList.tsx src/components/todos/TodoList.tsx src/components/todos/GoalForm.tsx src/components/todos/GoalProgressForm.tsx src/components/todos/TodoForm.tsx tests/frontend/planning-pages-contract.test.mjs
git commit -m "feat: add editable planning workspace"
```

---

### Task 8: Remove every legacy data model, Self, demo, and migration artifact

**Files:**
- Replace: `db/migrations/001_initial.sql`
- Delete: `db/migrations/002_independent_dashboard.sql`
- Delete: `server/db/records.mjs`
- Delete: `server/db/records.test.mjs`
- Delete: `server/db/tasks.mjs`
- Delete: `server/db/tasks.test.mjs`
- Delete: `server/cli/seed-demo.mjs`
- Delete: `server/cli/seed-demo.test.mjs`
- Delete: `server/cli/import-self.mjs`
- Delete: `server/cli/import-self.test.mjs`
- Delete: `server/import-self/load-indexes.mjs`
- Delete: `server/import-self/load-indexes.test.mjs`
- Delete: `server/import-self/privacy.mjs`
- Delete: `server/import-self/privacy.test.mjs`
- Delete: `server/import-self/import.mjs`
- Delete: `server/import-self/import.test.mjs`
- Delete: `server/import-self/map-indexes.mjs`
- Delete: `server/import-self/map-indexes.test.mjs`
- Delete: `src/hooks/useRecords.ts`
- Delete: `src/hooks/useTasks.ts`
- Delete: `src/components/investment/KnowledgeList.tsx`
- Delete: `src/components/investment/ReviewTimeline.tsx`
- Delete: `fixtures/demo/records.json`
- Delete: `fixtures/demo/tasks.json`
- Delete: `fixtures/self-index/90_输出/语义索引/cards.local.json`
- Delete: `fixtures/self-index/90_输出/语义索引/topics.local.json`
- Delete: `fixtures/self-index/90_输出/语义索引/projects.local.json`
- Delete: `config/import-map.example.json`
- Delete: `scripts/migration/frontend-record-contract.test.mjs`
- Delete: `scripts/migration/frontend-task-contract.test.mjs`
- Delete: `scripts/migration/runtime-sanitization.test.mjs`
- Delete: `scripts/migration/export-clean-snapshot.mjs`
- Delete: `scripts/migration/export-clean-snapshot.test.mjs`
- Delete: `scripts/migration/scan-sensitive.mjs`
- Delete: `scripts/migration/scan-sensitive.test.mjs`
- Delete: `docs/superpowers/plans/2026-07-30-clean-github-publication.md`
- Delete: `docs/superpowers/plans/2026-07-30-local-sqlite-runtime.md`
- Delete: `docs/superpowers/plans/2026-07-30-self-vault-one-time-import.md`
- Delete: `docs/superpowers/specs/2026-07-30-local-sqlite-github-migration-design.md`
- Modify: `server/http/handler.mjs`
- Modify: `server/http/handler.test.mjs`
- Modify: `src/api/types.ts`
- Modify: `src/api/client.ts`
- Modify: `package.json`
- Modify: `Dockerfile`
- Modify: `.gitignore`
- Create: `tests/repository-boundary.test.mjs`

**Interfaces:**
- Final migration set contains only the new `001_initial.sql`.
- Final runtime exposes only health, thought read, goal/progress CRUD, TODO CRUD, and static files.
- Final source tree contains no legacy data/import/demo implementation.

- [ ] **Step 1: Write failing repository-boundary and clean-migration tests**

Assert tracked/source paths do not contain the deleted directories and runtime text does not expose legacy routes or scripts:

```js
const forbiddenPaths = [
  'server/import-self/',
  'fixtures/demo/',
  'fixtures/self-index/',
  'config/import-map.example.json',
];
for (const path of trackedPaths) {
  assert.equal(forbiddenPaths.some((prefix) => path.startsWith(prefix)), false, path);
}
assert.doesNotMatch(runtimeSource, /api\/records|api\/tasks|import:self|seed:demo/);
```

Also assemble the forbidden UI/content terms from string fragments in the test (so the repository scan does not contain the literal itself) and assert zero matches for the removed hotspot-news surface, compensation fields, and password/lock controls. Scan both tracked paths and text source; do not reduce the scan when a match is found.

Update migration tests to expect only `001_initial.sql` and exactly the five tables `schema_migrations`, `thoughts`, `goals`, `goal_progress`, and `todos`.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `node --test tests/repository-boundary.test.mjs server/db/migrate.test.mjs`

Expected: FAIL with legacy paths, scripts, routes, and two migrations present.

- [ ] **Step 3: Remove obsolete files and legacy exports**

Delete only the files listed in this task. Remove old route branches and legacy TypeScript exports after all pages use the new hooks. Remove `import:self` and `seed:demo` scripts. Do not delete the current independent design or plan.

- [ ] **Step 4: Collapse the database to the new initial migration**

Replace `001_initial.sql` with the final contents from Task 1's independent migration and delete `002_independent_dashboard.sql`. Preserve every constraint, index, and immutability trigger from Task 1.

- [ ] **Step 5: Finalize packaging boundaries**

Remove `config` and `fixtures` copies from Docker. Add `.superpowers/` to `.gitignore` so local visual/SDD artifacts cannot enter the release tree. Keep `data/`, backups, SQLite/WAL/SHM, env, and key ignores.

- [ ] **Step 6: Verify GREEN**

Run: `node --test tests/repository-boundary.test.mjs server/db/migrate.test.mjs`

Expected: clean migration and boundary tests pass with zero legacy path or runtime-route matches.

Run: `npm test`

Expected: at least 92 meaningful retained/new tests pass with `fail=0`, `skip=0` in an allowed network sandbox. Deleted legacy-feature tests are replaced by equivalent or stronger coverage of the independent model.

Run: `npm run typecheck`

Expected: PASS with no legacy type imports.

Run: `npm run build`

Expected: PASS with no new warning category.

- [ ] **Step 7: Commit**

Stage the exact Task 8 file set and inspect `git diff --cached --name-status` before committing.

```bash
git commit -m "refactor: remove legacy dashboard model"
```

---

### Task 9: Document and verify fresh local and Docker startup

**Files:**
- Modify: `README.md`
- Modify: `compose.yaml`
- Modify: `Dockerfile`
- Modify: `server/index.mjs`
- Create: `tests/fresh-start.test.mjs`

**Interfaces:**
- Produces the documented `npm ci && npm test && npm run typecheck && npm run build && npm start` workflow.
- Produces the documented `docker compose up --build` workflow with `./data:/app/data`.

- [ ] **Step 1: Write the failing fresh-start test**

Spawn the server against a new temporary `DATA_DIR`, poll `/api/health`, verify all four business tables are empty through their APIs, stop, restart against the same directory, and verify they remain empty. Assert package scripts contain `thought:import` but no demo/Self command.

```js
assert.deepEqual(await get('/api/thoughts'), []);
assert.deepEqual(await get('/api/goals'), []);
assert.deepEqual(await get('/api/todos'), []);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/fresh-start.test.mjs`

Expected: FAIL until startup, routes, or package/docs contracts match the independent project.

- [ ] **Step 3: Update runtime packaging and README**

README must contain:

- prerequisites Node `>=24.15.0` or Docker;
- local install/build/start commands;
- Docker one-container command and host-mounted data explanation;
- empty first-run behavior;
- thought JSON example and preview/apply commands;
- goals/TODO edit behavior;
- placeholder-module statement;
- explicit statement that Self, cloud accounts, external databases, demo data, and personal data are absent.

Docker runtime copies only `dist`, `server`, and `db`. Health check uses `/api/health`. `server/index.mjs` must run migrations before listening.

- [ ] **Step 4: Verify GREEN**

Run: `node --test tests/fresh-start.test.mjs`

Expected: PASS with two starts on one empty temporary SQLite directory.

Run: `npm test`

Expected: `fail=0`, `skip=0` in an allowed network sandbox.

Run: `npm run typecheck`

Expected: PASS.

Run: `npm run build`

Expected: PASS with no new warning category.

Run: `docker compose build`

Expected: image build succeeds, including tests/typecheck/build in the build stage.

Run: `docker compose up -d`, then poll the configured host port `/api/health`, restart the container, and recheck health.

Expected: one app container is healthy and `./data/dashboard.sqlite3` remains on the host.

- [ ] **Step 5: Commit**

```bash
git add README.md compose.yaml Dockerfile server/index.mjs tests/fresh-start.test.mjs
git commit -m "docs: make independent dashboard portable"
```

---

### Task 10: Create and verify a clean one-root local release snapshot

**Files:**
- No source-tree changes.
- Create temporary release repository under `/private/tmp/my-dashboard-v1-clean-<timestamp>`.
- Create temporary acceptance clone under `/private/tmp/my-dashboard-v1-clone-<timestamp>`.

**Interfaces:**
- Produces a local `main` repository with exactly one root commit and no old Git history.
- Does not push or modify any existing remote.

- [ ] **Step 1: Verify the implementation branch before export**

Run:

```bash
git status --short
npm test
npm run typecheck
npm run build
```

Expected: only ignored local data/SDD artifacts are absent from status; tests/typecheck/build pass.

- [ ] **Step 2: Export the committed tree without `.git` or local data**

Use `git archive --format=tar --output <archive> HEAD`, extract into a newly created empty temporary directory, and verify no `.git`, `data`, SQLite, Self, import-map, fixture/demo, or `.superpowers` artifact exists.

- [ ] **Step 3: Create one anonymous root commit**

Initialize Git with branch `main`, stage the exported tree, and commit with command-local identity:

```bash
git -c user.name='Dashboard Maintainer' \
  -c user.email='dashboard@example.invalid' \
  commit -m 'Initial independent dashboard'
```

Verify:

```bash
git rev-list --all --count
git remote -v
```

Expected: count `1`; no remotes.

- [ ] **Step 4: Clone and run full acceptance**

Clone the temporary release repository into a second new directory and run:

```bash
npm ci
npm test
npm run typecheck
npm run build
```

Start against a fresh data directory, verify health and empty APIs, then stop cleanly. If Docker is available, build and health-check the clone with one app container.

- [ ] **Step 5: Record evidence without publishing**

Append the release path, clone path, root commit SHA, test counts, typecheck/build output summary, Docker result, and zero-match tree scans to `.superpowers/sdd/progress.md`. Do not create or push a GitHub repository in this task.

---

## Final Review and Completion Gate

After Tasks 1-10:

1. Generate a review package from commit `7a2690e` to final implementation HEAD.
2. Dispatch one independent whole-branch reviewer against the approved design and this plan.
3. Send all Critical/Important findings to one fix subagent, rerun covering tests, and re-review.
4. Re-run fresh-clone acceptance and the clean one-root snapshot checks after fixes.
5. Report actual RED/GREEN outputs, commit range, current worktree status, local release location, and every unmet item. Do not claim GitHub publication unless a new remote is actually created and pushed later with explicit authorization.
