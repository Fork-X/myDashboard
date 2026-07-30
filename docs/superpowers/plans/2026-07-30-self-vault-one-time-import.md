# Self Vault One-Time Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import selected Self Vault semantic cards and projects into the local SQLite database once, with deterministic IDs, privacy validation, preview-by-default behavior, and no runtime dependency on Self.

**Architecture:** One CLI reads only three generated Self files, validates version 3, applies one local Git-ignored mapping file, converts accepted items directly into the existing `records` and `tasks` contracts, then upserts them in one transaction when `--apply` is present. The web application continues to read only SQLite.

**Tech Stack:** Node.js 24, built-in `node:fs`, `node:path`, `node:crypto`, `node:test`, and the SQLite stores completed in Plan 1.

## Global Constraints

- Read only:
  - `90_输出/语义索引/cards.local.json`
  - `90_输出/语义索引/topics.local.json`
  - `90_输出/语义索引/projects.local.json`
- Never read `career-compensation.local.json`, raw Vault Markdown, or derived output prose.
- The default command is a dry-run preview. Only `--apply` may change SQLite.
- The command never writes to Self Vault.
- The importer is not loaded by the HTTP server and does not run at application startup.
- SQLite remains the only runtime source of truth after import.
- The local mapping file is ignored by Git; only a synthetic example is committed.
- Career output may contain only `A公司`, `Y公司`, or `H公司`.
- Compensation text is rejected before persistence, not hidden only in the UI.
- Persisted `source_ref` values are Vault-relative POSIX paths; absolute paths and `..` segments are rejected.
- Import errors must not echo raw sensitive content or absolute local paths.

---

## Target File Map

- Create `server/import-self/load-indexes.mjs`: read and validate the three allowed index files.
- Create `server/import-self/privacy.mjs`: redaction, compensation checks, and safe source references.
- Create `server/import-self/map-indexes.mjs`: semantic-card/project to record/task conversion.
- Create `server/import-self/import.mjs`: preview and transactional apply orchestration.
- Create `server/cli/import-self.mjs`: argument parsing and operator-facing JSON summary.
- Create `fixtures/self-index/`: entirely synthetic version-3 index fixtures.
- Create `config/import-map.example.json`: safe documented mapping shape.
- Modify `package.json`: add `import:self`.
- Modify `.gitignore`: ignore `import-map.local.json`.
- Modify `Dockerfile`: include the importer and example configuration.
- Modify `README.md`: document direct and Docker import flows.

---

### Task 1: Load only the supported Self semantic indexes

**Files:**
- Create: `server/import-self/load-indexes.mjs`
- Create: `server/import-self/load-indexes.test.mjs`
- Create: `fixtures/self-index/90_输出/语义索引/cards.local.json`
- Create: `fixtures/self-index/90_输出/语义索引/topics.local.json`
- Create: `fixtures/self-index/90_输出/语义索引/projects.local.json`

**Interfaces:**
- Produces: `loadSelfIndexes(vaultRoot): Promise<{ version, generatedAt, cards, topics, projects }>`
- The result deliberately has no `careerCompensation` property.

- [ ] **Step 1: Add minimal synthetic version-3 fixtures**

Use opaque IDs and obviously synthetic Chinese text. The cards fixture contains:

```json
{
  "version": 3,
  "generatedAt": "2026-01-01T00:00:00.000Z",
  "cards": [
    {
      "id": "card-investment-1",
      "topicIds": ["topic-investment"],
      "projectIds": [],
      "type": "knowledge",
      "title": "示例资产配置原则",
      "summary": "示例内容，仅用于导入测试。",
      "entities": [],
      "date": "2026-01-01",
      "status": "active",
      "lastReviewedAt": "2026-01-01",
      "evidence": [],
      "nextActions": ["复核示例配置"],
      "links": [],
      "sources": [
        {
          "file": "30_知识/示例资产.md",
          "heading": "配置",
          "quote": "不应被导入数据库的原始引文"
        }
      ]
    }
  ]
}
```

The topics fixture contains `topic-investment`; the projects fixture contains one anonymous project with `sourceFile: "40_项目/示例项目.md"`. Do not create a compensation-index fixture.

- [ ] **Step 2: Write the failing loader tests**

