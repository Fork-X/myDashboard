export type GoalStatus = 'active' | 'paused' | 'completed' | 'abandoned';
export type TodoStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface ThoughtItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
}

export interface GoalProgressItem {
  id: string;
  goalId: string;
  content: string;
  createdAt: string;
}

export interface GoalItem {
  id: string;
  title: string;
  description: string;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
  progress: GoalProgressItem[];
}

export interface TodoItem {
  id: string;
  title: string;
  status: TodoStatus;
  isImportant: boolean;
  isUrgent: boolean;
  tags: string[];
  createdAt: string;
  completedAt: string | null;
}

export type ChatRole = 'user' | 'assistant';

export interface ConversationSummary {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: ChatRole;
  content: string;
  thinking: string | null;
  createdAt: string;
}

export interface ConversationDetail extends ConversationSummary {
  messages: ChatMessage[];
}

export type ChatStreamEvent =
  | { type: 'status'; active: boolean; busy: boolean }
  | { type: 'delta'; text: string }
  | { type: 'thinking'; text: string }
  | { type: 'message'; message: ChatMessage }
  | { type: 'queue'; status: string }
  | { type: 'turn_end'; subtype?: string }
  | { type: 'error'; message: string }
  | { type: 'session_closed' };

export type DistillDraft =
  | { shouldSave: true; title: string; content: string; tags: string[] }
  | { shouldSave: false; reason: string };

// ── investment ──────────────────────────────────────────────────────────────

export type DateConfidence = 'exact' | 'fuzzy';
export type EventStatus = 'active' | 'archived';
export type InboxStatus = 'pending' | 'converted' | 'ignored';

export interface TickerItem {
  id: string;
  symbol: string;
  name: string;
  market: string;
  notes: string;
  createdAt: string;
}

export interface EventItem {
  id: string;
  name: string;
  eventStartDate: string;
  eventEndDate: string;
  dateConfidence: DateConfidence;
  ambushDays: number;
  tags: string[];
  tickerIds: string[];
  notes: string;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DirectionItem {
  id: string;
  name: string;
  description: string;
  keywords: string;
  enabled: boolean;
  priority: number;
  scanIntervalHours: number;
  lastScannedAt: string | null;
  createdAt: string;
}

export interface InboxItem {
  id: string;
  directionId: string | null;
  sourceSummary: string;
  sourceUrl: string;
  aiEventName: string;
  aiEventStartDate: string;
  aiEventEndDate: string;
  dateConfidence: DateConfidence;
  aiTags: string[];
  aiTickers: { symbol: string; name: string }[];
  status: InboxStatus;
  convertedEventId: string | null;
  scannedAt: string;
  createdAt: string;
}
