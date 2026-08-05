import { useState } from 'react';
import type { GoalItem, GoalStatus } from '../../api/types';

interface GoalFormProps {
  goal?: GoalItem;
  busy: boolean;
  submitLabel: string;
  onSubmit: (input: { title: string; description: string; status: GoalStatus }) => void;
  onCancel: () => void;
}

const statuses: Array<{ value: GoalStatus; label: string }> = [
  { value: 'active', label: '进行中' },
  { value: 'paused', label: '已暂停' },
  { value: 'completed', label: '已完成' },
  { value: 'abandoned', label: '已放弃' },
];

export default function GoalForm({ goal, busy, submitLabel, onSubmit, onCancel }: GoalFormProps) {
  const [title, setTitle] = useState(goal?.title ?? '');
  const [details, setDetails] = useState(goal?.description ?? '');
  const [status, setStatus] = useState<GoalStatus>(goal?.status ?? 'active');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    if (!trimmedTitle || busy) return;
    onSubmit({ title: trimmedTitle, description: details.trim(), status });
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
        说明
        <textarea
          value={details}
          onChange={(event) => setDetails(event.target.value)}
          disabled={busy}
          rows={3}
          className="mt-1 w-full rounded border-2 border-dashed border-vintage-border bg-white px-3 py-2 font-normal focus:border-vintage-red focus:outline-none"
        />
      </label>
      <label className="block text-sm font-bold text-vintage-dark">
        状态
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value as GoalStatus)}
          disabled={busy}
          className="mt-1 w-full rounded border-2 border-dashed border-vintage-border bg-white px-3 py-2 font-normal focus:border-vintage-red focus:outline-none"
        >
          {statuses.map((item) => (
            <option key={item.value} value={item.value}>{item.label}</option>
          ))}
        </select>
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