```js
// server/import-self/load-indexes.test.mjs
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import test from 'node:test';
import { loadSelfIndexes } from './load-indexes.mjs';

test('loads only cards, topics, and projects from a v3 index', async () => {
  const result = await loadSelfIndexes(resolve('fixtures/self-index'));
  assert.equal(result.version, 3);
  assert.equal(result.cards.length, 1);
  assert.equal(result.topics.length, 1);
  assert.equal(result.projects.length, 1);
});

test('rejects unsupported index versions', async () => {
  await assert.rejects(
    () => loadSelfIndexes(resolve('fixtures/self-index-v2')),
    /Self semantic index version 3 is required/,
  );
});
```

Create a second tiny fixture directory whose `cards.local.json` has `"version": 2`.

- [ ] **Step 3: Run the loader test and verify the missing-module failure**

Run:

```bash
node --test server/import-self/load-indexes.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `load-indexes.mjs`.

- [ ] **Step 4: Implement the strict loader**

```js
// server/import-self/load-indexes.mjs
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const INDEX_ROOT = join('90_输出', '语义索引');

async function readJson(vaultRoot, filename) {
  return JSON.parse(await readFile(join(vaultRoot, INDEX_ROOT, filename), 'utf8'));
}

function requireArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  return value;
}

export async function loadSelfIndexes(vaultRoot) {
  const [cardsIndex, topicsIndex, projectsIndex] = await Promise.all([
    readJson(vaultRoot, 'cards.local.json'),
    readJson(vaultRoot, 'topics.local.json'),
    readJson(vaultRoot, 'projects.local.json'),
  ]);
  if (cardsIndex.version !== 3) {
    throw new Error('Self semantic index version 3 is required');
  }
  if (topicsIndex.version !== 3 || projectsIndex.version !== 3) {
    throw new Error('All Self semantic indexes must use version 3');
  }
  return {
    version: 3,
    generatedAt: cardsIndex.generatedAt ?? null,
    cards: requireArray(cardsIndex.cards, 'cards'),
    topics: requireArray(topicsIndex.topics, 'topics'),
    projects: requireArray(projectsIndex.projects, 'projects'),
  };
}
```

- [ ] **Step 5: Run the loader tests**

Run:

```bash
node --test server/import-self/load-indexes.test.mjs
```

Expected: both tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/import-self/load-indexes.mjs server/import-self/load-indexes.test.mjs fixtures/self-index fixtures/self-index-v2
git commit -m "feat: load supported self semantic indexes"
```

---

### Task 2: Define a small, local-only mapping and privacy boundary

**Files:**
- Create: `server/import-self/privacy.mjs`
- Create: `server/import-self/privacy.test.mjs`
- Create: `config/import-map.example.json`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `loadImportMap(filename?)`
- Produces: `redactText(text, map)`
- Produces: `normalizeSourceRef(value)`
- Produces: `validatePersistable(value, map)`
- Consumers must treat any thrown privacy error as an item rejection.

- [ ] **Step 1: Commit only the synthetic mapping example**

```json
{
  "topicDomains": {
    "topic-investment": "investment",
    "topic-thought": "thought",
    "topic-career": "career"
  },
  "goalTopics": {
    "topic-year-goal": "year",
    "topic-month-goal": "month"
  },
  "careerAliases": {
    "示例来源公司一": "A公司",
    "示例来源公司二": "Y公司",
    "示例来源公司三": "H公司"
  },
  "redactions": {
    "示例真实姓名": "匿名用户"
  },
  "blockedTerms": [
    "示例禁止发布词"
  ]
}
```

Append `import-map.local.json` to `.gitignore`. The actual file may contain private source labels and names; it must never be staged.

- [ ] **Step 2: Write failing privacy tests**

```js
// server/import-self/privacy.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  loadImportMap,
  normalizeSourceRef,
  redactText,
  validatePersistable,
} from './privacy.mjs';

const map = {
  careerAliases: { '示例来源公司一': 'A公司' },
  redactions: { '示例真实姓名': '匿名用户' },
  blockedTerms: ['示例禁止发布词'],
};

test('redacts aliases and names before persistence', () => {
  assert.equal(
    redactText('示例真实姓名曾在示例来源公司一任职', map),
    '匿名用户曾在A公司任职',
  );
});

test('keeps only relative POSIX source references', () => {
  assert.equal(normalizeSourceRef('30_知识\\示例.md'), '30_知识/示例.md');
  assert.throws(() => normalizeSourceRef('/Users/example/private.md'), /relative/);
  assert.throws(() => normalizeSourceRef('../private.md'), /relative/);
});

test('rejects compensation and configured blocked terms', () => {
  assert.throws(() => validatePersistable({ content: '年薪信息' }, map), /compensation/);
  assert.throws(
    () => validatePersistable({ content: '示例禁止发布词' }, map),
    /blocked term/,
  );
});

test('loads an empty map by default and validates configured domains', async () => {
  assert.deepEqual(await loadImportMap(), {
    topicDomains: {},
    goalTopics: {},
    careerAliases: {},
    redactions: {},
    blockedTerms: [],
  });
  await assert.rejects(
    () => loadImportMap('fixtures/invalid-import-map.json'),
    /topicDomains values must be investment, thought, or career/,
  );
});
```

