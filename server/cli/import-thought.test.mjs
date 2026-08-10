import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { openDatabase } from '../db/database.mjs';
import { applyMigrations } from '../db/migrate.mjs';

const cliFilename = resolve('server/cli/import-thought.mjs');

function runCli(args, { dataDir, cwd = resolve('.') } = {}) {
  return spawnSync(process.execPath, [cliFilename, ...args], {
    cwd,
    encoding: 'utf8',
    env: { ...process.env, ...(dataDir ? { DATA_DIR: dataDir } : {}) },
  });
}

async function makeInput(root, value) {
  const filename = join(root, 'thought.json');
  await writeFile(filename, typeof value === 'string' ? value : JSON.stringify(value));
  return filename;
}

test('previews normalized input without creating or writing a database', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-thought-preview-'));
  const dataDir = join(root, 'data');
  try {
    const input = await makeInput(root, {
      title: '  标题  ',
      content: '  正文  ',
      tags: [' 明确 ', '明确'],
    });
    const result = runCli(['--input', input], { dataDir });

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {
      mode: 'preview',
      title: '标题',
      content: '正文',
      tags: ['明确'],
    });
    assert.equal(existsSync(dataDir), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('applies one thought transactionally and a duplicate apply adds no row', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-thought-apply-'));
  const dataDir = join(root, 'data');
  try {
    const input = await makeInput(root, { title: '标题', content: '正文', tags: [] });
    const first = runCli(['--input', input, '--apply'], { dataDir });
    const second = runCli(['--input', input, '--apply'], { dataDir });

    assert.equal(first.status, 0, first.stderr);
    assert.equal(second.status, 0, second.stderr);
    assert.equal(JSON.parse(first.stdout).mode, 'apply');
    assert.equal(JSON.parse(first.stdout).inserted, true);
    assert.equal(JSON.parse(second.stdout).inserted, false);

    const db = openDatabase(join(dataDir, 'dashboard.sqlite3'));
    try {
      assert.equal(db.prepare('SELECT count(*) AS count FROM thoughts').get().count, 1);
    } finally {
      db.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rolls back apply when the thought insert fails', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-thought-rollback-'));
  const dataDir = join(root, 'data');
  const dbFilename = join(dataDir, 'dashboard.sqlite3');
  try {
    const db = openDatabase(dbFilename);
    applyMigrations(db, resolve('server/db/migrations'));
    db.exec(`
      CREATE TRIGGER reject_imported_thought
      AFTER INSERT ON thoughts
      BEGIN
        SELECT RAISE(ABORT, 'forced failure');
      END;
    `);
    db.close();

    const input = await makeInput(root, { title: '标题', content: '正文' });
    const result = runCli(['--input', input, '--apply'], { dataDir });

    assert.notEqual(result.status, 0);
    const verificationDb = openDatabase(dbFilename);
    try {
      assert.equal(verificationDb.prepare('SELECT count(*) AS count FROM thoughts').get().count, 0);
    } finally {
      verificationDb.close();
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('rejects relative paths, unknown flags, invalid JSON, and unknown JSON fields', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-thought-invalid-'));
  try {
    const validInput = await makeInput(root, { title: '标题', content: '正文' });
    const invalidJson = join(root, 'invalid.json');
    const expandedJson = join(root, 'expanded.json');
    await writeFile(invalidJson, '{');
    await writeFile(expandedJson, JSON.stringify({
      title: '标题', content: '正文', source: 'conversation',
    }));

    const results = [
      runCli(['--input', 'thought.json']),
      runCli(['--input', validInput, '--unknown']),
      runCli(['--input', invalidJson]),
      runCli(['--input', expandedJson]),
    ];
    for (const result of results) {
      assert.notEqual(result.status, 0);
      assert.equal(result.stdout, '');
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('importing the CLI module has no filesystem or database side effects', async () => {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-thought-import-'));
  const dataDir = join(root, 'data');
  try {
    const result = spawnSync(process.execPath, [
      '--input-type=module',
      '--eval',
      `await import(${JSON.stringify(pathToFileURL(cliFilename).href)})`,
    ], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, DATA_DIR: dataDir },
    });

    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
    // node:sqlite is experimental — Node prints a warning to stderr on startup;
    // filter known runtime noise, everything else must still be empty.
    const noise = /ExperimentalWarning|--trace-warnings/;
    const stderr = result.stderr.split('\n')
      .filter((line) => line.trim() !== '' && !noise.test(line));
    assert.deepEqual(stderr, []);
    assert.equal(existsSync(dataDir), false);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
