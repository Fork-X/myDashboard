# Local SQLite and Clean GitHub Migration Design

Date: 2026-07-30

Status: Approved for implementation

## Goal

Turn the current personal dashboard into a small local-first application that:

- has no legacy internal SDK, internal endpoints, app IDs, client-side passwords, salary fields, real company names, or sensitive historical Git data;
- uses a local SQLite database as the only runtime source of truth;
- imports Self Vault data once, then runs without Self Vault;
- starts with one Docker command, while still supporting direct local development;
- publishes only a new, sanitized Git history to a private GitHub repository;
- keeps all user data on the local machine and out of Git.

The first release optimizes for a short data path and reliable local use. It does not attempt to support multiple users, remote access, live Vault synchronization, or a generic plugin architecture.

## Current Behavior

The current application is a React/Webpack frontend whose pages query a legacy internal cloud database directly from the browser.

Most read-only pages silently fall back to hard-coded mock data when a cloud query fails or returns no rows. The TODO page writes directly to the remote `todos` table. The career page contains a client-side password, salary rendering, and real-name mock data.

The current Git repository also contains internal package-registry URLs, generated legacy migrations, an internal asset mapping, an old implementation plan, and an obsolete failure screenshot.

## Target Architecture

```text
One-time import:

Self Vault -> import:self command -> SQLite

Normal runtime:

Browser -> same-origin Node API -> SQLite
             |
             +-> serves the built React application
```

There is one long-running application process and one local SQLite file.

The Node application:

- serves the React production build;
- exposes a small `/api` surface;
- applies SQLite schema migrations at startup;
- reads and writes `data/dashboard.sqlite3`.

Docker is the recommended runtime but not a separate architecture. The app container bind-mounts `./data` to `/app/data`. Direct local execution uses the same `./data` directory and the same migrations.

## Deliberately Removed Layers

The runtime will not contain:

- `SelfReadModelSource`;
- `LocalApiAdapter`;
- storage adapters or repositories selected at runtime;
- page-specific selectors over multiple data sources;
- a continuously running Self Vault service;
- a separate database service or full backend platform;
- a browser database client.

These layers were useful only while the application needed to switch between the legacy cloud source and Self Vault. Once SQLite is the sole runtime truth source, they add indirection without buying flexibility.

The only conversion boundary is the one-time Self importer. The only runtime boundary is the local HTTP API required for the browser to access SQLite.

## Minimal Data Model

The initial business schema has two tables.

### `records`

Stores investment notes, thoughts, career entries, knowledge, decisions, and projects.

Required columns:

- `id`
- `domain`: `investment`, `thought`, `career`, or `project`
- `type`: `knowledge`, `idea`, `decision`, `experience`, or `project`
- `title`
- `content`
- `status`
- `occurred_at`
- `tags_json`
- `payload_json`
- `source_ref`
- `created_at`
- `updated_at`

`source_ref` stores only a Vault-relative reference. It must never store an absolute user path.

`payload_json` is allowed only for small domain-specific fields and is validated by a discriminated TypeScript schema. It is not an unstructured dumping ground.

### `tasks`

Stores goals and TODO items.

Required columns:

- `id`
- `kind`: `goal` or `todo`
- `period`: `year`, `month`, or `null`
- `title`
- `description`
- `status`
- `target_at`
- `completed_at`
- `source_ref`
- `created_at`
- `updated_at`

The migration mechanism may maintain its own `schema_migrations` table. No import-history, event, snapshot, topic, tag, or settings table is introduced in the first release.

## Self Vault Import

The importer is a CLI command, not a runtime service:

```bash
docker compose run --rm app npm run import:self -- --vault /vault
```

It reads the current Self semantic cards and project index, maps them into `records` and `tasks`, and writes them in one SQLite transaction.

Import rules:

- card type and topic membership determine `domain` and `type`;
- projects become `project` records;
- action cards and `nextActions` become tasks;
- company names are translated through a local, Git-ignored alias map;
- only `A公司`, `Y公司`, and `H公司` may enter career display data;
- salary and compensation fields are discarded before persistence;
- source references are normalized to Vault-relative paths;
- deterministic IDs derived from source references make the command safe to re-run;
- the default mode previews counts and rejected items;
- `--apply` performs the transactional import;
- a failed validation rolls back the complete import.

After a successful import, Self Vault is not required to start or use the application. There is no automatic re-import or write-back.

## API Surface

The first release exposes only:

