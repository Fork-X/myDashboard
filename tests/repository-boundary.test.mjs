import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import test from 'node:test';

const removedFiles = [
  'db/migrations/002_independent_dashboard.sql',
  'server/db/records.mjs',
  'server/db/records.test.mjs',
  'server/db/tasks.mjs',
  'server/db/tasks.test.mjs',
  'server/cli/seed-demo.mjs',
  'server/cli/seed-demo.test.mjs',
  'server/cli/import-self.mjs',
  'server/cli/import-self.test.mjs',
  'server/import-self/load-indexes.mjs',
  'server/import-self/load-indexes.test.mjs',
  'server/import-self/privacy.mjs',
  'server/import-self/privacy.test.mjs',
  'server/import-self/import.mjs',
  'server/import-self/import.test.mjs',
  'server/import-self/map-indexes.mjs',
  'server/import-self/map-indexes.test.mjs',
  'src/hooks/useRecords.ts',
  'src/hooks/useTasks.ts',
  'src/components/investment/KnowledgeList.tsx',
  'src/components/investment/ReviewTimeline.tsx',
  'fixtures/demo/records.json',
  'fixtures/demo/tasks.json',
  'fixtures/self-index/90_输出/语义索引/cards.local.json',
  'fixtures/self-index/90_输出/语义索引/topics.local.json',
  'fixtures/self-index/90_输出/语义索引/projects.local.json',
  'config/import-map.example.json',
  'scripts/migration/frontend-record-contract.test.mjs',
  'scripts/migration/frontend-task-contract.test.mjs',
  'scripts/migration/runtime-sanitization.test.mjs',
  'scripts/migration/export-clean-snapshot.mjs',
  'scripts/migration/export-clean-snapshot.test.mjs',
  'scripts/migration/scan-sensitive.mjs',
  'scripts/migration/scan-sensitive.test.mjs',
  'docs/superpowers/plans/2026-07-30-clean-github-publication.md',
  'docs/superpowers/plans/2026-07-30-local-sqlite-runtime.md',
  'docs/superpowers/plans/2026-07-30-self-vault-one-time-import.md',
  'docs/superpowers/specs/2026-07-30-local-sqlite-github-migration-design.md',
];

const removedDirectories = [
  'server/import-self/',
  'fixtures/demo/',
  'fixtures/self-index/',
  'config/',
];

const runtimeFiles = [
  'server/http/handler.mjs',
  'src/api/client.ts',
  'src/api/types.ts',
  'package.json',
  'Dockerfile',
];

const runtimeRules = [
  ['old-read-route', new RegExp(['api/', 'records'].join(''), 'g')],
  ['old-task-route', new RegExp(['api/', 'tasks'].join(''), 'g')],
  ['old-import-command', new RegExp(['import', ':self'].join(''), 'g')],
  ['old-seed-command', new RegExp(['seed', ':demo'].join(''), 'g')],
];

const contentRules = [
  ['surface-1', new RegExp(['News', 'List'].join(''), 'g')],
  ['surface-2', new RegExp(['热', '点', '新', '闻'].join(''), 'g')],
  ['private-1', new RegExp(`\\b${['sal', 'ary'].join('')}\\b`, 'gi')],
  ['private-2', new RegExp(`\\b${['compen', 'sation'].join('')}\\b`, 'gi')],
  ['private-3', new RegExp(['薪', '资|薪', '酬|年', '薪|月', '薪|总', '包'].join(''), 'g')],
  ['control-1', new RegExp(`\\b${['pass', 'word'].join('')}\\b`, 'gi')],
  ['control-2', new RegExp(`\\b${['show', 'Pass', 'word', 'Modal'].join('')}\\b`, 'g')],
  ['control-3', new RegExp(`\\b${['Dollar', 'Sign'].join('')}\\b`, 'g')],
  ['control-4', new RegExp(`\\b${['L', 'ock'].join('')}\\b`, 'g')],
  ['control-5', new RegExp(`\\b${['E', 'ye'].join('')}\\b`, 'g')],
];

const sourceExtensions = new Set([
  '.js', '.mjs', '.ts', '.tsx', '.json', '.sql', '.yaml', '.yml',
]);

function repositoryPaths() {
  const paths = execFileSync('git', [
    'ls-files', '--cached', '--others', '--exclude-standard', '-z',
  ], { encoding: 'utf8' }).split('\0').filter(Boolean);
  const deleted = new Set(execFileSync(
    'git', ['ls-files', '--deleted', '-z'], { encoding: 'utf8' },
  ).split('\0').filter(Boolean));
  return paths.filter((path) => !deleted.has(path));
}

function matches(source, rule) {
  rule.lastIndex = 0;
  return [...source.matchAll(rule)].map((match) => match.index);
}

const paths = repositoryPaths();
const runtimeSources = await Promise.all(
  runtimeFiles.map(async (path) => [path, await readFile(path, 'utf8')]),
);
const sourcePaths = paths.filter((path) =>
  !path.startsWith('.superpowers/')
  && (sourceExtensions.has(extname(path)) || runtimeFiles.includes(path))
);
const textSources = await Promise.all(
  sourcePaths.map(async (path) => [path, await readFile(path, 'utf8')]),
);

for (const removedFile of removedFiles) {
  test(`removed file is absent: ${removedFile}`, () => {
    assert.equal(paths.includes(removedFile), false);
  });
}

for (const removedDirectory of removedDirectories) {
  test(`removed directory is empty: ${removedDirectory}`, () => {
    assert.deepEqual(paths.filter((path) => path.startsWith(removedDirectory)), []);
  });
}

for (const [name, rule] of runtimeRules) {
  test(`runtime boundary excludes ${name}`, () => {
    const findings = runtimeSources.flatMap(([path, source]) =>
      matches(source, rule).map((index) => `${path}:${index}`)
    );
    assert.deepEqual(findings, []);
  });
}

for (const [name, rule] of contentRules) {
  test(`source and path boundary excludes ${name}`, () => {
    const findings = [];
    for (const path of paths) {
      findings.push(...matches(path, rule).map((index) => `${path}:${index}`));
    }
    for (const [path, source] of textSources) {
      findings.push(...matches(source, rule).map((index) => `${path}:${index}`));
    }
    assert.deepEqual(findings, []);
  });
}
