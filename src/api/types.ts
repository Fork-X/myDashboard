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
