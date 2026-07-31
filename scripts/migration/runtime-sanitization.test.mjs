import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';

const legacyCloudName = ['one', 'day'].join('');
const hostedDatabaseName = ['supa', 'base'].join('');

async function missing(path) {
  return access(path).then(() => false, () => true);
}

test('legacy runtime and private generated artifacts are absent', async () => {
  for (const path of [
    `src/${legacyCloudName}cloud`,
    'migrations',
    '.plan',
    '.assets_mapping',
    'assets/15440dfe-399d-430c-a8d5-518dd52414c6.jpg',
    '.npmrc',
  ]) {
    assert.equal(await missing(path), true, `${path} must be removed`);
  }

  const forbiddenDependency = new RegExp(
    [legacyCloudName, hostedDatabaseName].join('|'),
    'i',
  );
  const packageJson = await readFile('package.json', 'utf8');
  assert.doesNotMatch(packageJson, forbiddenDependency);

  const packageLock = await readFile('package-lock.json', 'utf8');
  assert.doesNotMatch(packageLock, forbiddenDependency);
  for (const [, resolved] of packageLock.matchAll(/"resolved": "([^"]+)"/g)) {
    assert.match(resolved, /^https:\/\/registry\.npmjs\.org\//);
  }

  const html = await readFile('index.html', 'utf8');
  assert.doesNotMatch(html, /https?:\/\//);
});
