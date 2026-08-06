import { listGoals, listThoughts, listTodos, ApiError } from '../api/client';
import type { GoalItem, ThoughtItem, TodoItem } from '../api/types';
import { format } from 'date-fns';

export type ExportError = { message: string };

function todayStr(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

// --------------- fetch all data ---------------

async function fetchAll(): Promise<{
  goals: GoalItem[];
  thoughts: ThoughtItem[];
  todos: TodoItem[];
}> {
  const [goals, thoughts, todos] = await Promise.all([
    listGoals(),
    listThoughts(),
    listTodos(),
  ]);
  return { goals, thoughts, todos };
}

// --------------- JSON export ---------------

function buildJSON(goals: GoalItem[], thoughts: ThoughtItem[], todos: TodoItem[]): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      goals,
      thoughts,
      todos,
    },
    null,
    2,
  );
}

// --------------- Markdown export ---------------

const STATUS_LABEL: Record<string, string> = {
  active: '进行中',
  paused: '已暂停',
  completed: '已完成',
  abandoned: '已放弃',
  pending: '待处理',
  in_progress: '进行中',
  cancelled: '已取消',
};

function buildMarkdown(goals: GoalItem[], thoughts: ThoughtItem[], todos: TodoItem[]): string {
  const lines: string[] = [];
  const dateStr = format(new Date(), 'yyyy-MM-dd');

  lines.push(`# 个人看板导出 - ${dateStr}`);
  lines.push('');

  // ---- 持续目标 ----
  lines.push('## 持续目标');
  lines.push('');
  if (goals.length === 0) {
    lines.push('暂无持续目标');
    lines.push('');
  } else {
    for (const goal of goals) {
      lines.push(`### ${escapeMD(goal.title)}`);
      lines.push('');
      lines.push(`- **状态**: ${STATUS_LABEL[goal.status] ?? goal.status}`);
      if (goal.description) {
        lines.push(`- **描述**: ${escapeMD(goal.description)}`);
      }
      lines.push(`- **创建**: ${goal.createdAt.slice(0, 10)}`);
      lines.push(`- **更新**: ${goal.updatedAt.slice(0, 10)}`);
      lines.push('');

      if (goal.progress.length > 0) {
        lines.push('#### 进展时间线');
        lines.push('');
        const sorted = [...goal.progress].sort(
          (a, b) => b.createdAt.localeCompare(a.createdAt),
        );
        for (const p of sorted) {
          lines.push(`- **${p.createdAt.slice(0, 10)}** ${escapeMD(p.content)}`);
        }
        lines.push('');
      }
    }
  }

  // ---- TODO 四象限 ----
  lines.push('## TODO 四象限');
  lines.push('');

  const quadrants: { label: string; filter: (t: TodoItem) => boolean }[] = [
    { label: '重要且紧急', filter: (t) => t.isImportant && t.isUrgent },
    { label: '重要不紧急', filter: (t) => t.isImportant && !t.isUrgent },
    { label: '不重要但紧急', filter: (t) => !t.isImportant && t.isUrgent },
    { label: '不重要不紧急', filter: (t) => !t.isImportant && !t.isUrgent },
  ];

  for (const { label, filter } of quadrants) {
    const items = todos.filter((t) => filter(t) && t.status !== 'completed' && t.status !== 'cancelled');
    lines.push(`### ${label}`);
    lines.push('');
    if (items.length === 0) {
      lines.push('（空）');
      lines.push('');
    } else {
      for (const t of items) {
        const done = t.status === 'completed' ? 'x' : ' ';
        lines.push(`- [${done}] ${escapeMD(t.title)}`);
      }
      lines.push('');
    }
  }

  // 已完成
  const completed = todos.filter((t) => t.status === 'completed' || t.status === 'cancelled');
  if (completed.length > 0) {
    lines.push('### 已完成 / 已取消');
    lines.push('');
    for (const t of completed) {
      lines.push(`- [x] ~~${escapeMD(t.title)}~~`);
    }
    lines.push('');
  }

  // ---- 个人思考 ----
  lines.push('## 个人思考');
  lines.push('');
  if (thoughts.length === 0) {
    lines.push('暂无个人思考');
    lines.push('');
  } else {
    const sorted = [...thoughts].sort(
      (a, b) => b.createdAt.localeCompare(a.createdAt),
    );
    for (const t of sorted) {
      lines.push(`### ${escapeMD(t.title)}`);
      lines.push('');
      if (t.tags.length > 0) {
        lines.push(`🏷 ${t.tags.map((tag) => `\`${tag}\``).join(' ')}`);
      }
      lines.push(`📅 ${t.createdAt.slice(0, 10)}`);
      lines.push('');
      lines.push(t.content);
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  return lines.join('\n');
}

function escapeMD(text: string): string {
  return text.replace(/([*_#\[\]|\\])/g, '\\$1');
}

// --------------- download ---------------

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportJSON(): Promise<ExportError | null> {
  try {
    const { goals, thoughts, todos } = await fetchAll();
    const json = buildJSON(goals, thoughts, todos);
    downloadBlob(json, `dashboard-${todayStr()}.json`, 'application/json');
    return null;
  } catch (err) {
    return { message: err instanceof ApiError ? err.message : '数据导出失败' };
  }
}

export async function exportMarkdown(): Promise<ExportError | null> {
  try {
    const { goals, thoughts, todos } = await fetchAll();
    const md = buildMarkdown(goals, thoughts, todos);
    downloadBlob(md, `dashboard-${todayStr()}.md`, 'text/markdown;charset=utf-8');
    return null;
  } catch (err) {
    return { message: err instanceof ApiError ? err.message : '数据导出失败' };
  }
}