Add `fixtures/invalid-import-map.json` containing a synthetic invalid domain.

- [ ] **Step 3: Run the tests and verify the missing-module failure**

Run:

```bash
node --test server/import-self/privacy.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 4: Implement deterministic redaction and validation**

Use these fixed rules:

```js
const ALLOWED_ALIASES = new Set(['A公司', 'Y公司', 'H公司']);
const COMPENSATION_PATTERN =
  /薪资|薪酬|工资|年薪|月薪|总包|奖金|股权|salary|compensation|base pay|bonus|RSU|[¥￥]/i;
```

`redactText` must:

1. coerce null/undefined to an empty string;
2. merge `careerAliases` and `redactions`;
3. verify every career-alias target is in `ALLOWED_ALIASES`;
4. replace source strings longest-first so a shorter key cannot partially consume a longer key.

`normalizeSourceRef` must:

1. convert backslashes to `/`;
2. reject empty, absolute, drive-letter, URL, and `..` values;
3. return the normalized relative value without prefixing the Vault root.

`validatePersistable` serializes the already-redacted candidate and rejects the compensation pattern or any non-empty configured blocked term. Error messages contain only the rule name, never the matching source text.

`loadImportMap` returns empty objects/arrays when no filename is supplied. When a file is supplied, parse JSON and require:

- `topicDomains` values in `investment`, `thought`, or `career`;
- `goalTopics` values in `year` or `month`;
- `careerAliases` values in `A公司`, `Y公司`, or `H公司`;
- string-to-string `redactions`;
- a string-array `blockedTerms`.

Unknown top-level keys fail validation so a misspelling cannot silently weaken the import.

- [ ] **Step 5: Run privacy tests**

Run:

```bash
node --test server/import-self/privacy.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/import-self/privacy.mjs server/import-self/privacy.test.mjs config/import-map.example.json fixtures/invalid-import-map.json .gitignore
git commit -m "feat: enforce self import privacy boundary"
```

---

### Task 3: Map cards and projects directly to existing records and tasks

**Files:**
- Create: `server/import-self/map-indexes.mjs`
- Create: `server/import-self/map-indexes.test.mjs`

**Interfaces:**
- Consumes: `{ cards, topics, projects }` from Task 1 and the local mapping from Task 2.
- Produces: `mapSelfIndexes(indexes, map): { records, tasks, rejected, skipped }`.
- `rejected` contains `{ sourceId, reason }` only; no source prose.
- `skipped` contains counts by reason, not full input objects.

- [ ] **Step 1: Write mapping tests before implementation**

Cover all of these cases in `map-indexes.test.mjs`:

1. A mapped knowledge card becomes one `investment` record.
2. The record stores only title, summary, status, date, topic titles, a small payload, and a relative `sourceRef`; evidence, source quote, entities, and links are absent.
3. An action card becomes a `todo`, not a record.
4. `nextActions` on an included card become deterministic tasks.
5. A card in a configured goal topic becomes a `goal` with the configured `year` or `month` period.
6. A project-index entry becomes a `project` record with:

```js
{
  techStack: [],
  repositoryUrl: null,
  demoUrl: null,
  currentFocus: project.currentFocus ?? '',
}
```

7. Re-running the mapper produces byte-for-byte identical IDs.
8. An unmapped card is skipped.
9. A card mapped to two different domains is rejected as ambiguous.
10. A career card is rejected unless its redacted title/summary contains exactly one approved alias.
11. A career card maps its payload as:

```js
{
  companyAlias: 'A公司',
  position: redactedTitle,
  startDate: card.date || '',
  endDate: null,
  responsibilities: redactedSummary,
  projects: [],
  isCurrent: card.status === 'active',
}
```

12. Compensation content is rejected and cannot appear in serialized output.

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run:

```bash
node --test server/import-self/map-indexes.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement deterministic IDs**

