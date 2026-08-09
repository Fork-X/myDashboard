import type {
  ChatMessage,
  ConversationDetail,
  ConversationSummary,
  DirectionItem,
  DistillDraft,
  EventItem,
  GoalItem,
  GoalProgressItem,
  GoalStatus,
  InboxItem,
  TickerItem,
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

export function listConversations(): Promise<ConversationSummary[]> {
  return request<unknown>('/api/chats').then(parseConversationList);
}

export function createConversation(): Promise<ConversationSummary> {
  return request<unknown>('/api/chats', { method: 'POST', body: '{}' })
    .then(parseConversation);
}

export function getConversation(id: string): Promise<ConversationDetail> {
  return request<unknown>(`/api/chats/${encodeURIComponent(id)}`).then(parseConversationDetail);
}

export function deleteConversation(id: string): Promise<ConversationSummary> {
  return request<unknown>(`/api/chats/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }).then(parseConversation);
}

export function sendChatMessage(id: string, content: string): Promise<ChatMessage> {
  return request<unknown>(`/api/chats/${encodeURIComponent(id)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content }),
  }).then(parseChatMessage);
}

export function createThought(input: {
  title: string;
  content: string;
  tags?: string[];
}): Promise<ThoughtItem> {
  return request<unknown>('/api/thoughts', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(parseThought);
}

export function distillConversation(id: string, focus?: string): Promise<DistillDraft> {
  return request<unknown>(`/api/chats/${encodeURIComponent(id)}/distill`, {
    method: 'POST',
    body: JSON.stringify(focus ? { focus } : {}),
  }).then(parseDistillDraft);
}

// ── investment: events ──────────────────────────────────────────────────────

export function listEvents(): Promise<EventItem[]> {
  return request<unknown>('/api/events').then(parseEventList);
}

export function createEvent(input: {
  name: string;
  eventStartDate: string;
  eventEndDate: string;
  dateConfidence?: string;
  ambushDays?: number;
  tags?: string[];
  tickerIds?: string[];
  notes?: string;
}): Promise<EventItem> {
  return request<unknown>('/api/events', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(parseEvent);
}

export function getEvent(id: string): Promise<EventItem> {
  return request<unknown>(`/api/events/${encodeURIComponent(id)}`).then(parseEvent);
}

export function updateEvent(
  id: string,
  patch: Partial<{
    name: string;
    eventStartDate: string;
    eventEndDate: string;
    dateConfidence: string;
    ambushDays: number;
    tags: string[];
    tickerIds: string[];
    notes: string;
    status: string;
  }>,
): Promise<EventItem> {
  return request<unknown>(`/api/events/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then(parseEvent);
}

export function deleteEvent(id: string): Promise<EventItem> {
  return request<unknown>(`/api/events/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }).then(parseEvent);
}

// ── investment: tickers ─────────────────────────────────────────────────────

export function listTickers(): Promise<TickerItem[]> {
  return request<unknown>('/api/tickers').then(parseTickerList);
}

export function createTicker(input: {
  symbol: string;
  name: string;
  market?: string;
  notes?: string;
}): Promise<TickerItem> {
  return request<unknown>('/api/tickers', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(parseTicker);
}

export function deleteTicker(id: string): Promise<TickerItem> {
  return request<unknown>(`/api/tickers/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }).then(parseTicker);
}

// ── investment: directions ──────────────────────────────────────────────────

export function listDirections(): Promise<DirectionItem[]> {
  return request<unknown>('/api/directions').then(parseDirectionList);
}

export function createDirection(input: {
  name: string;
  description?: string;
  keywords?: string;
  enabled?: boolean;
  priority?: number;
  scanIntervalHours?: number;
}): Promise<DirectionItem> {
  return request<unknown>('/api/directions', {
    method: 'POST',
    body: JSON.stringify(input),
  }).then(parseDirection);
}

export function updateDirection(
  id: string,
  patch: Partial<{
    name: string;
    description: string;
    keywords: string;
    enabled: boolean;
    priority: number;
    scanIntervalHours: number;
  }>,
): Promise<DirectionItem> {
  return request<unknown>(`/api/directions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then(parseDirection);
}

export function deleteDirection(id: string): Promise<DirectionItem> {
  return request<unknown>(`/api/directions/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  }).then(parseDirection);
}

export function scanDirection(id: string): Promise<{ message: string }> {
  return request<{ message: string }>(`/api/directions/${encodeURIComponent(id)}/scan`, {
    method: 'POST',
  });
}

// ── investment: inbox ───────────────────────────────────────────────────────

export function listInboxItems(): Promise<InboxItem[]> {
  return request<unknown>('/api/inbox').then(parseInboxList);
}

export function updateInboxItem(
  id: string,
  patch: {
    aiEventName?: string;
    aiEventStartDate?: string;
    aiEventEndDate?: string;
    dateConfidence?: string;
    aiTags?: string[];
    aiTickers?: { symbol: string; name: string }[];
  },
): Promise<InboxItem> {
  return request<unknown>(`/api/inbox/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then(parseInbox);
}

export function convertInboxItem(id: string): Promise<{ item: InboxItem; event: EventItem }> {
  return request<unknown>(`/api/inbox/${encodeURIComponent(id)}/convert`, {
    method: 'POST',
  }).then(parseConvertResult);
}

export function ignoreInboxItem(id: string): Promise<InboxItem> {
  return request<unknown>(`/api/inbox/${encodeURIComponent(id)}/ignore`, {
    method: 'POST',
  }).then(parseInbox);
}

// ── investment: tags ────────────────────────────────────────────────────────

export function listTags(): Promise<string[]> {
  return request<unknown>('/api/tags').then((value) => {
    if (!Array.isArray(value) || !value.every((v) => typeof v === 'string')) invalidData();
    return value as string[];
  });
}

// ── parsers ─────────────────────────────────────────────────────────────────

function parseDistillDraft(value: unknown): DistillDraft {
  if (!isObject(value) || typeof value.shouldSave !== 'boolean') invalidData();
  if (!value.shouldSave) {
    if (typeof value.reason !== 'string') invalidData();
    return { shouldSave: false, reason: value.reason };
  }
  if (
    typeof value.title !== 'string'
    || typeof value.content !== 'string'
    || !isStringArray(value.tags)
  ) {
    invalidData();
  }
  return {
    shouldSave: true,
    title: value.title,
    content: value.content,
    tags: [...value.tags],
  };
}

function parseConversationList(value: unknown): ConversationSummary[] {
  if (!Array.isArray(value)) invalidData();
  return value.map(parseConversation);
}

function parseConversation(value: unknown): ConversationSummary {
  if (
    !isObject(value)
    || typeof value.id !== 'string'
    || typeof value.title !== 'string'
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.updatedAt)
    || typeof value.messageCount !== 'number'
  ) {
    invalidData();
  }
  return {
    id: value.id,
    title: value.title,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    messageCount: value.messageCount,
  };
}

function parseConversationDetail(value: unknown): ConversationDetail {
  const summary = parseConversation(value);
  if (!isObject(value) || !Array.isArray(value.messages)) invalidData();
  return { ...summary, messages: value.messages.map(parseChatMessage) };
}

function parseChatMessage(value: unknown): ChatMessage {
  if (
    !isObject(value)
    || typeof value.id !== 'string'
    || typeof value.conversationId !== 'string'
    || (value.role !== 'user' && value.role !== 'assistant')
    || typeof value.content !== 'string'
    || !(value.thinking === null || typeof value.thinking === 'string')
    || !isTimestamp(value.createdAt)
  ) {
    invalidData();
  }
  return {
    id: value.id,
    conversationId: value.conversationId,
    role: value.role,
    content: value.content,
    thinking: value.thinking,
    createdAt: value.createdAt,
  };
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

// ── investment parsers ──────────────────────────────────────────────────────

function parseEventList(value: unknown): EventItem[] {
  if (!Array.isArray(value)) invalidData();
  return value.map(parseEvent);
}

function parseEvent(value: unknown): EventItem {
  if (
    !isObject(value)
    || typeof value.id !== 'string'
    || typeof value.name !== 'string'
    || typeof value.eventStartDate !== 'string'
    || typeof value.eventEndDate !== 'string'
    || (value.dateConfidence !== 'exact' && value.dateConfidence !== 'fuzzy')
    || typeof value.ambushDays !== 'number'
    || !isStringArray(value.tags)
    || !Array.isArray(value.tickerIds)
    || typeof value.notes !== 'string'
    || (value.status !== 'active' && value.status !== 'archived')
    || !isTimestamp(value.createdAt)
    || !isTimestamp(value.updatedAt)
  ) {
    invalidData();
  }
  return {
    id: value.id,
    name: value.name,
    eventStartDate: value.eventStartDate,
    eventEndDate: value.eventEndDate,
    dateConfidence: value.dateConfidence,
    ambushDays: value.ambushDays,
    tags: [...value.tags],
    tickerIds: [...value.tickerIds],
    notes: value.notes,
    status: value.status,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

function parseTickerList(value: unknown): TickerItem[] {
  if (!Array.isArray(value)) invalidData();
  return value.map(parseTicker);
}

function parseTicker(value: unknown): TickerItem {
  if (
    !isObject(value)
    || typeof value.id !== 'string'
    || typeof value.symbol !== 'string'
    || typeof value.name !== 'string'
    || typeof value.market !== 'string'
    || typeof value.notes !== 'string'
    || !isTimestamp(value.createdAt)
  ) {
    invalidData();
  }
  return {
    id: value.id,
    symbol: value.symbol,
    name: value.name,
    market: value.market,
    notes: value.notes,
    createdAt: value.createdAt,
  };
}

function parseDirectionList(value: unknown): DirectionItem[] {
  if (!Array.isArray(value)) invalidData();
  return value.map(parseDirection);
}

function parseDirection(value: unknown): DirectionItem {
  if (
    !isObject(value)
    || typeof value.id !== 'string'
    || typeof value.name !== 'string'
    || typeof value.description !== 'string'
    || typeof value.keywords !== 'string'
    || typeof value.enabled !== 'boolean'
    || typeof value.priority !== 'number'
    || typeof value.scanIntervalHours !== 'number'
    || !isNullableTimestamp(value.lastScannedAt)
    || !isTimestamp(value.createdAt)
  ) {
    invalidData();
  }
  return {
    id: value.id,
    name: value.name,
    description: value.description,
    keywords: value.keywords,
    enabled: value.enabled,
    priority: value.priority,
    scanIntervalHours: value.scanIntervalHours,
    lastScannedAt: value.lastScannedAt,
    createdAt: value.createdAt,
  };
}

function parseInboxList(value: unknown): InboxItem[] {
  if (!Array.isArray(value)) invalidData();
  return value.map(parseInbox);
}

function parseInbox(value: unknown): InboxItem {
  if (
    !isObject(value)
    || typeof value.id !== 'string'
    || (value.directionId !== null && typeof value.directionId !== 'string')
    || typeof value.sourceSummary !== 'string'
    || typeof value.sourceUrl !== 'string'
    || typeof value.aiEventName !== 'string'
    || typeof value.aiEventStartDate !== 'string'
    || typeof value.aiEventEndDate !== 'string'
    || (value.dateConfidence !== 'exact' && value.dateConfidence !== 'fuzzy')
    || !isStringArray(value.aiTags)
    || !Array.isArray(value.aiTickers)
    || (value.status !== 'pending' && value.status !== 'converted' && value.status !== 'ignored')
    || (value.convertedEventId !== null && typeof value.convertedEventId !== 'string')
    || !isTimestamp(value.scannedAt)
    || !isTimestamp(value.createdAt)
  ) {
    invalidData();
  }
  return {
    id: value.id,
    directionId: value.directionId,
    sourceSummary: value.sourceSummary,
    sourceUrl: value.sourceUrl,
    aiEventName: value.aiEventName,
    aiEventStartDate: value.aiEventStartDate,
    aiEventEndDate: value.aiEventEndDate,
    dateConfidence: value.dateConfidence,
    aiTags: [...value.aiTags],
    aiTickers: [...value.aiTickers],
    status: value.status,
    convertedEventId: value.convertedEventId,
    scannedAt: value.scannedAt,
    createdAt: value.createdAt,
  };
}

function parseConvertResult(value: unknown): { item: InboxItem; event: EventItem } {
  if (!isObject(value) || !value.item || !value.event) invalidData();
  return { item: parseInbox(value.item), event: parseEvent(value.event) };
}

export { request };
