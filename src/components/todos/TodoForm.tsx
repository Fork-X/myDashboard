import { useState } from 'react';
import type { TodoItem, TodoStatus } from '../../api/types';

interface TodoFormProps {
  todo?: TodoItem;
  defaults?: Pick<TodoItem, 'isImportant' | 'isUrgent'>;
  busy: boolean;
  submitLabel: string;
  onSubmit: (input: {
    title: string;
    status: TodoStatus;
    isImportant: boolean;
    isUrgent: boolean;
    tags: string[];
  }) => void;
  onCancel: () => void;
}

const statuses: Array<{ value: TodoStatus; label: string }> = [
  { value: 'pending', label: '待处理' },
  { value: 'in_progress', label: '进行中' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
];

export default function TodoForm({
  todo,
  defaults,
  busy,
  submitLabel,
  onSubmit,
  onCancel,
}: TodoFormProps) {
  const [title, setTitle] = useState(todo?.title ?? '');
  const [status, setStatus] = useState<TodoStatus>(todo?.status ?? 'pending');
  const [isImportant, setIsImportant] = useState(todo?.isImportant ?? defaults?.isImportant ?? false);
  const [isUrgent, setIsUrgent] = useState(todo?.isUrgent ?? defaults?.isUrgent ?? false);
  const [tagsText, setTagsText] = useState(todo?.tags.join(', ') ?? '');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || busy) return;
    const tags = [...new Set(tagsText.split(',').map((tag) => tag.trim()).filter(Boolean))];
    onSubmit({ title: trimmedTitle, status, isImportant, isUrgent, tags });
  };

  return (
    <form onSubmit={submit} className="vintage-card space-y-3 p-4">
      <label className="block text-sm font-bold text-vintage-dark">
        标题
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          disabled={busy}
          autoFocus
          className="mt-1 w-full rounded border-2 border-dashed border-vintage-border bg-white px-3 py-2 font-normal focus:border-vintage-red focus:outline-none"
        />
      </label>

      <label className="block text-sm font-bold text-vintage-dark">
        状态
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as TodoStatus)}
          disabled={busy}
          className="mt-1 w-full rounded border-2 border-dashed border-vintage-border bg-white px-3 py-2 font-normal focus:border-vintage-red focus:outline-none"
        >
          {statuses.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
      </label>

      <div className="flex flex-wrap gap-5">
        <label className="flex items-center gap-2 text-sm font-bold text-vintage-dark">
          <input
            type="checkbox"
            checked={isImportant}
            onChange={(event) => setIsImportant(event.target.checked)}
            disabled={busy}
          />
          重要
        </label>
        <label className="flex items-center gap-2 text-sm font-bold text-vintage-dark">
          <input
            type="checkbox"
            checked={isUrgent}
            onChange={(event) => setIsUrgent(event.target.checked)}
            disabled={busy}
          />
          紧急
        </label>
      </div>

      <label className="block text-sm font-bold text-vintage-dark">
        标签
        <input
          value={tagsText}
          onChange={(event) => setTagsText(event.target.value)}
          disabled={busy}
          placeholder="工作, 学习（用逗号分隔）"
          className="mt-1 w-full rounded border-2 border-dashed border-vintage-border bg-white px-3 py-2 font-normal focus:border-vintage-red focus:outline-none"
        />
      </label>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="rounded bg-vintage-red px-4 py-2 font-bold text-white hover:bg-vintage-dark disabled:opacity-50"
        >
          {busy ? '保存中...' : submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded border-2 border-dashed border-vintage-border bg-white px-4 py-2 text-vintage-dark disabled:opacity-50"
        >
          取消
        </button>
      </div>
    </form>
  );
}
