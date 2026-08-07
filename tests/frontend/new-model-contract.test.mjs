import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import ts from 'typescript';

const clientPath = new URL('../../src/api/client.ts', import.meta.url);
const typesPath = new URL('../../src/api/types.ts', import.meta.url);
const hooks = {
  thoughts: new URL('../../src/hooks/useThoughts.ts', import.meta.url),
  goals: new URL('../../src/hooks/useGoals.ts', import.meta.url),
  todos: new URL('../../src/hooks/useTodos.ts', import.meta.url),
};

const createdAt = '2026-08-04T02:00:00.000Z';
const updatedAt = '2026-08-05T02:00:00.000Z';
const thought = {
  id: 'thought/one',
  title: '思考',
  content: '正文',
  tags: ['明确'],
  createdAt,
};
const progress = {
  id: 'progress/one',
  goalId: 'goal/one',
  content: '进展',
  createdAt,
};
const goal = {
  id: 'goal/one',
  title: '持续目标',
  description: '说明',
  status: 'active',
  createdAt,
  updatedAt,
  progress: [progress],
};
const todo = {
  id: 'todo/one',
  title: '事项',
  status: 'pending',
  isImportant: true,
  isUrgent: false,
  tags: ['工作'],
  createdAt,
  completedAt: null,
};

const conversation = {
  id: 'chat/one',
  title: '对话',
  createdAt,
  updatedAt,
  messageCount: 1,
};
const message = {
  id: 'msg/one',
  conversationId: 'chat/one',
  role: 'user',
  content: '你好',
  thinking: null,
  createdAt,
};
const draft = {
  shouldSave: true,
  title: '标题',
  content: '正文',
  tags: ['决策'],
};

test('declares the exact independent model and append-only thought contract', async () => {
  const [clientSource, typesSource, thoughtHook, goalHook, todoHook] = await Promise.all([
    readFile(clientPath, 'utf8'),
    readFile(typesPath, 'utf8'),
    readFile(hooks.thoughts, 'utf8'),
    readFile(hooks.goals, 'utf8'),
    readFile(hooks.todos, 'utf8'),
  ]);

  assert.match(typesSource, /export type GoalStatus = 'active' \| 'paused' \| 'completed' \| 'abandoned';/);
  assert.match(typesSource, /export type TodoStatus = 'pending' \| 'in_progress' \| 'completed' \| 'cancelled';/);
  for (const name of ['ThoughtItem', 'GoalProgressItem', 'GoalItem', 'TodoItem']) {
    assert.match(typesSource, new RegExp(`export interface ${name}\\b`));
  }

  assert.match(clientSource, /export function createThought/);
  assert.doesNotMatch(clientSource, /updateThought|deleteThought/);
  assert.match(clientSource, /export function listThoughts/);
  assert.match(clientSource, /export function appendGoalProgress/);
  assert.match(clientSource, /export function deleteTodo/);

  assert.match(thoughtHook, /export function useThoughts\(\)/);
  assert.doesNotMatch(thoughtHook, /create|update|remove|delete|mutat/i);
  assert.match(goalHook, /return \{ data, loading, error, load, create, update, remove, appendProgress \};/);
  assert.match(todoHook, /return \{ data, loading, error, load, create, update, remove \};/);
  for (const source of [goalHook, todoHook]) {
    assert.match(source, /generation/);
    assert.match(source, /mutationLock/);
    assert.match(source, /MUTATION_BUSY_MESSAGE/);
  }
});

test('uses the exact Task 2-4 routes, methods, bodies, and encoded IDs', async () => {
  const responses = [
    [thought],
    [goal],
    goal,
    { ...goal, status: 'paused' },
    goal,
    progress,
    [todo],
    todo,
    { ...todo, status: 'completed', completedAt: updatedAt },
    todo,
  ];
  const { client, calls } = await loadClient(responses.map(ok));

  assert.deepEqual(await client.listThoughts(), [thought]);
  assert.deepEqual(await client.listGoals(), [goal]);
  assert.deepEqual(await client.createGoal({ title: '持续目标', description: '说明' }), goal);
  assert.equal((await client.updateGoal('goal/one', { status: 'paused' })).status, 'paused');
  assert.deepEqual(await client.deleteGoal('goal/one'), goal);
  assert.deepEqual(await client.appendGoalProgress('goal/one', { content: '进展' }), progress);
  assert.deepEqual(await client.listTodos(), [todo]);
  assert.deepEqual(await client.createTodo({ title: '事项' }), todo);
  assert.equal((await client.updateTodo('todo/one', { status: 'completed' })).status, 'completed');
  assert.deepEqual(await client.deleteTodo('todo/one'), todo);

  assert.deepEqual(calls, [
    ['/api/thoughts', {}],
    ['/api/goals', {}],
    ['/api/goals', jsonInit('POST', { title: '持续目标', description: '说明' })],
    ['/api/goals/goal%2Fone', jsonInit('PATCH', { status: 'paused' })],
    ['/api/goals/goal%2Fone', { method: 'DELETE' }],
    ['/api/goals/goal%2Fone/progress', jsonInit('POST', { content: '进展' })],
    ['/api/todos', {}],
    ['/api/todos', jsonInit('POST', { title: '事项' })],
    ['/api/todos/todo%2Fone', jsonInit('PATCH', { status: 'completed' })],
    ['/api/todos/todo%2Fone', { method: 'DELETE' }],
  ]);
});

