import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import test from 'node:test';
import { openDatabase } from './db/database.mjs';
import { applyMigrations } from './db/migrate.mjs';
import { createDirection, listDirections, listInboxItems } from './db/investment.mjs';
import { createPipeline } from './pipeline.mjs';

/**
 * 建一个自包含的 asset/ 目录（继承模式）：
 *   _default/   完整缺省配置（key=stock，兼容存量数据）
 *   aerospace/  只有 domain.json 差异项，prompt/skill 靠回落继承
 * 故意不写 sources.yaml，使扫描不会发起任何网络请求。
 */
async function writeAssetFixture(root) {
  const assetDir = join(root, 'asset');
  const defaultDir = join(assetDir, '_default');
  await mkdir(defaultDir, { recursive: true });
  await writeFile(join(defaultDir, 'domain.json'), JSON.stringify({
    name: '通用',
    key: 'stock',
    enabled: true,
    ambushDays: 60,
    maxTurns: 1,
    allowedTools: ['WebSearch'],
  }));
  await writeFile(join(defaultDir, 'prompt.md'),
    '题材：{{directionName}}\n日期：{{today}}\n信源：{{sources}}\n');
  await writeFile(join(defaultDir, 'skill.md'),
    '---\nname: stock-scan\n---\n你是测试用扫描助手。\n');

  const aeroDir = join(assetDir, 'aerospace');
  await mkdir(aeroDir, { recursive: true });
  await writeFile(join(aeroDir, 'domain.json'), JSON.stringify({
    name: '航天',
    key: 'aerospace',
    ambushDays: 45,
  }));
  return assetDir;
}

async function withDatabase(run) {
  const root = await mkdtemp(join(tmpdir(), 'dashboard-scanner-'));
  const db = openDatabase(join(root, 'db.sqlite3'));
  try {
    applyMigrations(db, resolve('server/db/migrations'));
    await run(db, await writeAssetFixture(root));
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
}

/** queryFn stub: emits one assistant message carrying `text`, optionally held by `gate`. */
function aiReply(text, gate = Promise.resolve()) {
  return () => (async function* generate() {
    await gate;
    yield { type: 'assistant', message: { content: [{ type: 'text', text }] } };
  })();
}

test('rejects a concurrent scan for the same direction', async () => {
  await withDatabase(async (db, assetDir) => {
    let release;
    const gate = new Promise((resolveGate) => { release = resolveGate; });
    const scanner = createPipeline({ db, queryFn: aiReply('[]', gate), assetDir });
    const dir = createDirection(db, { name: 'AI' });

    const first = scanner.scanDirection(dir.id);
    await assert.rejects(scanner.scanDirection(dir.id), /正在扫描中/);

    release();
    const result = await first;
    assert.equal(result.count, 0);

    // After the scan finishes, the direction can be scanned again.
    await scanner.scanDirection(dir.id);
  });
});

test('drops malformed items but keeps valid ones and marks the scan done', async () => {
  await withDatabase(async (db, assetDir) => {
    const payload = JSON.stringify([
      { sourceSummary: '', aiEventName: '缺摘要的坏条目' },
      { sourceSummary: '星舰第七次试飞定于下月', aiEventName: '星舰试飞', aiEventStartDate: '2026-09-01' },
    ]);
    const scanner = createPipeline({ db, queryFn: aiReply(payload), assetDir });
    const dir = createDirection(db, { name: '商业航天' });

    const result = await scanner.scanDirection(dir.id);
    assert.equal(result.count, 1);

    const inbox = listInboxItems(db);
    assert.equal(inbox.length, 1);
    assert.equal(inbox[0].sourceSummary, '星舰第七次试飞定于下月');
    assert.equal(inbox[0].domain, 'stock');

    // Partial failure must not erase the scan record — otherwise the next
    // polling tick would rescan and duplicate the already-saved items.
    const after = listDirections(db).find((d) => d.id === dir.id);
    assert.ok(after.lastScannedAt);
  });
});

test('未配置的板块直接报错，不静默跑空', async () => {
  await withDatabase(async (db, assetDir) => {
    const scanner = createPipeline({ db, queryFn: aiReply('[]'), assetDir });
    const dir = createDirection(db, { name: '机器人', domain: 'robotics' });

    await assert.rejects(scanner.scanDirection(dir.id), /板块 "robotics" 未配置/);
  });
});

test('板块目录只写差异项：prompt/skill 回落 _default，参数覆盖缺省值', async () => {
  await withDatabase(async (db, assetDir) => {
    let captured = null;
    const queryFn = (args) => {
      captured = args;
      return (async function* generate() {
        yield { type: 'assistant', message: { content: [{ type: 'text', text: '[{"sourceSummary":"星舰试飞定于下月","aiEventName":"星舰试飞"}]' }] } };
      })();
    };
    const scanner = createPipeline({ db, queryFn, assetDir });
    const dir = createDirection(db, { name: '商业航天', domain: 'aerospace' });
    const result = await scanner.scanDirection(dir.id);

    // aerospace 没有自己的 prompt.md/skill.md，内容来自 _default
    assert.match(captured.prompt, /题材：商业航天/);
    assert.match(captured.options.systemPrompt.append, /你是测试用扫描助手/);
    // maxTurns 继承自 _default
    assert.equal(captured.options.maxTurns, 1);
    // 但收件箱条目归属真实板块，而非 stock
    assert.equal(result.domain, 'aerospace');
    assert.equal(listInboxItems(db)[0].domain, 'aerospace');
  });
});

test('listDomains 只返回真实板块，_default 不对外暴露', async () => {
  await withDatabase(async (db, assetDir) => {
    const scanner = createPipeline({ db, queryFn: aiReply('[]'), assetDir });
    const domains = await scanner.listDomains();

    assert.deepEqual(domains.map((d) => d.key), ['aerospace']);
    // 差异项生效，其余字段继承缺省值
    assert.equal(domains[0].ambushDays, 45);
    assert.equal(domains[0].name, '航天');
  });
});

test('systemPrompt 来自 skill.md，且不使用 SDK 的 Skill 工具', async () => {
  await withDatabase(async (db, assetDir) => {
    let captured = null;
    const queryFn = (args) => {
      captured = args;
      return (async function* generate() {
        yield { type: 'assistant', message: { content: [{ type: 'text', text: '[]' }] } };
      })();
    };
    const scanner = createPipeline({ db, queryFn, assetDir });
    const dir = createDirection(db, { name: '商业航天' });
    await scanner.scanDirection(dir.id);

    // skill.md 正文进了 systemPrompt，frontmatter 被剔除
    assert.equal(captured.options.systemPrompt.type, 'preset');
    assert.match(captured.options.systemPrompt.append, /你是测试用扫描助手/);
    assert.doesNotMatch(captured.options.systemPrompt.append, /name: stock-scan/);

    // 不再依赖 SDK 的 skills 选项（传空数组等于显式禁用全部 skill）
    assert.equal(captured.options.skills, undefined);

    // prompt.md 的变量已被真实值替换
    assert.match(captured.prompt, /题材：商业航天/);
    assert.doesNotMatch(captured.prompt, /\{\{/);
  });
});
