import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const pages = {
  home: new URL('../../src/pages/Home.tsx', import.meta.url),
  thoughts: new URL('../../src/pages/Thoughts.tsx', import.meta.url),
  investment: new URL('../../src/pages/Investment.tsx', import.meta.url),
  career: new URL('../../src/pages/Career.tsx', import.meta.url),
  projects: new URL('../../src/pages/Projects.tsx', import.meta.url),
};
const appPath = new URL('../../src/App.tsx', import.meta.url);
const retiredDataHooks = new RegExp(['use', 'Reco', 'rds|list', 'Reco', 'rds'].join(''), 'i');

test('home derives the approved overview from the three independent hooks', async () => {
  const home = await readFile(pages.home, 'utf8');

  assert.match(home, /useThoughts\(\)/);
  assert.match(home, /useGoals\(\)/);
  assert.match(home, /useTodos\(\)/);
  assert.match(home, /status === 'active'/);
  assert.match(home, /status === 'pending' \|\| [^)]+status === 'in_progress'/);
  assert.match(home, /isImportant && [^.]+\.isUrgent/);
  assert.match(home, /待设计/);
  assert.doesNotMatch(home, new RegExp(`${retiredDataHooks.source}|overview`, 'i'));
});

test('thoughts are read-only and filter by search text and loaded tags', async () => {
  const thoughts = await readFile(pages.thoughts, 'utf8');

  assert.match(thoughts, /useThoughts\(\)/);
  assert.match(thoughts, /search/i);
  assert.match(thoughts, /selectedTag/);
  assert.match(thoughts, /\.title\.toLowerCase\(\)\.includes/);
  assert.match(thoughts, /\.content\.toLowerCase\(\)\.includes/);
  assert.match(thoughts, /flatMap\(\([^)]*\) => [^.]+\.tags\)/);
  assert.match(thoughts, /createdAt/);
  assert.doesNotMatch(
    thoughts,
    new RegExp(`categories|record\\.type|${retiredDataHooks.source}`, 'i'),
  );
  assert.doesNotMatch(thoughts, /createThought|updateThought|deleteThought/);
});

test('unimplemented modules share one honest placeholder and load no business data', async () => {
  const sources = await Promise.all([
    readFile(pages.investment, 'utf8'),
    readFile(pages.career, 'utf8'),
    readFile(pages.projects, 'utf8'),
  ]);

  for (const source of sources) {
    assert.match(source, /ComingSoon/);
    assert.doesNotMatch(source, new RegExp(`${retiredDataHooks.source}|useEffect`, 'i'));
  }
});

test('the thoughts route has no legacy fixed-category variant', async () => {
  const app = await readFile(appPath, 'utf8');

  assert.match(app, /path="thoughts"/);
  assert.doesNotMatch(app, /thoughts\/:category/);
});
