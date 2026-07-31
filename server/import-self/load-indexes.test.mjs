import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { loadSelfIndexes } from './load-indexes.mjs';

test('loads only cards, topics, and projects from a v3 index', async () => {
  const result = await loadSelfIndexes(resolve('fixtures/self-index'));

  assert.deepEqual(Object.keys(result), [
    'version',
    'generatedAt',
    'cards',
    'topics',
    'projects',
  ]);
  assert.equal(result.version, 3);
  assert.equal(result.cards.length, 1);
  assert.equal(result.topics.length, 1);
  assert.equal(result.projects.length, 1);
  assert.equal('careerCompensation' in result, false);
});

test('rejects unsupported index versions', async () => {
  const vaultRoot = await mkdtemp(join(tmpdir(), 'dashboard-self-index-v2-'));
  const indexRoot = join(vaultRoot, '90_输出', '语义索引');
  await mkdir(indexRoot, { recursive: true });

  try {
    await Promise.all([
      writeFile(
        join(indexRoot, 'cards.local.json'),
        JSON.stringify({ version: 2, cards: [] }),
      ),
      writeFile(
        join(indexRoot, 'topics.local.json'),
        JSON.stringify({ version: 3, topics: [] }),
      ),
      writeFile(
        join(indexRoot, 'projects.local.json'),
        JSON.stringify({ version: 3, projects: [] }),
      ),
    ]);

    await assert.rejects(
      () => loadSelfIndexes(vaultRoot),
      /Self semantic index version 3 is required/,
    );
  } finally {
    await rm(vaultRoot, { recursive: true, force: true });
  }
});
