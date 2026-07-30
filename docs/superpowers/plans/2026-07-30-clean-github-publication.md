# Clean GitHub Publication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish only the sanitized current application as a new private GitHub repository with one clean commit, no copied legacy Git objects, no company remote, and no local user data.

**Architecture:** Migration-only tooling exports an explicit allowlist into an isolated directory and scans it without printing secrets. That directory becomes a brand-new `main` repository. After GitHub push and a fresh-clone acceptance test, the active workspace is replaced by the verified GitHub clone while the legacy checkout is retained locally without any configured remote.

**Tech Stack:** Node.js 24, built-in `node:fs`, `node:test`, Git, GitHub CLI, Docker Compose, and the application verification commands from Plans 1–2.

## Global Constraints

- Never push from the legacy repository or reuse its `.git` directory.
- Never add GitHub as a second remote to the legacy repository.
- Never create an `oneday-origin` remote.
- GitHub receives exactly one initial commit and no legacy parents, tags, branches, reflogs, or unreachable objects.
- The GitHub repository is private.
- The clean commit uses repository-local privacy-safe author metadata.
- `data/`, SQLite files and sidecars, backups, the real Self Vault, local import maps, local environment files, migration plans, and migration-only scripts are excluded.
- Scanners report file, rule, and line number only; they never print the matching text.
- Do not force-push, overwrite an existing GitHub repository, or delete the legacy server-side repository.
- If `my-dashboard` already exists under the authenticated GitHub account, stop and ask for a repository name or explicit reuse decision.
- The final active checkout must have exactly one remote named `origin`, pointing at GitHub.

---

## Target File Map

Migration-only files are created in the legacy checkout and deliberately excluded from the clean snapshot:

- Create `scripts/migration/export-clean-snapshot.mjs`
- Create `scripts/migration/export-clean-snapshot.test.mjs`
- Create `scripts/migration/scan-sensitive.mjs`
- Create `scripts/migration/scan-sensitive.test.mjs`

The clean snapshot allowlist is:

```text
.dockerignore
.env.example
.gitignore
.nvmrc
Dockerfile
README.md
compose.yaml
config/
db/
fixtures/
index.html
package-lock.json
package.json
postcss.config.js
scripts/dev.mjs
server/
src/
tailwind.config.js
tsconfig.json
webpack.config.js
```

No other current or historical path is eligible.

---

### Task 1: Build an allowlist-only snapshot exporter

**Files:**
- Create: `scripts/migration/export-clean-snapshot.mjs`
- Create: `scripts/migration/export-clean-snapshot.test.mjs`

**Interfaces:**
- Produces: `exportCleanSnapshot({ sourceRoot, destinationRoot }): Promise<string[]>`
- CLI: `node scripts/migration/export-clean-snapshot.mjs <destination>`
- The destination must not exist or must be empty.

- [ ] **Step 1: Write failing exporter tests**

Create a temporary synthetic source tree containing:

- every representative allowlisted file;
- `.git/config`;
- `data/dashboard.sqlite3`;
- `import-map.local.json`;
- `.plan/private.md`;
- `docs/superpowers/plans/private.md`;
- `scripts/migration/private-tool.mjs`;
- a symlink inside an allowlisted directory.

Assert:

1. allowlisted files are copied;
2. all excluded paths are absent;
3. `.git` is never copied;
4. the migration tool copies only `scripts/dev.mjs`, not `scripts/migration`;
5. a symlink causes export to fail rather than following it;
6. a non-empty destination causes export to fail;
7. the returned path list is sorted and relative.

- [ ] **Step 2: Run the test and verify the missing-module failure**

Run:

```bash
node --test scripts/migration/export-clean-snapshot.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement an explicit manifest**

```js
const FILES = [
  '.dockerignore',
  '.env.example',
  '.gitignore',
  '.nvmrc',
  'Dockerfile',
  'README.md',
  'compose.yaml',
  'index.html',
  'package-lock.json',
  'package.json',
  'postcss.config.js',
  'scripts/dev.mjs',
  'tailwind.config.js',
  'tsconfig.json',
  'webpack.config.js',
];

const DIRECTORIES = ['config', 'db', 'fixtures', 'server', 'src'];
```

Implementation requirements:

- resolve source and destination to absolute paths;
- reject identical or nested source/destination roots;
- inspect every source entry with `lstat`;
- reject symlinks and special files;
- create directories with `mkdir`;
- copy regular files with `copyFile`;
- never use a wildcard, `git archive`, filesystem root, or current Git index as the source list;
- verify that required manifest entries exist;
- return the exact copied relative paths.

- [ ] **Step 4: Run exporter tests**

Run:

```bash
node --test scripts/migration/export-clean-snapshot.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 5: Commit migration tooling only to the legacy local branch**