```js
import { createHash } from 'node:crypto';

function stableId(kind, source) {
  const digest = createHash('sha256').update(source).digest('hex').slice(0, 24);
  return `self:${kind}:${digest}`;
}
```

Use these seeds:

- card record: `card:${card.id}`
- project record: `project:${project.id}`
- action-card task: `action:${card.id}`
- next action: `next-action:${card.id}:${zeroBasedIndex}`

- [ ] **Step 4: Implement the fixed mapping rules**

For cards:

1. Ignore statuses other than `active` and `watch`.
2. Resolve `domain` from `map.topicDomains` and the card's `topicIds`.
3. If no mapped domain exists, increment `skipped.unmapped`.
4. If more than one distinct domain exists, reject `ambiguous_domain`.
5. Redact title, summary, topic titles, and next actions.
6. Normalize only the first `sources[].file` as `sourceRef`; do not persist headings or quotes.
7. Map semantic types:

```js
const RECORD_TYPES = {
  knowledge: 'knowledge',
  idea: 'idea',
  decision: 'decision',
  experience: 'experience',
};
```

8. An `action` card creates one task. Any included card may also create one task per non-empty `nextActions` entry.
9. A task is `goal` with the configured period when any card topic is present in `map.goalTopics`; otherwise it is `todo` with `period: null`.
10. Use `pending`, `targetAt: null`, `completedAt: null`, the card date as `createdAt` when valid, and the normalized source reference.

For projects:

1. Import every visible project-index entry as `domain: "project"` and `type: "project"`.
2. Redact title, summary, and current focus.
3. Persist no `roots` absolute paths and no raw card content.
4. Normalize `sourceFile` as `sourceRef`.

Call `validatePersistable` on every complete candidate. Catch privacy errors per candidate and append only a stable source ID and rule name to `rejected`.

- [ ] **Step 5: Run mapping tests**

Run:

```bash
node --test server/import-self/map-indexes.test.mjs
```

Expected: all cases PASS and snapshots contain no raw quotes, absolute paths, or compensation terms.

- [ ] **Step 6: Commit**

```bash
git add server/import-self/map-indexes.mjs server/import-self/map-indexes.test.mjs
git commit -m "feat: map self cards into local records"
```

---

### Task 4: Add preview-by-default and atomic apply

**Files:**
- Create: `server/import-self/import.mjs`
- Create: `server/import-self/import.test.mjs`

**Interfaces:**
- Produces:

```js
importSelf({
  vaultRoot,
  mapFilename,
  db,
  apply = false,
}): Promise<{
  mode: 'preview' | 'applied',
  records: number,
  tasks: number,
  rejected: Array<{ sourceId: string, reason: string }>,
  skipped: Record<string, number>,
}>
```

- [ ] **Step 1: Write transactional behavior tests**

Test against a temporary migrated SQLite database:

- preview returns counts but leaves `records` and `tasks` empty;
- apply inserts the previewed counts;
- applying twice keeps the same row counts;
- when the task upsert is forced to throw, both record and task changes roll back;
- the returned object contains no Vault root or source prose.

- [ ] **Step 2: Run and verify the missing-module failure**

Run:

```bash
node --test server/import-self/import.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement preview and a single transaction**

Implementation order:

```js
const indexes = await loadSelfIndexes(vaultRoot);
const map = await loadImportMap(mapFilename);
const result = mapSelfIndexes(indexes, map);
const summary = summarize(result, apply ? 'applied' : 'preview');
if (!apply) return summary;

db.exec('BEGIN IMMEDIATE');
try {
  upsertRecords(db, result.records);
  upsertTasks(db, result.tasks);
  db.exec('COMMIT');
  return summary;
} catch (error) {
  db.exec('ROLLBACK');
  throw new Error('Self import failed; local data was unchanged', { cause: error });
}
```

All mapping and validation happens before `BEGIN IMMEDIATE`. A rejected item does not abort the rest of the preview; an infrastructure/store failure rolls back the complete apply.

- [ ] **Step 4: Run the importer tests**

Run:

```bash
node --test server/import-self/import.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/import-self/import.mjs server/import-self/import.test.mjs
git commit -m "feat: preview and apply self import atomically"
```

---

### Task 5: Expose the one-time CLI without changing runtime startup

**Files:**
- Create: `server/cli/import-self.mjs`
- Create: `server/cli/import-self.test.mjs`
- Modify: `package.json`
- Modify: `Dockerfile`
- Modify: `README.md`

**Interfaces:**
- Produces:

```bash
npm run import:self -- --vault /absolute/path/to/Self --map import-map.local.json
npm run import:self -- --vault /absolute/path/to/Self --map import-map.local.json --apply
```

- [ ] **Step 1: Write argument-parser tests**

Export `parseArgs(argv)` and test:

- `--vault` is required;
- `--map` is optional and defaults to no private mappings;
- `--apply` defaults to false;
- unknown flags fail;
- missing flag values fail;
- error text contains option names but never the supplied absolute path.

- [ ] **Step 2: Run and verify failure**

Run:

```bash
node --test server/cli/import-self.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the CLI**