- `GET /api/health`
- `GET /api/records?domain=<domain>`
- `GET /api/records/:id`
- `GET /api/tasks?kind=<goal|todo>`
- `POST /api/tasks`
- `PATCH /api/tasks/:id`

Investment, thoughts, career, and projects are read-only in the first release. TODO creation and status updates remain writable.

Full CRUD for every record type is explicitly deferred. Additional endpoints are added only when a concrete page needs them.

## User Interface Changes

The information architecture and vintage visual style remain recognizable:

- home;
- investment;
- thoughts;
- career;
- planning and TODO;
- projects;
- vintage cards, navigation, dividers, and the completed-task seal.

Behavior changes:

- pages no longer contact the legacy cloud source;
- pages no longer display hard-coded business mock data after errors;
- an empty database produces honest empty states;
- an API or database failure produces an explicit error state;
- an optional `seed:demo` command can load clearly labeled anonymous sample data;
- career no longer has a salary section, lock button, password modal, or salary field;
- career company display is limited to the approved aliases;
- TODO changes persist in local SQLite;
- all other initial pages read local SQLite records.

The first release does not redesign the visual system. Layout changes are limited to removing obsolete controls and adding empty/error/import guidance.

## Docker and Direct Run

Recommended user path:

```bash
docker compose up --build
```

The Compose file contains one application service and mounts:

```text
./data:/app/data
```

The published port binds to localhost by default.

Developer path:

```bash
npm ci
npm run db:migrate
npm run dev
```

Both modes use the same schema and `DATA_DIR` contract. The repository pins the supported Node version and uses only public package registries.

The `data/`, `backups/`, local alias map, Self Vault input, and SQLite sidecar files are ignored by Git.

## Clean GitHub Migration

The GitHub repository is created from a sanitized file snapshot, not from the current `.git` directory.

Migration sequence:

1. Complete the application cleanup and local verification in the existing checkout.
2. Export only allowed files into an isolated directory.
3. run sensitive-term, internal-domain, credential, and personal-name scans over the exported tree;
4. initialize a new Git repository with `main` as its first branch;
5. create a private GitHub repository named `my-dashboard` under the authenticated account;
6. create one clean initial commit;
7. configure GitHub as the only `origin`;
8. push `main`;
9. clone the GitHub repository into a separate temporary directory;
10. verify Docker startup, direct startup, import, persistence, tests, and production build from that clone;
11. only after verification, replace the working checkout with the clean GitHub clone.

The legacy remote is not retained in the new repository. The migration does not delete the server-side legacy repository.

## Required Sanitization

Remove:

- the legacy internal cloud SDK;
- legacy cloud client code and generated types;
- old legacy SQL migrations;
- internal URLs and app IDs;
- hard-coded passwords;
- salary and compensation fields;
- real-name sample data;
- business mock fallback data;
- `.plan/`;
- `.assets_mapping`;
- the obsolete screenshot under `assets/`;
- external runtime font and icon CDNs.

Regenerate:

- `package-lock.json` from public package sources;
- database migrations for SQLite;
- anonymous demo fixtures;
- README and environment examples.

## Error Handling

- Startup fails with a clear message if the data directory is not writable or a migration fails.
- API responses use consistent JSON errors without exposing local absolute paths.
- Pages distinguish loading, empty, and error states.
- Self import rejects unsupported schema versions or invalid records before writing.
- A failed import leaves the existing database unchanged.

## Verification

The release is accepted only when:

- the exported tree and complete new Git history contain no legacy-platform identifiers, internal domains, app IDs, client passwords, salary fields, real company names, or local absolute paths;
- `git remote -v` lists only GitHub;
- a fresh GitHub clone starts with `docker compose up --build`;
- a fresh GitHub clone also supports the documented direct-run path;
- the browser makes no runtime request to the legacy cloud source, internal domains, or external CDNs;
- empty-state startup works without Self Vault;
- the optional anonymous demo seed is visibly labeled as demo data;
- TODO writes survive an application/container restart;
- Self import preview and transactional apply are covered by tests;
- imported SQLite rows exclude compensation and use only approved company aliases;
- typecheck, unit tests, API tests, production build, and sensitive-data scans pass.

## Deferred Work

- multi-user authentication;
- LAN or internet exposure;
- PostgreSQL;
- continuous Self Vault synchronization;
- write-back to Self Vault;
- full CRUD for every record type;
- advanced search, embeddings, and knowledge graphs;
- automated cloud backup.

These are added only after the local single-user flow proves useful.
