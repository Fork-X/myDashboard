import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

const taskComponents = [
  'src/components/todos/GoalsList.tsx',
  'src/components/todos/TodoList.tsx',
];

const remoteRuntimePattern = new RegExp([
  ['supa', 'base'].join(''),
  'mockGoals',
  `${['one', 'day'].join('')}cloud`,
].join('|'));

test('goal and todo pages use local task API only', async () => {
  for (const file of taskComponents) {
    const source = await readFile(file, 'utf8');
    assert.doesNotMatch(source, remoteRuntimePattern);
  }
});

test('task client uses the local routes and encodes task ids', async () => {
  const { createTask, listTasks, patchTask } = await loadClient();
  const calls = [];
  const task = validTask();
  const todo = { ...task, id: 'todo:one', kind: 'todo', period: null };

  await withFetch(async (path, init) => {
    calls.push({ path, init });
    return { ok: true, json: async () => ({ data: path === '/api/tasks?kind=goal' ? [task] : todo }) };
  }, async () => {
    await listTasks('goal');
    await createTask({ title: '本地待办', description: '只写本机' });
    await patchTask('todo/有 空格', 'completed');
  });

  assert.equal(calls[0].path, '/api/tasks?kind=goal');
  assert.equal(calls[0].init.method, undefined);
  assert.equal(calls[1].path, '/api/tasks');
  assert.equal(calls[1].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[1].init.body), {
    title: '本地待办',
    description: '只写本机',
  });
  assert.equal(calls[2].path, '/api/tasks/todo%2F%E6%9C%89%20%E7%A9%BA%E6%A0%BC');
  assert.equal(calls[2].init.method, 'PATCH');
  assert.deepEqual(JSON.parse(calls[2].init.body), { status: 'completed' });
});

test('task client validates task kind, enums, periods, and dates', async () => {
  const { ApiError, listTasks } = await loadClient();
  const malformedTasks = [
    { ...validTask(), kind: 'todo' },
    { ...validTask(), period: 'week' },
    { ...validTask(), status: 'done' },
    { ...validTask(), targetAt: 'not-a-date' },
    { ...validTask(), completedAt: 'not-a-date' },
    { ...validTask(), createdAt: 'not-a-date' },
    { ...validTask(), updatedAt: 'not-a-date' },
  ];

  for (const task of malformedTasks) {
    await withJsonData([task], async () => {
      await assert.rejects(
        listTasks('goal'),
        (error) => error instanceof ApiError && error.message === '本地服务返回无效数据',
      );
    });
  }

  await withJsonData([{ ...validTask(), kind: 'todo', period: null }], async () => {
    const tasks = await listTasks('todo');
    assert.deepEqual(tasks, [{ ...validTask(), kind: 'todo', period: null }]);
  });
});

