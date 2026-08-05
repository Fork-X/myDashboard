export type RecordDomain = 'investment' | 'thought' | 'career' | 'project';
export type RecordType = 'knowledge' | 'idea' | 'decision' | 'experience' | 'project';

export interface RecordItem<
  TPayload extends object = Record<string, unknown>,
  TDomain extends RecordDomain = RecordDomain,
> {
  id: string;
  domain: TDomain;
  type: RecordType;
  title: string;
  content: string;
  status: string;
  occurredAt: string | null;
  tags: string[];
  payload: TPayload;
  sourceRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CareerPayload {
  companyAlias: 'A公司' | 'Y公司' | 'H公司';
  position: string;
  startDate: string;
  endDate: string | null;
  responsibilities: string;
  projects: string[];
  isCurrent: boolean;
}

export interface ProjectPayload {
  techStack: string[];
  repositoryUrl: string | null;
  demoUrl: string | null;
  currentFocus: string;
}

export interface RecordPayloadMap {
  investment: Record<string, unknown>;
  thought: Record<string, unknown>;
  career: CareerPayload;
  project: ProjectPayload;
}

export type RecordForDomain<TDomain extends RecordDomain> = RecordItem<
  RecordPayloadMap[TDomain],
  TDomain
>;

export interface TaskItem {
  id: string;
  kind: 'goal' | 'todo';
  period: 'year' | 'month' | null;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  targetAt: string | null;
  completedAt: string | null;
  sourceRef: string | null;
  createdAt: string;
  updatedAt: string;
}

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
