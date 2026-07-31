import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const INDEX_ROOT = join('90_输出', '语义索引');

async function readJson(vaultRoot, filename) {
  return JSON.parse(await readFile(join(vaultRoot, INDEX_ROOT, filename), 'utf8'));
}

function requireArray(value, label) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
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
