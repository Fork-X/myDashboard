import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const files = {
  page: new URL('../../src/pages/Todos.tsx', import.meta.url),
  goals: new URL('../../src/components/todos/GoalsList.tsx', import.meta.url),
  goalForm: new URL('../../src/components/todos/GoalForm.tsx', import.meta.url),
  progressForm: new URL('../../src/components/todos/GoalProgressForm.tsx', import.meta.url),
  todos: new URL('../../src/components/todos/TodoList.tsx', import.meta.url),
  todoForm: new URL('../../src/components/todos/TodoForm.tsx', import.meta.url),
};

test('planning page exposes the two approved independent workspaces', async () => {
  const todosPage = await source(files.page);

  assert.match(todosPage, /持续目标/);
  assert.match(todosPage, /TODO 四象限/);
  assert.doesNotMatch(todosPage, /目标规划|TODO List/);
});

test('continuous goals use the goal API and keep progress append-only', async () => {
  const [goalList, goalForm, progressForm] = await Promise.all([
    source(files.goals),
    source(files.goalForm),
    source(files.progressForm),
  ]);

  assert.match(goalList, /useGoals\(\)/);
  assert.match(goalList, /appendProgress/);
  assert.doesNotMatch(goalList, /updateProgress|deleteProgress/);
  for (const status of ['active', 'paused', 'completed', 'abandoned']) {
    assert.match(goalList + goalForm, new RegExp(status));
  }
  for (const label of ['进行中', '已暂停', '已完成', '已放弃']) {
    assert.match(goalList + goalForm, new RegExp(label));
  }
  assert.match(goalList, /progress\.length === 0/);
  assert.match(goalList, /window\.confirm/);
  assert.match(goalList, /new Date\([^)]+createdAt/);
  assert.match(progressForm, /content/);
  assert.doesNotMatch(progressForm, /update|delete|remove/i);
  assert.doesNotMatch(goalForm, /period|targetAt|KR|关键结果/);
});

test('TODO workspace renders the exact four quadrants and all API states', async () => {
  const [todoList, todoForm] = await Promise.all([
    source(files.todos),
    source(files.todoForm),
  ]);

  assert.match(todoList, /useTodos\(\)/);
  for (const quadrant of ['重要且紧急', '重要不紧急', '紧急不重要', '不重要不紧急']) {
    assert.match(todoList, new RegExp(quadrant));
  }
  assert.match(todoList, /isImportant/);
  assert.match(todoList, /isUrgent/);
  for (const status of ['pending', 'in_progress', 'completed', 'cancelled']) {
    assert.match(todoList + todoForm, new RegExp(status));
  }
  for (const label of ['待处理', '进行中', '已完成', '已取消']) {
    assert.match(todoList + todoForm, new RegExp(label));
  }
  assert.match(todoList, /window\.confirm\('确认删除这条 TODO？'\)/);
});

test('TODO form edits free tags without legacy task fields or goal relations', async () => {
  const todoForm = await source(files.todoForm);

  assert.match(todoForm, /tags/);
  assert.match(todoForm, /split\(','\)/);
  assert.match(todoForm, /isImportant/);
  assert.match(todoForm, /isUrgent/);
  assert.doesNotMatch(todoForm, /description|targetAt|targetDate|period|goalId|goalRelation|KR/);
});

async function source(path) {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (error && error.code === 'ENOENT') return '';
    throw error;
  }
}
