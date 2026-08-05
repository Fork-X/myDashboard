import type {
  GoalItem,
  GoalProgressItem,
  GoalStatus,
  ThoughtItem,
  TodoItem,
  TodoStatus,
} from './types';

const INVALID_DATA_MESSAGE = '本地服务返回无效数据';
const UNAVAILABLE_MESSAGE = '本地服务不可用';
const goalStatuses: GoalStatus[] = ['active', 'paused', 'completed', 'abandoned'];
const todoStatuses: TodoStatus[] = ['pending', 'in_progress', 'completed', 'cancelled'];

export class ApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { 'content-type': 'application/json', ...init?.headers },
    });
  } catch {
    throw new ApiError(UNAVAILABLE_MESSAGE);
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(response.ok ? INVALID_DATA_MESSAGE : UNAVAILABLE_MESSAGE);
  }

  if (!response.ok) {
    throw new ApiError(errorMessageOf(payload) ?? UNAVAILABLE_MESSAGE);
  }
  if (
    !isObject(payload)
    || !Object.prototype.hasOwnProperty.call(payload, 'data')
    || payload.data == null
  ) {
    throw new ApiError(INVALID_DATA_MESSAGE);
  }
  return payload.data as T;
}

export function listThoughts(): Promise<ThoughtItem[]> {
  return request<unknown>('/api/thoughts').then(parseThoughtList);
}

export function listGoals(): Promise<GoalItem[]> {
  return request<unknown>('/api/goals').then(parseGoalList);
}

export function createGoal(input: {
  title: string;
  description?: string;
  status?: GoalStatus;
}): Promise<GoalItem> {
  return request<unknown>('/api/goals', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(parseGoal);
}

export function updateGoal(
  id: string,
  patch: { title?: string; description?: string; status?: GoalStatus },
): Promise<GoalItem> {
  return request<unknown>(`/api/goals/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then(parseGoal);
}

export function deleteGoal(id: string): Promise<GoalItem> {
  return request<unknown>(`/api/goals/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }).then(parseGoal);
}

export function appendGoalProgress(
  goalId: string,
  input: { content: string },
): Promise<GoalProgressItem> {
  return request<unknown>(`/api/goals/${encodeURIComponent(goalId)}/progress`, {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(parseGoalProgress);
}

export function listTodos(): Promise<TodoItem[]> {
  return request<unknown>('/api/todos').then(parseTodoList);
}

export function createTodo(input: {
  title: string;
  status?: TodoStatus;
  isImportant?: boolean;
  isUrgent?: boolean;
  tags?: string[];
}): Promise<TodoItem> {
  return request<unknown>('/api/todos', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(parseTodo);
}

export function updateTodo(
  id: string,
  patch: {
    title?: string;
    status?: TodoStatus;
    isImportant?: boolean;
    isUrgent?: boolean;
    tags?: string[];
  },
): Promise<TodoItem> {
  return request<unknown>(`/api/todos/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then(parseTodo);
}

export function deleteTodo(id: string): Promise<TodoItem> {
  return request<unknown>(`/api/todos/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }).then(parseTodo);
}

function parseThoughtList(value: unknown): ThoughtItem[] {
  if (!Array.isArray(value)) invalidData();
  return value.map(parseThought);
}

function parseThought(value: unknown): ThoughtItem {
  if (
    !isObject(value)
    || typeof value.id !== 'string'
    || typeof value.title !== 'string'
    || typeof value.content !== 'string'
    || !isStringArray(value.tags)
    || !isTimestamp(value.createdAt)
  ) {
    invalidData();
  }
  return {
    id: value.id,
    title: value.title,
    content: value.content,
    tags: [...value.tags],
    createdAt: value.createdAt,
  };
}

function parseGoalList(value: unknown): GoalItem[] {
  if (!Array.isArray(value)) invalidData();
  return value.map(parseGoal);
}

function parseGoal(value: unknown): GoalItem {
  if (
    !isObject(value)
    || typeof value.id !== 'string'
    || typeof value.title !== 'string'
    || typeof value.description !== 'string'
    || !isGoalStatus(value.status)
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.updatedAt)
    || !Array.isArray(value.progress)
  ) {
    invalidData();
  }
  return {
    id: value.id,
    title: value.title,
    description: value.description,
    status: value.status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    progress: value.progress.map(parseGoalProgress),
  };
}

function parseGoalProgress(value: unknown): GoalProgressItem {
  if (
    !isObject(value)
    || typeof value.id !== 'string'
    || typeof value.goalId !== 'string'
    || typeof value.content !== 'string'
    || !isTimestamp(value.createdAt)
  ) {
    invalidData();
  }
  return {
    id: value.id,
    goalId: value.goalId,
    content: value.content,
    createdAt: value.createdAt,
  };
}

function parseTodoList(value: unknown): TodoItem[] {
  if (!Array.isArray(value)) invalidData();
  return value.map(parseTodo);
}

function parseTodo(value: unknown): TodoItem {
  if (
    !isObject(value)
    || typeof value.id !== 'string'
    || typeof value.title !== 'string'
    || !isTodoStatus(value.status)
    || typeof value.isImportant !== 'boolean'
    || typeof value.isUrgent !== 'boolean'
    || !isStringArray(value.tags)
    || !isTimestamp(value.createdAt)
    || !isNullableTimestamp(value.completedAt)
  ) {
    invalidData();
  }
  return {
    id: value.id,
    title: value.title,
    status: value.status,
    isImportant: value.isImportant,
    isUrgent: value.isUrgent,
    tags: [...value.tags],
    createdAt: value.createdAt,
    completedAt: value.completedAt,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isGoalStatus(value: unknown): value is GoalStatus {
  return typeof value === 'string' && goalStatuses.some((status) => status === value);
}

function isTodoStatus(value: unknown): value is TodoStatus {
  return typeof value === 'string' && todoStatuses.some((status) => status === value);
}

function isTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function isNullableTimestamp(value: unknown): value is string | null {
  return value === null || isTimestamp(value);
}

function errorMessageOf(payload: unknown) {
  if (!isObject(payload) || !isObject(payload.error)) return null;
  return typeof payload.error.message === 'string' && payload.error.message
    ? payload.error.message
    : null;
}

function invalidData(): never {
  throw new ApiError(INVALID_DATA_MESSAGE);
}

export { request };