test('uses the exact chat, distill, and thought-creation routes and bodies', async () => {
  const detail = { ...conversation, messages: [message] };
  const emptyDraft = { shouldSave: false, reason: '没有精华' };
  const responses = [
    [conversation],
    conversation,
    detail,
    conversation,
    message,
    thought,
    draft,
    emptyDraft,
  ];
  const { client, calls } = await loadClient(responses.map(ok));

  assert.deepEqual(await client.listConversations(), [conversation]);
  assert.deepEqual(await client.createConversation(), conversation);
  assert.deepEqual(await client.getConversation('chat/one'), detail);
  assert.deepEqual(await client.deleteConversation('chat/one'), conversation);
  assert.deepEqual(await client.sendChatMessage('chat/one', '你好'), message);
  assert.deepEqual(
    await client.createThought({ title: thought.title, content: thought.content, tags: thought.tags }),
    thought,
  );
  assert.deepEqual(await client.distillConversation('chat/one', '决策'), draft);
  assert.deepEqual(await client.distillConversation('chat/one'), emptyDraft);

  assert.deepEqual(calls, [
    ['/api/chats', {}],
    ['/api/chats', jsonInit('POST', {})],
    ['/api/chats/chat%2Fone', {}],
    ['/api/chats/chat%2Fone', { method: 'DELETE' }],
    ['/api/chats/chat%2Fone/messages', jsonInit('POST', { content: '你好' })],
    ['/api/thoughts', jsonInit('POST', {
      title: thought.title,
      content: thought.content,
      tags: thought.tags,
    })],
    ['/api/chats/chat%2Fone/distill', jsonInit('POST', { focus: '决策' })],
    ['/api/chats/chat%2Fone/distill', jsonInit('POST', {})],
  ]);
});

test('strictly rejects invalid statuses, booleans, tags, and dates', async () => {
  const invalidCases = [
    ['listThoughts', [{ ...thought, tags: ['明确', 1] }]],
    ['listThoughts', [{ ...thought, createdAt: 'not-a-date' }]],
    ['listGoals', [{ ...goal, status: 'unknown' }]],
    ['listGoals', [{ ...goal, updatedAt: 'not-a-date' }]],
    ['listGoals', [{ ...goal, progress: [{ ...progress, createdAt: 'not-a-date' }] }]],
    ['listTodos', [{ ...todo, status: 'unknown' }]],
    ['listTodos', [{ ...todo, isImportant: 1 }]],
    ['listTodos', [{ ...todo, isUrgent: 'false' }]],
    ['listTodos', [{ ...todo, tags: ['工作', null] }]],
    ['listTodos', [{ ...todo, createdAt: 'not-a-date' }]],
    ['listTodos', [{ ...todo, completedAt: 'not-a-date' }]],
    ['listConversations', [{ ...conversation, messageCount: '1' }]],
    ['listConversations', [{ ...conversation, updatedAt: 'not-a-date' }]],
    ['sendChatMessage', [{ ...message, role: 'system' }]],
    ['sendChatMessage', [{ ...message, thinking: 1 }]],
    ['distillConversation', [{ shouldSave: 'yes' }]],
    ['distillConversation', [{ ...draft, tags: undefined }]],
    ['distillConversation', [{ shouldSave: false }]],
  ];

  for (const [method, data] of invalidCases) {
    const { client } = await loadClient([ok(data)]);
    await assert.rejects(() => client[method](), {
      name: 'ApiError',
      message: '本地服务返回无效数据',
    });
  }
});

test('preserves the safe request error envelope', async () => {
  const unavailable = await loadClient([new Error('network details')]);
  await assert.rejects(() => unavailable.client.listThoughts(), {
    name: 'ApiError',
    message: '本地服务不可用',
  });

  const serverError = await loadClient([{
    ok: false,
    async json() {
      return { error: { code: 'INVALID_REQUEST', message: '已有进展的目标不能删除' } };
    },
  }]);
  await assert.rejects(() => serverError.client.deleteGoal('goal/one'), {
    name: 'ApiError',
    message: '已有进展的目标不能删除',
  });

  const nullData = await loadClient([ok(null)]);
  await assert.rejects(() => nullData.client.listTodos(), {
    name: 'ApiError',
    message: '本地服务返回无效数据',
  });
});

test('mutation hooks refresh after writes and preserve visible concurrent-operation errors', async () => {
  await assertMutationHookContract({
    hookPath: hooks.goals,
    exportName: 'useGoals',
    listName: 'listGoals',
    createName: 'createGoal',
    updateName: 'updateGoal',
    deleteName: 'deleteGoal',
    item: goal,
    busyMessage: '目标操作正在进行中',
    createInput: { title: goal.title },
    updateInput: [goal.id, { status: 'paused' }],
  });
  await assertMutationHookContract({
    hookPath: hooks.todos,
    exportName: 'useTodos',
    listName: 'listTodos',
    createName: 'createTodo',
    updateName: 'updateTodo',
    deleteName: 'deleteTodo',
    item: todo,
    busyMessage: 'TODO 操作正在进行中',
    createInput: { title: todo.title },
    updateInput: [todo.id, { status: 'completed' }],
  });
});

