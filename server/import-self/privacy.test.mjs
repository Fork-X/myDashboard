import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  loadImportMap,
  normalizeSourceRef,
  redactText,
  validatePersistable,
} from './privacy.mjs';

const emptyMap = {
  topicDomains: {},
  goalTopics: {},
  careerAliases: {},
  redactions: {},
  blockedTerms: [],
};

const map = {
  careerAliases: { 示例来源公司一: 'A公司' },
  redactions: { 示例真实姓名: '匿名用户' },
  blockedTerms: ['示例禁止发布词'],
};

async function withImportMap(contents, callback) {
  const directory = await mkdtemp(join(tmpdir(), 'my-dashboard-import-map-'));
  const filename = join(directory, 'import-map.json');

  try {
    await writeFile(
      filename,
      typeof contents === 'string' ? contents : JSON.stringify(contents),
      'utf8',
    );
    await callback(filename);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function captureError(callback) {
  try {
    callback();
  } catch (error) {
    return error;
  }

  assert.fail('Expected callback to throw');
}

test('redacts aliases and names before persistence', () => {
  assert.equal(
    redactText('示例真实姓名曾在示例来源公司一任职', map),
    '匿名用户曾在A公司任职',
  );
});

test('redacts merged source strings longest-first', () => {
  assert.equal(
    redactText('示例来源公司一与示例来源公司', {
      careerAliases: {
        示例来源公司: 'A公司',
        示例来源公司一: 'Y公司',
      },
      redactions: {
        示例来源公司一成员: '匿名成员',
      },
    }),
    'Y公司与A公司',
  );
  assert.equal(
    redactText('示例来源公司一成员', {
      careerAliases: { 示例来源公司一: 'H公司' },
      redactions: { 示例来源公司一成员: '匿名成员' },
    }),
    '匿名成员',
  );
});

test('coerces nullish redaction input to an empty string', () => {
  assert.equal(redactText(null, map), '');
  assert.equal(redactText(undefined, map), '');
});

test('rejects career aliases outside the privacy-safe allowlist', () => {
  assert.throws(
    () =>
      redactText('示例来源公司四', {
        careerAliases: { 示例来源公司四: 'B公司' },
      }),
    /career alias target/,
  );
});

test('keeps only normalized relative POSIX source references', () => {
  assert.equal(normalizeSourceRef('30_知识\\示例.md'), '30_知识/示例.md');
  assert.equal(normalizeSourceRef('./30_知识//示例.md'), '30_知识/示例.md');
});

test('rejects empty, absolute, drive-letter, URL, and parent source references', () => {
  for (const value of [
    '',
    '   ',
    '/Users/example/private.md',
    'C:\\private.md',
    'https://example.invalid/private.md',
    '//example.invalid/private.md',
    '../private.md',
    '30_知识/../private.md',
  ]) {
    assert.throws(() => normalizeSourceRef(value), /relative/);
  }
});

test('rejects compensation without echoing the sensitive match', () => {
  const error = captureError(() =>
    validatePersistable({ content: '候选人年薪信息' }, map),
  );

  assert.match(error.message, /compensation/);
  assert.doesNotMatch(error.message, /年薪/);
});

test('rejects configured blocked terms without echoing the sensitive match', () => {
  const error = captureError(() =>
    validatePersistable({ content: '示例禁止发布词' }, map),
  );

  assert.match(error.message, /blocked term/);
  assert.doesNotMatch(error.message, /示例禁止发布词/);
});

test('ignores empty configured blocked terms', () => {
  assert.doesNotThrow(() =>
    validatePersistable(
      { content: 'already redacted content' },
      { blockedTerms: ['', '   '] },
    ),
  );
});

test('loads an empty map by default', async () => {
  assert.deepEqual(await loadImportMap(), emptyMap);
});

test('loads a fully configured synthetic map', async () => {
  const configuredMap = {
    topicDomains: {
      'topic-investment': 'investment',
      'topic-thought': 'thought',
      'topic-career': 'career',
    },
    goalTopics: {
      'topic-year-goal': 'year',
      'topic-month-goal': 'month',
    },
    careerAliases: {
      示例来源公司一: 'A公司',
      示例来源公司二: 'Y公司',
      示例来源公司三: 'H公司',
    },
    redactions: {
      示例真实姓名: '匿名用户',
    },
    blockedTerms: ['示例禁止发布词'],
  };

  await withImportMap(configuredMap, async (filename) => {
    assert.deepEqual(await loadImportMap(filename), configuredMap);
  });
});

test('rejects a configured domain outside the allowed enum', async () => {
  await withImportMap(
    { topicDomains: { 'topic-invalid': 'invalid' } },
    async (filename) => {
      await assert.rejects(
        () => loadImportMap(filename),
        /topicDomains values must be investment, thought, or career/,
      );
    },
  );
});

test('strictly validates every configured import-map field', async () => {
  const invalidMaps = [
    [{ topicDomains: [] }, /topicDomains must be an object/],
    [{ goalTopics: [] }, /goalTopics must be an object/],
    [
      { goalTopics: { 'topic-quarter-goal': 'quarter' } },
      /goalTopics values must be year or month/,
    ],
    [{ careerAliases: [] }, /careerAliases must be an object/],
    [
      { careerAliases: { 示例来源公司四: 'B公司' } },
      /careerAliases values must be A公司, Y公司, or H公司/,
    ],
    [{ redactions: [] }, /redactions must be an object/],
    [
      { redactions: { 示例真实姓名: 42 } },
      /redactions values must be strings/,
    ],
    [{ blockedTerms: {} }, /blockedTerms must be an array of strings/],
    [{ blockedTerms: [42] }, /blockedTerms must be an array of strings/],
  ];

  for (const [invalidMap, expectedError] of invalidMaps) {
    await withImportMap(invalidMap, async (filename) => {
      await assert.rejects(() => loadImportMap(filename), expectedError);
    });
  }
});

test('rejects invalid JSON and unknown top-level keys', async () => {
  await withImportMap('{', async (filename) => {
    await assert.rejects(() => loadImportMap(filename), /JSON/);
  });
  await withImportMap({ blockedTerm: ['misspelled'] }, async (filename) => {
    await assert.rejects(() => loadImportMap(filename), /unknown top-level key/);
  });
  await withImportMap([], async (filename) => {
    await assert.rejects(() => loadImportMap(filename), /top-level object/);
  });
});
