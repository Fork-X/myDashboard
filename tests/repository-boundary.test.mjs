import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { extname } from 'node:path';
import test from 'node:test';

const joined = (...parts) => parts.join('');

const removedFiles = [
  'server/db/migrations/002_independent_dashboard.sql',
  joined('server/db/rec', 'ords.mjs'),
  joined('server/db/rec', 'ords.test.mjs'),
  joined('server/db/ta', 'sks.mjs'),
  joined('server/db/ta', 'sks.test.mjs'),
  joined('server/cli/se', 'ed-', 'de', 'mo.mjs'),
  joined('server/cli/se', 'ed-', 'de', 'mo.test.mjs'),
  joined('server/cli/import-', 'se', 'lf.mjs'),
  joined('server/cli/import-', 'se', 'lf.test.mjs'),
  joined('server/import-', 'se', 'lf/load-indexes.mjs'),
  joined('server/import-', 'se', 'lf/load-indexes.test.mjs'),
  joined('server/import-', 'se', 'lf/privacy.mjs'),
  joined('server/import-', 'se', 'lf/privacy.test.mjs'),
  joined('server/import-', 'se', 'lf/import.mjs'),
  joined('server/import-', 'se', 'lf/import.test.mjs'),
  joined('server/import-', 'se', 'lf/map-indexes.mjs'),
  joined('server/import-', 'se', 'lf/map-indexes.test.mjs'),
  joined('src/hooks/use', 'Reco', 'rds.ts'),
  joined('src/hooks/use', 'Ta', 'sks.ts'),
  'src/components/investment/KnowledgeList.tsx',
  'src/components/investment/ReviewTimeline.tsx',
  joined('fix', 'tures/de', 'mo/rec', 'ords.json'),
  joined('fix', 'tures/de', 'mo/ta', 'sks.json'),
  joined('fix', 'tures/se', 'lf-index/90_输出/语义索引/cards.local.json'),
  joined('fix', 'tures/se', 'lf-index/90_输出/语义索引/topics.local.json'),
  joined('fix', 'tures/se', 'lf-index/90_输出/语义索引/projects.local.json'),
  joined('config/import-', 'map.example.json'),
  joined('scripts/mi', 'gration/frontend-record-contract.test.mjs'),
  joined('scripts/mi', 'gration/frontend-task-contract.test.mjs'),
  joined('scripts/mi', 'gration/runtime-sanitization.test.mjs'),
  joined('scripts/mi', 'gration/export-clean-snapshot.mjs'),
  joined('scripts/mi', 'gration/export-clean-snapshot.test.mjs'),
  joined('scripts/mi', 'gration/scan-sensitive.mjs'),
  joined('scripts/mi', 'gration/scan-sensitive.test.mjs'),
  joined('docs/super', 'powers/plans/2026-07-30-clean-github-publication.md'),
  joined('docs/super', 'powers/plans/2026-07-30-local-sqlite-runtime.md'),
  joined('docs/super', 'powers/plans/2026-07-30-se', 'lf-vault-one-time-import.md'),
  joined('docs/super', 'powers/specs/2026-07-30-local-sqlite-github-migration-design.md'),
];

const removedDirectories = [
  joined('server/import-', 'se', 'lf/'),
  joined('fix', 'tures/de', 'mo/'),
  joined('fix', 'tures/se', 'lf-index/'),
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
  ['old-read-route', new RegExp(['api/', 'rec', 'ords'].join(''), 'g')],
  ['old-task-route', new RegExp(['api/', 'ta', 'sks'].join(''), 'g')],
  ['old-import-command', new RegExp(['import', ':se', 'lf'].join(''), 'g')],
  [joined('old-se', 'ed-command'), new RegExp(['se', 'ed:', 'de', 'mo'].join(''), 'g')],
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
  !path.startsWith(joined('.super', 'powers/'))
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
