import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const files = [
  'src/pages/Thoughts.tsx',
  'src/pages/Career.tsx',
  'src/pages/Projects.tsx',
  'src/components/investment/KnowledgeList.tsx',
  'src/components/investment/ReviewTimeline.tsx',
];

const remoteRuntimePattern = new RegExp([
  ['supa', 'base'].join(''),
  'mock[A-Z]',
  `${['one', 'day'].join('')}cloud`,
].join('|'));
const privateCareerPattern = new RegExp([
  ['sal', 'ary'].join(''),
  'compensation',
  'PASSWORD',
  'showPasswordModal',
  'DollarSign',
  'Lock',
  'Eye',
].join('|'));

test('record pages use the local API without silent mock fallback', async () => {
  for (const file of files) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, remoteRuntimePattern);
  }
  const career = await readFile('src/pages/Career.tsx', 'utf8');
  assert.doesNotMatch(
    career,
    privateCareerPattern,
  );
});

test('record hook resets stale state and derives payload types from the domain', async () => {
  const types = await readFile('src/api/types.ts', 'utf8');
  const client = await readFile('src/api/client.ts', 'utf8');
  const hook = await readFile('src/hooks/useRecords.ts', 'utf8');
  const career = await readFile('src/pages/Career.tsx', 'utf8');
  const projects = await readFile('src/pages/Projects.tsx', 'utf8');

  assert.match(
    hook,
    /setData\(\[\]\);\s*setError\(null\);\s*setLoading\(true\);/,
  );
  assert.match(
    types,
    /interface RecordPayloadMap\s*{[\s\S]*career: CareerPayload;[\s\S]*project: ProjectPayload;/,
  );
  assert.match(client, /listRecords<TDomain extends RecordDomain>/);
  assert.match(hook, /useRecords<TDomain extends RecordDomain>/);
  assert.doesNotMatch(client, /listRecords<TPayload/);
  assert.doesNotMatch(hook, /useRecords<TPayload/);
  assert.match(career, /useRecords\('career'\)/);
  assert.match(projects, /useRecords\('project'\)/);
});

test('request turns invalid HTTP envelopes into safe ApiError failures', async () => {
  const { ApiError, request } = await loadClient();
  const cases = [
    {
      response: { ok: true, json: async () => { throw new SyntaxError('invalid json'); } },
      message: '本地服务返回无效数据',
    },
    {
      response: { ok: false, json: async () => { throw new SyntaxError('empty body'); } },
      message: '本地服务不可用',
    },
    {
      response: { ok: true, json: async () => null },
      message: '本地服务返回无效数据',
    },
    {
      response: { ok: true, json: async () => ({}) },
      message: '本地服务返回无效数据',
    },
    {
      response: { ok: true, json: async () => ({ data: null }) },
      message: '本地服务返回无效数据',
    },
    {
      response: {
        ok: false,
        json: async () => ({ error: { message: '记录不存在' } }),
      },
      message: '记录不存在',
    },
  ];

  for (const item of cases) {
    await withFetch(async () => item.response, async () => {
      await assert.rejects(
        request('/api/test'),
        (error) => error instanceof ApiError && error.message === item.message,
      );
    });
  }
});

test('listRecords validates and sanitizes domain payloads before returning them', async () => {
  const { ApiError, listRecords } = await loadClient();
  const careerPayload = {
    companyAlias: 'A公司',
    position: '质量工程师',
    startDate: '2024-01-01',
    endDate: null,
    responsibilities: '负责质量保障',
    projects: ['评测平台'],
    isCurrent: true,
    unexpected: 'must not leave the API boundary',
  };

  const sanitized = await withJsonData(
    [record('career', 'experience', careerPayload)],
    () => listRecords('career'),
  );
  assert.deepEqual(sanitized[0].payload, {
    companyAlias: 'A公司',
    position: '质量工程师',
    startDate: '2024-01-01',
    endDate: null,
    responsibilities: '负责质量保障',
    projects: ['评测平台'],
    isCurrent: true,
  });

  await withJsonData(
    [record('career', 'experience', { ...careerPayload, companyAlias: 'X公司' })],
    async () => {
      await assert.rejects(
        listRecords('career'),
        (error) => error instanceof ApiError && error.message === '本地服务返回无效数据',
      );
    },
  );

  await withJsonData(
    [record('project', 'project', {
      techStack: 'TypeScript',
      repositoryUrl: null,
      demoUrl: null,
      currentFocus: '',
    })],
    async () => {
      await assert.rejects(
        listRecords('project'),
        (error) => error instanceof ApiError && error.message === '本地服务返回无效数据',
      );
    },
  );

  await withJsonData(
    [record('project', 'project', {
      techStack: ['TypeScript'],
      repositoryUrl: 'javascript:alert(1)',
      demoUrl: null,
      currentFocus: '',
    })],
    async () => {
      await assert.rejects(
        listRecords('project'),
        (error) => error instanceof ApiError && error.message === '本地服务返回无效数据',
      );
    },
  );

  const malformedCommonRecord = record('thought', 'idea', {});
  malformedCommonRecord.tags = 'not-an-array';
  await withJsonData([malformedCommonRecord], async () => {
    await assert.rejects(
      listRecords('thought'),
      (error) => error instanceof ApiError && error.message === '本地服务返回无效数据',
    );
  });
});

test('career and project pages preserve the approved vintage card skeleton', async () => {
  const career = await readFile('src/pages/Career.tsx', 'utf8');
  const projects = await readFile('src/pages/Projects.tsx', 'utf8');

  assert.match(career, /format\(new Date\(payload\.startDate\), 'yyyyMM'\)/);
  assert.match(career, /payload\.projects\.map/);
  assert.match(projects, /aria-hidden="true"/);
  assert.match(projects, /mb-4 -mx-6 -mt-6 h-48/);
  assert.doesNotMatch(projects, /<img|https?:\/\//);
});

let clientModule;

async function loadClient() {
  if (!clientModule) {
    const source = await readFile('src/api/client.ts', 'utf8');
    const compiled = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ESNext,
        target: ts.ScriptTarget.ES2020,
      },
    }).outputText;
    const url = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`;
    clientModule = import(url);
  }
  return clientModule;
}

async function withFetch(fakeFetch, action) {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = fakeFetch;
  try {
    return await action();
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function withJsonData(data, action) {
  return withFetch(
    async () => ({ ok: true, json: async () => ({ data }) }),
    action,
  );
}

function record(domain, type, payload) {
  return {
    id: `${domain}:one`,
    domain,
    type,
    title: '记录标题',
    content: '记录内容',
    status: 'active',
    occurredAt: null,
    tags: [],
    payload,
    sourceRef: null,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
  };
}