```bash
git add scripts/migration/export-clean-snapshot.mjs scripts/migration/export-clean-snapshot.test.mjs
git commit -m "chore: add clean snapshot exporter"
```

This commit is never pushed to GitHub.

---

### Task 2: Add a non-leaking sensitive-data scanner

**Files:**
- Create: `scripts/migration/scan-sensitive.mjs`
- Create: `scripts/migration/scan-sensitive.test.mjs`

**Interfaces:**
- Produces:

```js
scanTree({
  root,
  privateTermsFilename,
}): Promise<Array<{
  path: string,
  line: number | null,
  rule: string,
}>>
```

- CLI:

```bash
node scripts/migration/scan-sensitive.mjs \
  <snapshot-root> \
  --private-terms /private/tmp/my-dashboard-sensitive-terms.txt
```

- Exit 0 when clean, exit 1 when findings exist, exit 2 for scanner/configuration errors.

- [ ] **Step 1: Write failing scanner tests**

Use synthetic secrets only. Assert detection of:

- absolute macOS and Windows home paths;
- password/secret/token/app-ID assignments;
- compensation field names and Chinese compensation labels;
- the removed legacy SDK/database-client identifiers;
- internal registry/domain terms;
- a configured private term;
- sensitive filenames such as `.npmrc`, `.assets_mapping`, `.plan`, and SQLite sidecars;
- a binary file under an exported tree.

Also assert:

- public `https://registry.npmjs.org/` lockfile URLs are allowed;
- `http://127.0.0.1` and `http://localhost` documentation is allowed;
- output serializes `private-term-1`, never the private term itself;
- the matching source line is never returned or printed.

- [ ] **Step 2: Run and verify the missing-module failure**

Run:

```bash
node --test scripts/migration/scan-sensitive.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement fixed rules plus local private terms**

The built-in rules cover:

```text
absolute-user-path
credential-assignment
compensation-field
legacy-client
private-registry-or-domain
forbidden-filename
binary-artifact
```

Rules are case-insensitive where appropriate. The private-terms file:

- is outside the repository;
- contains one literal term per line;
- ignores empty lines;
- is required for the real publication scan;
- is identified in findings only by one-based ordinal.

Walk the snapshot recursively in sorted order, scan file names and UTF-8 text, and reject NUL-containing/binary files. Do not follow symlinks. The CLI prints JSON findings with only `path`, `line`, and `rule`.

The `compensation-field` rule ignores only
`server/import-self/privacy.mjs` and `server/import-self/privacy.test.mjs`,
because those two files define and test the rejection guard itself. Every other
rule, including configured private terms, still scans those files.

- [ ] **Step 4: Run scanner tests**

Run:

```bash
node --test scripts/migration/scan-sensitive.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 5: Commit migration tooling only to the legacy local branch**

```bash
git add scripts/migration/scan-sensitive.mjs scripts/migration/scan-sensitive.test.mjs
git commit -m "chore: add private snapshot scanner"
```

This commit is never pushed to GitHub.

---

### Task 3: Produce and verify the clean source snapshot

**Files:**
- Read: current sanitized working tree after Plans 1–2
- Create outside repository: `/private/tmp/my-dashboard-clean-snapshot`
- Create outside repository: `/private/tmp/my-dashboard-sensitive-terms.txt`

**Interfaces:**
- Consumes the exact clean application allowlist.
- Produces an isolated, Git-free source tree ready for its first commit.

- [ ] **Step 1: Complete the legacy working-tree verification**

Run:

```bash
git status --short
npm ci
npm test
npm run typecheck
npm run build
docker compose build
```

Expected: clean Git status; all application checks PASS.

- [ ] **Step 2: Prepare the local private-term input**

Populate `/private/tmp/my-dashboard-sensitive-terms.txt` with the known internal host fragments, app IDs, credentials, real company names, and real personal names identified during cleanup. Keep one literal per line.

Do not:

- place this file under the repository;
- print it;
- stage it;
- paste its contents into a command line, plan, log, or test fixture.

Before continuing, verify only its permissions and non-zero line count:

```bash
chmod 600 /private/tmp/my-dashboard-sensitive-terms.txt
test -s /private/tmp/my-dashboard-sensitive-terms.txt
```

- [ ] **Step 3: Export into a new isolated directory**

Confirm the exact target does not exist. If it exists, stop and choose a new explicit target; do not recursively delete it.

