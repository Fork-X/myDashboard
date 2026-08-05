import type {
  CareerPayload,
  GoalItem,
  GoalProgressItem,
  GoalStatus,
  ProjectPayload,
  RecordDomain,
  RecordForDomain,
  RecordPayloadMap,
  RecordType,
  TaskItem,
  ThoughtItem,
  TodoItem,
  TodoStatus,
} from './types';

const INVALID_DATA_MESSAGE = '本地服务返回无效数据';
const UNAVAILABLE_MESSAGE = '本地服务不可用';
const recordDomains: RecordDomain[] = ['investment', 'thought', 'career', 'project'];
const recordTypes: RecordType[] = ['knowledge', 'idea', 'decision', 'experience', 'project'];
const companyAliases: CareerPayload['companyAlias'][] = ['A公司', 'Y公司', 'H公司'];
const taskKinds: TaskItem['kind'][] = ['goal', 'todo'];
const taskPeriods: Exclude<TaskItem['period'], null>[] = ['year', 'month'];
const taskStatuses: TaskItem['status'][] = [
  'pending',
  'in_progress',
  'completed',
  'cancelled',
];
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

export function listRecords<TDomain extends RecordDomain>(
  domain: TDomain,
  type?: string,
): Promise<RecordForDomain<TDomain>[]> {
  const query = new URLSearchParams({ domain });
  if (type) query.set('type', type);
  return request<unknown>(`/api/records?${query}`)
    .then((data) => parseRecordList(data, domain));
}

export function listTasks(kind: TaskItem['kind']): Promise<TaskItem[]> {
  return request<unknown>(`/api/tasks?kind=${kind}`)
    .then((data) => parseTaskList(data, kind));
}

export function createTask(input: {
  title: string;
  description: string;
}): Promise<TaskItem> {
  return request<unknown>('/api/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then((data) => parseTask(data, 'todo'));
}

export function patchTask(
  id: string,
  status: TaskItem['status'],
): Promise<TaskItem> {
  return request<unknown>(`/api/tasks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  }).then((data) => parseTask(data));
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

function parseTaskList(value: unknown, kind: TaskItem['kind']): TaskItem[] {
  if (!Array.isArray(value)) invalidData();
  return value.map((item) => parseTask(item, kind));
}

function parseTask(value: unknown, expectedKind?: TaskItem['kind']): TaskItem {
  if (
    !isObject(value)
    || typeof value.id !== 'string'
    || !isTaskKind(value.kind)
    || (expectedKind !== undefined && value.kind !== expectedKind)
    || !isTaskPeriod(value.period)
    || (value.kind === 'goal' && value.period === null)
    || (value.kind === 'todo' && value.period !== null)
    || typeof value.title !== 'string'
    || typeof value.description !== 'string'
    || !isTaskStatus(value.status)
    || !isNullableDate(value.targetAt)
    || !isNullableDate(value.completedAt)
    || !isNullableString(value.sourceRef)
    || !isDateString(value.createdAt)
    || !isDateString(value.updatedAt)
  ) {
    invalidData();
  }
  return {
    id: value.id,
    kind: value.kind,
    period: value.period,
    title: value.title,
    description: value.description,
    status: value.status,
    targetAt: value.targetAt,
    completedAt: value.completedAt,
    sourceRef: value.sourceRef,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function parseRecordList<TDomain extends RecordDomain>(
  value: unknown,
  domain: TDomain,
): RecordForDomain<TDomain>[] {
  if (!Array.isArray(value)) invalidData();
  return value.map((item) => parseRecord(item, domain));
}

function parseRecord<TDomain extends RecordDomain>(
  value: unknown,
  domain: TDomain,
): RecordForDomain<TDomain> {
  if (
    !isObject(value)
    || typeof value.id !== 'string'
    || !recordDomains.includes(value.domain as RecordDomain)
    || value.domain !== domain
    || !recordTypes.includes(value.type as RecordType)
    || typeof value.title !== 'string'
    || typeof value.content !== 'string'
    || typeof value.status !== 'string'
    || !isNullableDate(value.occurredAt)
    || !isStringArray(value.tags)
    || !isObject(value.payload)
    || !isNullableString(value.sourceRef)
    || !isDateString(value.createdAt)
    || !isDateString(value.updatedAt)
  ) {
    invalidData();
  }

  const record = {
    id: value.id,
    domain,
    type: value.type,
    title: value.title,
    content: value.content,
    status: value.status,
    occurredAt: value.occurredAt,
    tags: [...value.tags],
    payload: parsePayload(domain, value.payload),
    sourceRef: value.sourceRef,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
  return record as RecordForDomain<TDomain>;
}

function parsePayload<TDomain extends RecordDomain>(
  domain: TDomain,
  payload: Record<string, unknown>,
): RecordPayloadMap[TDomain] {
  let parsed: RecordPayloadMap[RecordDomain];
  if (domain === 'career') {
    parsed = parseCareerPayload(payload);
  } else if (domain === 'project') {
    parsed = parseProjectPayload(payload);
  } else {
    parsed = { ...payload };
  }
  return parsed as RecordPayloadMap[TDomain];
}

function parseCareerPayload(payload: Record<string, unknown>): CareerPayload {
  if (
    !companyAliases.includes(payload.companyAlias as CareerPayload['companyAlias'])
    || typeof payload.position !== 'string'
    || !isDateString(payload.startDate)
    || !isNullableDate(payload.endDate)
    || typeof payload.responsibilities !== 'string'
    || !isStringArray(payload.projects)
    || typeof payload.isCurrent !== 'boolean'
  ) {
    invalidData();
  }
  return {
    companyAlias: payload.companyAlias as CareerPayload['companyAlias'],
    position: payload.position,
    startDate: payload.startDate,
    endDate: payload.endDate,
    responsibilities: payload.responsibilities,
    projects: [...payload.projects],
    isCurrent: payload.isCurrent,
  };
}

function parseProjectPayload(payload: Record<string, unknown>): ProjectPayload {
  if (
    !isStringArray(payload.techStack)
    || !isSafeUrl(payload.repositoryUrl)
    || !isSafeUrl(payload.demoUrl)
    || typeof payload.currentFocus !== 'string'
  ) {
    invalidData();
  }
  return {
    techStack: [...payload.techStack],
    repositoryUrl: payload.repositoryUrl,
    demoUrl: payload.demoUrl,
    currentFocus: payload.currentFocus,
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isTaskKind(value: unknown): value is TaskItem['kind'] {
  return typeof value === 'string' && taskKinds.some((kind) => kind === value);
}

function isTaskPeriod(value: unknown): value is TaskItem['period'] {
  return value === null
    || (typeof value === 'string' && taskPeriods.some((period) => period === value));
}

function isTaskStatus(value: unknown): value is TaskItem['status'] {
  return typeof value === 'string'
    && taskStatuses.some((status) => status === value);
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

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isNullableDate(value: unknown): value is string | null {
  return value === null || isDateString(value);
}

function isSafeUrl(value: unknown): value is string | null {
  if (value === null) return true;
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
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