function ok(data) {
  return {
    ok: true,
    async json() {
      return { data };
    },
  };
}

function jsonInit(method, body) {
  return { method, body: JSON.stringify(body) };
}

async function loadClient(responses) {
  const source = await readFile(clientPath, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: 'client.ts',
  }).outputText;
  const calls = [];
  const queue = [...responses];
  const fetch = async (path, init) => {
    calls.push([path, stripHeaders(init)]);
    const response = queue.shift();
    if (response instanceof Error) throw response;
    assert.ok(response, `unexpected fetch call to ${path}`);
    return response;
  };
  const module = { exports: {} };
  const evaluate = new Function('module', 'exports', 'require', 'fetch', output);
  evaluate(module, module.exports, () => {
    throw new Error('client runtime must not require another module');
  }, fetch);
  return { client: module.exports, calls };
}

async function assertMutationHookContract({
  hookPath,
  exportName,
  listName,
  createName,
  updateName,
  deleteName,
  item,
  busyMessage,
  createInput,
  updateInput,
}) {
  class StubApiError extends Error {
    constructor(message) {
      super(message);
      this.name = 'ApiError';
    }
  }

  const pendingUpdate = deferred();
  const listResponses = [
    () => Promise.resolve([]),
    () => Promise.resolve([item]),
    () => Promise.reject(new StubApiError('旧刷新失败')),
  ];
  let deleteCalls = 0;
  const api = {
    ApiError: StubApiError,
    [listName]: () => {
      const next = listResponses.shift();
      assert.ok(next, 'unexpected list refresh');
      return next();
    },
    [createName]: async () => item,
    [updateName]: () => pendingUpdate.promise,
    [deleteName]: async () => {
      deleteCalls += 1;
      return item;
    },
    appendGoalProgress: async () => ({ ...progress, goalId: item.id }),
  };
  const runner = await loadHook(hookPath, exportName, api);

  let result = runner.render();
  await flush();
  result = runner.render();
  assert.deepEqual(result.data, []);

  await result.create(createInput);
  result = runner.render();
  assert.deepEqual(result.data, [item], 'successful mutation must refresh list data');

  const updating = result.update(...updateInput);
  const concurrent = result.remove(item.id);
  await assert.rejects(concurrent, { name: 'ApiError', message: busyMessage });
  assert.equal(deleteCalls, 0, 'the concurrent mutation must not reach the client');
  result = runner.render();
  assert.equal(result.error, busyMessage);

  pendingUpdate.resolve(item);
  await updating;
  await flush();
  result = runner.render();
  assert.equal(
    result.error,
    busyMessage,
    'an older post-mutation refresh must not overwrite the visible busy error',
  );
  runner.unmount();
}

async function loadHook(path, exportName, api) {
  const source = await readFile(path, 'utf8');
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
    fileName: path.pathname,
  }).outputText;
  const harness = createReactHarness();
  const module = { exports: {} };
  const evaluate = new Function('module', 'exports', 'require', output);
  evaluate(module, module.exports, (specifier) => {
    if (specifier === 'react') return harness.react;
    if (specifier === '../api/client') return api;
    throw new Error(`unexpected hook dependency: ${specifier}`);
  });
  return {
    render: () => harness.render(module.exports[exportName]),
    unmount: harness.unmount,
  };
}

function createReactHarness() {
  const slots = [];
  let cursor = 0;
  let pendingEffects = [];

  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { value: initial };
      const setValue = (next) => {
        slots[index].value = typeof next === 'function' ? next(slots[index].value) : next;
      };
      return [slots[index].value, setValue];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useCallback(callback, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependenciesChanged(previous.dependencies, dependencies)) {
        slots[index] = { value: callback, dependencies };
      }
      return slots[index].value;
    },
    useEffect(effect, dependencies) {
      const index = cursor++;
      const previous = slots[index];
      if (!previous || dependenciesChanged(previous.dependencies, dependencies)) {
        pendingEffects.push(() => {
          previous?.cleanup?.();
          slots[index] = { dependencies, cleanup: effect() };
        });
      }
    },
  };

  return {
    react,
    render(useHook) {
      cursor = 0;
      pendingEffects = [];
      const result = useHook();
      for (const runEffect of pendingEffects) runEffect();
      return result;
    },
    unmount() {
      for (const slot of slots) slot?.cleanup?.();
    },
  };
}

function dependenciesChanged(previous, next) {
  return previous.length !== next.length
    || previous.some((value, index) => !Object.is(value, next[index]));
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flush() {
  await new Promise((resolve) => setImmediate(resolve));
}

function stripHeaders(init) {
  if (init === undefined) return undefined;
  const { headers: _headers, ...rest } = init;
  return rest;
}