Run:

```bash
node scripts/migration/export-clean-snapshot.mjs \
  /private/tmp/my-dashboard-clean-snapshot
```

Expected: export succeeds and prints only sorted relative paths.

- [ ] **Step 4: Run the complete sensitive scan**

```bash
node scripts/migration/scan-sensitive.mjs \
  /private/tmp/my-dashboard-clean-snapshot \
  --private-terms /private/tmp/my-dashboard-sensitive-terms.txt
```

Expected: exit 0 with zero findings.

Any finding is fixed in the legacy working tree, re-tested, committed locally, and exported to a new empty target. Never patch only the snapshot because it must remain reproducible from the source tree.

- [ ] **Step 5: Verify excluded state and runtime requests**

From the snapshot, verify:

```bash
test ! -d /private/tmp/my-dashboard-clean-snapshot/.git
rg --files -g 'data/**' -g '*.sqlite*' -g 'import-map.local.json' \
  /private/tmp/my-dashboard-clean-snapshot
rg -n "https?://" \
  /private/tmp/my-dashboard-clean-snapshot/src \
  /private/tmp/my-dashboard-clean-snapshot/index.html
```

Expected: the first command succeeds; both searches return no matches. Public registry URLs inside `package-lock.json` are intentionally not part of the runtime-request search.

---

### Task 4: Create a one-commit private GitHub repository

**Files:**
- Initialize: `/private/tmp/my-dashboard-clean-snapshot/.git`
- External write: private GitHub repository `my-dashboard`

**Interfaces:**
- Produces: `main` tracking GitHub `origin/main`.

- [ ] **Step 1: Verify GitHub authentication and destination availability**

Run:

```bash
gh auth status --hostname github.com
gh repo view my-dashboard --json name,visibility,url
```

Expected: authentication succeeds and the repository lookup reports not found.

If authentication is invalid, run:

```bash
gh auth login --hostname github.com --web --git-protocol https
```

This is an interactive user checkpoint. If the repository already exists, stop; do not push or modify it without a new explicit decision.

- [ ] **Step 2: Initialize the new history with privacy-safe local metadata**

Run inside the snapshot:

```bash
git init -b main
git config user.name "Dashboard Maintainer"
git config user.email "dashboard-maintainer@users.noreply.github.com"
git add -A
git status --short
git diff --cached --check
git commit -m "Initial private release"
```

Expected: every path is from the allowlist; diff check passes; the root commit succeeds.

- [ ] **Step 3: Verify the new repository before any external write**

Run:

```bash
git rev-list --all --count
git log --format='%an <%ae>'
git remote -v
git fsck --full --no-reflogs
git ls-files
```

Expected:

- commit count is exactly `1`;
- author is exactly `Dashboard Maintainer <dashboard-maintainer@users.noreply.github.com>`;
- there are no remotes yet;
- Git object verification passes;
- tracked files match only the allowlist and contain no local data.

Run the sensitive scanner against the initialized repository's checked-out tree once more.

- [ ] **Step 4: Create the private repository and push**

Run from the clean snapshot:

```bash
gh repo create my-dashboard --private --source . --remote origin
git remote -v
git push -u origin main
```

Expected: repository creation and push succeed; `origin` is the only remote and both URLs are GitHub URLs.

- [ ] **Step 5: Verify GitHub state**

Run:

```bash
gh repo view my-dashboard --json name,visibility,url,defaultBranchRef
git ls-remote --heads origin
```

Expected: visibility is `PRIVATE`, default branch is `main`, and only the intended `main` SHA is published.

---

### Task 5: Accept a fresh clone before switching the active workspace

**Files:**
- Create outside current repository: `/private/tmp/my-dashboard-github-verify`

**Interfaces:**
- Proves the GitHub repository is sufficient without the legacy checkout, Self Vault, credentials, or cloud services.

- [ ] **Step 1: Clone from GitHub into a new explicit path**

Confirm the target path does not exist, then run:

```bash
gh repo clone my-dashboard /private/tmp/my-dashboard-github-verify
```

- [ ] **Step 2: Verify clean history and source**

Run:

```bash
git -C /private/tmp/my-dashboard-github-verify rev-list --all --count
git -C /private/tmp/my-dashboard-github-verify remote -v
git -C /private/tmp/my-dashboard-github-verify status --short
node /Users/ruifeng/IdeaProjects/myDashboard/scripts/migration/scan-sensitive.mjs \
  /private/tmp/my-dashboard-github-verify \
  --private-terms /private/tmp/my-dashboard-sensitive-terms.txt
```

