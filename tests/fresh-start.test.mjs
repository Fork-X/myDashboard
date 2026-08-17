import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = dirname(fileURLToPath(new URL('../package.json', import.meta.url)));

async function getFreePort() {
  const probe = createServer();
  await new Promise((resolve, reject) => {
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', resolve);
  });
  const address = probe.address();
  assert(address && typeof address === 'object');
  await new Promise((resolve, reject) => probe.close((error) => error ? reject(error) : resolve()));
  return address.port;
}

async function startDashboard(dataDir) {
  const port = await getFreePort();
  const output = [];
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      DATA_DIR: dataDir,
      HOST: '127.0.0.1',
      PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => output.push(chunk));
  child.stderr.on('data', (chunk) => output.push(chunk));

  const baseUrl = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`dashboard exited before becoming healthy\n${Buffer.concat(output).toString()}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        assert.deepEqual(await response.json(), { data: { status: 'ok' } });
        return { baseUrl, child, output };
      }
    } catch {
      // The process may still be applying migrations or binding its socket.
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  child.kill('SIGTERM');
  throw new Error(`dashboard did not become healthy\n${Buffer.concat(output).toString()}`);
}

async function stopDashboard(running) {
  if (running.child.exitCode !== null) return;
  running.child.kill('SIGTERM');
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(
      `dashboard did not stop after SIGTERM\n${Buffer.concat(running.output).toString()}`,
    )), 2_000);
    running.child.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function get(baseUrl, pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  assert.equal(response.status, 200, pathname);
  return (await response.json()).data;
}

async function assertEmptyApis(baseUrl) {
  assert.deepEqual(await get(baseUrl, '/api/thoughts'), []);
  assert.deepEqual(await get(baseUrl, '/api/goals'), []);
  assert.deepEqual(await get(baseUrl, '/api/todos'), []);
}

test('fresh startup and restart keep all business data empty', async () => {
  const dataDir = await mkdtemp(join(tmpdir(), 'dashboard-fresh-start-'));
  try {
    let running = await startDashboard(dataDir);
    try {
      await assertEmptyApis(running.baseUrl);
    } finally {
      await stopDashboard(running);
    }

    running = await startDashboard(dataDir);
    try {
      await assertEmptyApis(running.baseUrl);
    } finally {
      await stopDashboard(running);
    }

    const db = new DatabaseSync(join(dataDir, 'dashboard.sqlite3'), { readOnly: true });
    try {
      for (const table of ['thoughts', 'goals', 'goal_progress', 'todos']) {
        assert.equal(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count, 0, table);
      }
    } finally {
      db.close();
    }
  } finally {
    await rm(dataDir, { recursive: true, force: true });
  }
});

test('package exposes the thought importer without legacy data commands', async () => {
  const packageJson = JSON.parse(await readFile(join(projectRoot, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts['thought:import'], 'node server/cli/import-thought.mjs');
  const legacyDataCommand = new RegExp(['de', 'mo|se', 'ed|se', 'lf'].join(''), 'i');
  assert.deepEqual(
    Object.keys(packageJson.scripts).filter((name) => legacyDataCommand.test(name)),
    [],
  );
});

test('README documents only the independent empty-start workflows', async () => {
  const readme = await readFile(join(projectRoot, 'README.md'), 'utf8');

  assert.match(readme, /Node\.js\s+`?>=24\.15\.0`?/);
  for (const command of ['npm ci', 'npm test', 'npm run typecheck', 'npm run build', 'npm start']) {
    assert.match(readme, new RegExp(command.replaceAll(' ', '\\s+')));
  }
  assert.match(readme, /data\/dashboard\.sqlite3/);
  assert.match(readme, /首次启动[^。\n]*(?:空|没有任何记录)/);
  assert.match(readme, /"title"\s*:\s*"[^"]+"/);
  assert.match(readme, /"content"\s*:\s*"[^"]+"/);
  assert.match(readme, /"tags"\s*:\s*\[/);
  assert.match(readme, /npm run thought:import/);
  assert.match(readme, /--apply/);
  assert.match(readme, /目标[^。\n]*(?:编辑|新增|更新)/);
  assert.match(readme, /TODO[^。\n]*(?:编辑|新增|更新)/i);
  // 职业生涯与个人项目仍是占位模块；投资理财已实现，不得再声称占位
  assert.match(readme, /职业生涯[^。\n]*个人项目[^。\n]*(?:占位|待设计)/);
  assert.doesNotMatch(readme, /投资理财[^。\n]*(?:占位|待设计)/);
  // 独立性声明的现行版本：不接外部数据库、无演示/个人数据；
  // 信源拉取（RSS）已是核心功能，不得再声称“不读取外部内容源”
  assert.match(readme, /不接入[^。\n]*外部数据库/);
  assert.match(readme, /(?:不包含|没有)[^。\n]*演示数据/);
  assert.doesNotMatch(readme, /不读取[^。\n]*外部内容源/);
  const retiredCommand = new RegExp([
    'npm run (?:import:', 'se', 'lf|se', 'ed:', 'de', 'mo)',
    '|server\\/cli\\/(?:import-', 'se', 'lf|se', 'ed-', 'de', 'mo)',
  ].join(''));
  assert.doesNotMatch(readme, retiredCommand);
});

test('server applies migrations before it starts listening', async () => {
  const source = await readFile(join(projectRoot, 'server/index.mjs'), 'utf8');
  const migrateAt = source.indexOf('applyMigrations(');
  const listenAt = source.indexOf('.listen(');
  assert.notEqual(migrateAt, -1);
  assert.notEqual(listenAt, -1);
  assert(migrateAt < listenAt);
});