The executable flow:

1. parse arguments;
2. open `DATA_DIR/dashboard.sqlite3`;
3. apply local database migrations;
4. call `importSelf`;
5. print the summary as formatted JSON;
6. close the database in `finally`;
7. set `process.exitCode = 1` on failure and print only the sanitized error message.

Add:

```json
"import:self": "node server/cli/import-self.mjs"
```

Do not import this module from `server/index.mjs`.

Add the committed example configuration to the runtime image immediately after the existing database copy:

```dockerfile
COPY --from=build /app/config ./config
```

- [ ] **Step 4: Document the local mapping workflow**

README instructions:

```bash
cp config/import-map.example.json import-map.local.json
npm run import:self -- \
  --vault /absolute/path/to/Self \
  --map import-map.local.json
```

The first command is preview-only. Review record/task/rejection counts, then run:

```bash
npm run import:self -- \
  --vault /absolute/path/to/Self \
  --map import-map.local.json \
  --apply
```

Explain that re-running is safe because IDs are deterministic, but Self is not watched and local edits never write back.

- [ ] **Step 5: Document the Docker form**

The image already contains the importer. Add this exact pattern, with the Vault read-only:

```bash
docker compose run --rm \
  -v "/absolute/path/to/Self:/vault:ro" \
  -v "$PWD/import-map.local.json:/app/import-map.local.json:ro" \
  app node server/cli/import-self.mjs \
  --vault /vault \
  --map /app/import-map.local.json
```

Add `--apply` only after preview. `./data:/app/data` remains the database bind mount supplied by Compose.

- [ ] **Step 6: Verify the runtime has no Self dependency**

Run:

```bash
npm test
npm run typecheck
npm run build
DATA_DIR=/private/tmp/my-dashboard-import-test npm run import:self -- \
  --vault fixtures/self-index \
  --map config/import-map.example.json
rg -n "loadSelfIndexes|importSelf" server/index.mjs server/http
```

Expected: tests/typecheck/build PASS; preview prints counts without changing the database; the final search returns no matches.

- [ ] **Step 7: Verify a real local preview without recording its output**

Run against the actual Vault and local ignored mapping. Do not redirect the output into the repository and do not paste raw rejected content into docs:

```bash
npm run import:self -- \
  --vault /Users/ruifeng/Desktop/Self \
  --map import-map.local.json
```

Expected: version 3 accepted; summary counts shown; no database writes. Resolve unexpected rejection categories by adjusting only the local mapping or explicit mapper rules, never by weakening the privacy checks.

- [ ] **Step 8: Apply once and inspect only sanitized database projections**

Back up `data/dashboard.sqlite3` if it already exists, then run the same command with `--apply`. Query only:

```sql
SELECT domain, type, count(*) FROM records GROUP BY domain, type;
SELECT kind, period, count(*) FROM tasks GROUP BY kind, period;
SELECT DISTINCT json_extract(payload_json, '$.companyAlias')
FROM records WHERE domain = 'career';
```

Expected: counts match the preview; career aliases are a subset of A/Y/H; no compensation fields are present.

- [ ] **Step 9: Commit**

```bash
git add server/cli/import-self.mjs server/cli/import-self.test.mjs package.json package-lock.json Dockerfile README.md
git commit -m "feat: add one-time self vault import"
```

---

## Plan 2 Completion Gate

Before starting clean GitHub publication:

- all tests, typecheck, and production build pass;
- preview leaves SQLite unchanged;
- apply is transactional and idempotent;
- the importer reads only three allowed version-3 index files;
- the HTTP server and browser never access Self;
- the real local mapping remains ignored and unstaged;
- no absolute Vault path, source quote, compensation value, or unapproved career company reaches SQLite;
- the app starts normally after the Vault directory is unavailable;
- Git working tree is clean.