test('task hook refreshes after mutations without optimistic task writes', async () => {
  const hook = await readFile('src/hooks/useTasks.ts', 'utf8');

  assert.match(hook, /await createTask\(input\)/);
  assert.match(hook, /await patchTask\(id, status\)/);
  assert.match(hook, /await listTasks\(/);
  assert.doesNotMatch(hook, /setData\([^;]*(?:input|status|id)/);
  assert.match(hook, /setError\(null\)/);
  assert.match(hook, /return \(\) => \{[\s\S]*false/);
});

test('persisted create resolves and reports a distinct refresh failure', async () => {
  let listCalls = 0;
  let createCalls = 0;
  const runtime = await loadUseTasks({
    listTasks: async () => {
      listCalls += 1;
      if (listCalls === 1) return [];
      throw new TestApiError('本地服务不可用');
    },
    createTask: async () => {
      createCalls += 1;
      return validTask();
    },
  });

  runtime.render('todo');
  await flushAsync();
  const mutation = runtime.render('todo').add({
    title: '已落库任务',
    description: '',
  });

  await assert.doesNotReject(mutation);
  const state = runtime.render('todo');
  assert.equal(createCalls, 1);
  assert.equal(state.error, '任务已保存，但列表刷新失败');
});

test('a mutation from an old kind cannot launch or apply an old-kind refresh', async () => {
  const create = deferred();
  const listKinds = [];
  const runtime = await loadUseTasks({
    listTasks: async (kind) => {
      listKinds.push(kind);
      return [{ marker: kind }];
    },
    createTask: () => create.promise,
  });

  runtime.render('todo');
  await flushAsync();
  const mutation = runtime.render('todo').add({ title: '切换前任务', description: '' });

  runtime.render('goal');
  await flushAsync();
  create.resolve(validTask());
  await mutation;
  await flushAsync();

  const state = runtime.render('goal');
  assert.deepEqual(listKinds, ['todo', 'goal']);
  assert.deepEqual(state.data, [{ marker: 'goal' }]);
});

test('the hook rejects a concurrent mutation before it starts', async () => {
  const create = deferred();
  let patchCalls = 0;
  const runtime = await loadUseTasks({
    listTasks: async () => [],
    createTask: () => create.promise,
    patchTask: async () => {
      patchCalls += 1;
      return validTask();
    },
  });

  runtime.render('todo');
  await flushAsync();
  const state = runtime.render('todo');
  const first = state.add({ title: '第一个写入', description: '' });
  const second = state.setStatus('todo:one', 'completed').catch((error) => error);
  await flushAsync();

  assert.equal(patchCalls, 0);
  assert.equal((await second).message, '任务操作正在进行中');
  create.resolve(validTask());
  await first;
});

test('an older mutation failure cannot overwrite the newer lock error', async () => {
  const create = deferred();
  const patch = deferred();
  let patchCalls = 0;
  const runtime = await loadUseTasks({
    listTasks: async () => [],
    createTask: () => create.promise,
    patchTask: () => {
      patchCalls += 1;
      return patch.promise;
    },
  });

  runtime.render('todo');
  await flushAsync();
  const state = runtime.render('todo');
  const older = state.add({ title: '较早写入', description: '' }).catch((error) => error);
  const newer = state.setStatus('todo:one', 'completed').catch((error) => error);
  await flushAsync();

  if (patchCalls > 0) patch.reject(new TestApiError('较新的状态失败'));
  await newer;
  create.reject(new TestApiError('较早的新增失败'));
  await older;

  assert.equal(patchCalls, 0);
  assert.equal(runtime.render('todo').error, '任务操作正在进行中');
});

test('todo load failures do not also claim that the task list is empty', async () => {
  const todo = await readFile('src/components/todos/TodoList.tsx', 'utf8');
  assert.match(todo, /todos\.length === 0 && !error/);
});

test('todo uses one mutation gate and guards post-await state after unmount', async () => {
  const todo = await readFile('src/components/todos/TodoList.tsx', 'utf8');

  assert.match(todo, /const \[mutationBusy, setMutationBusy\] = useState\(false\)/);
  assert.match(todo, /mutationBusyRef\.current/);
  assert.match(todo, /mounted\.current = false/);
  assert.match(todo, /if \(mounted\.current\) \{[\s\S]*setNewTodoTitle\(''\)/);
  assert.ok(todo.match(/disabled=\{mutationBusy\}/g)?.length >= 4);
  assert.match(todo, /disabled=\{mutationBusy \|\| !newTodoTitle\.trim\(\)\}/);
});

let clientModule;
let hookModuleSequence = 0;

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

function validTask() {
  return {
    id: 'goal:year:one',
    kind: 'goal',
    period: 'year',
    title: '年度目标',
    description: '完成本地迁移',
    status: 'in_progress',
    targetAt: '2026-12-31T00:00:00.000Z',
    completedAt: null,
    sourceRef: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-07-31T00:00:00.000Z',
  };
}

class TestApiError extends Error {}

async function loadUseTasks(overrides) {
  const harness = createReactHarness();
  const source = await readFile('src/hooks/useTasks.ts', 'utf8');
  const injected = source
    .replace(
      "import { useCallback, useEffect, useRef, useState } from 'react';",
      'const { useCallback, useEffect, useRef, useState } = globalThis.__taskReact;',
    )
    .replace(
      "import { ApiError, createTask, listTasks, patchTask } from '../api/client';",
      'const { ApiError, createTask, listTasks, patchTask } = globalThis.__taskClient;',
    );
  const compiled = ts.transpileModule(injected, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  globalThis.__taskReact = harness.hooks;
  globalThis.__taskClient = {
    ApiError: TestApiError,
    createTask: async () => validTask(),
    listTasks: async () => [],
    patchTask: async () => validTask(),
    ...overrides,
  };
  const url = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}#hook-${hookModuleSequence++}`;
  const { useTasks } = await import(url);
  return {
    render(kind) {
      return harness.render(() => useTasks(kind));
    },
    unmount: harness.unmount,
  };
}

function createReactHarness() {
  const slots = [];
  let cursor = 0;
  let pendingEffects = [];

  const hooks = {
    useState(initial) {
      const index = cursor++;
      if (!slots[index]) {
        slots[index] = {
          kind: 'state',
          value: typeof initial === 'function' ? initial() : initial,
        };
      }
      const slot = slots[index];
      return [
        slot.value,
        (next) => {
          slot.value = typeof next === 'function' ? next(slot.value) : next;
        },
      ];
    },
    useRef(initial) {
      const index = cursor++;
      if (!slots[index]) {
        slots[index] = { kind: 'ref', value: { current: initial } };
      }
      return slots[index].value;
    },
    useCallback(callback, dependencies) {
      const index = cursor++;
      const slot = slots[index];
      if (!slot || dependenciesChanged(slot.dependencies, dependencies)) {
        slots[index] = {
          kind: 'callback',
          value: callback,
          dependencies: [...dependencies],
        };
      }
      return slots[index].value;
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const slot = slots[index];
      if (!slot || dependenciesChanged(slot.dependencies, dependencies)) {
        pendingEffects.push({ effect, index, dependencies: [...dependencies] });
      }
    },
  };

  function render(renderHook) {
    cursor = 0;
    pendingEffects = [];
    const value = renderHook();
    for (const pending of pendingEffects) {
      const previous = slots[pending.index];
      if (previous?.cleanup) previous.cleanup();
      slots[pending.index] = {
        kind: 'effect',
        cleanup: pending.effect(),
        dependencies: pending.dependencies,
      };
    }
    return value;
  }

  function unmount() {
    for (const slot of slots) {
      if (slot?.kind === 'effect' && slot.cleanup) slot.cleanup();
    }
  }

  return { hooks, render, unmount };
}

function dependenciesChanged(previous, next) {
  return !previous
    || previous.length !== next.length
    || previous.some((item, index) => !Object.is(item, next[index]));
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

async function flushAsync() {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
  }
}