Expected: one commit, only GitHub `origin`, clean worktree, zero scan findings.

- [ ] **Step 3: Verify direct startup from the clone**

Run inside the fresh clone:

```bash
npm ci
npm test
npm run typecheck
npm run build
DATA_DIR=/private/tmp/my-dashboard-github-direct npm run db:migrate
```

Expected: all checks PASS and a new local SQLite file is created outside the repository.

- [ ] **Step 4: Verify Docker startup and persistence**

Run inside the fresh clone:

```bash
docker compose up --build -d
curl --fail http://127.0.0.1:3015/api/health
docker compose exec app node server/cli/seed-demo.mjs
docker compose restart app
curl --fail "http://127.0.0.1:3015/api/records?domain=thought"
docker compose down
```

Expected: health succeeds, demo records remain after restart, and stopping Compose does not remove `data/dashboard.sqlite3`.

- [ ] **Step 5: Verify the Self boundary with synthetic input only**

Run:

```bash
DATA_DIR=/private/tmp/my-dashboard-github-import npm run import:self -- \
  --vault fixtures/self-index \
  --map config/import-map.example.json
```

Expected: preview succeeds without Self Vault mounted and leaves the database unchanged.

---

### Task 6: Make the verified GitHub clone the active workspace

**Files:**
- Current active path: `/Users/ruifeng/IdeaProjects/myDashboard`
- Recoverable legacy backup: `/Users/ruifeng/IdeaProjects/myDashboard-legacy-local-20260730`

**Interfaces:**
- The active path becomes a fresh GitHub clone.
- The legacy backup retains local history temporarily but has no configured remote.
- Existing local `data/` is preserved and remains untracked.

- [ ] **Step 1: Perform exact-path preflight checks**

From `/Users/ruifeng/IdeaProjects`, verify:

```bash
test -d /Users/ruifeng/IdeaProjects/myDashboard/.git
test ! -e /Users/ruifeng/IdeaProjects/myDashboard-legacy-local-20260730
git -C /Users/ruifeng/IdeaProjects/myDashboard status --short
git -C /private/tmp/my-dashboard-github-verify status --short
```

Expected: both repositories are clean and the backup target does not exist. Stop on any mismatch.

- [ ] **Step 2: Remove the company remote from the legacy checkout**

Run:

```bash
git -C /Users/ruifeng/IdeaProjects/myDashboard remote remove origin
git -C /Users/ruifeng/IdeaProjects/myDashboard remote -v
```

Expected: no remotes. Do not add or rename a legacy remote.

- [ ] **Step 3: Switch directories without deleting either copy**

Run from `/Users/ruifeng/IdeaProjects` with elevated filesystem approval:

```bash
mv /Users/ruifeng/IdeaProjects/myDashboard \
  /Users/ruifeng/IdeaProjects/myDashboard-legacy-local-20260730
mv /private/tmp/my-dashboard-github-verify \
  /Users/ruifeng/IdeaProjects/myDashboard
```

If the legacy backup contains `data/` and the fresh clone does not, move that exact directory into the fresh clone. Do not overwrite a non-empty destination.

- [ ] **Step 4: Verify the final active checkout**

Run:

```bash
git -C /Users/ruifeng/IdeaProjects/myDashboard status --short
git -C /Users/ruifeng/IdeaProjects/myDashboard rev-list --all --count
git -C /Users/ruifeng/IdeaProjects/myDashboard remote -v
git -C /Users/ruifeng/IdeaProjects/myDashboard branch --show-current
git -C /Users/ruifeng/IdeaProjects/myDashboard-legacy-local-20260730 remote -v
```

Expected:

- active checkout is clean except optional ignored local `data/`;
- active history has one commit;
- active branch is `main`;
- active checkout has only GitHub `origin`;
- legacy backup has no remotes.

Keep the legacy backup until the user explicitly decides to move it to Trash. It is not the active project and cannot push anywhere.

---

## Plan 3 Completion Gate

Publication is complete only when:

- GitHub repository visibility is private;
- GitHub has exactly one clean root commit on `main`;
- commit author metadata is privacy-safe;
- source and complete Git history pass the sensitive scan;
- tracked files match the explicit allowlist;
- Git tracks no database, local map, Vault input, backup, environment secret, migration plan, or migration-only tooling;
- a fresh GitHub clone passes tests, typecheck, build, direct migration, Docker startup, and persistence;
- the application runs without Self Vault or any cloud account;
- the active workspace is the verified GitHub clone;
- its only remote is GitHub `origin`;
- the local legacy backup has no remote;
- no `oneday-origin` remote exists anywhere in either checkout.
