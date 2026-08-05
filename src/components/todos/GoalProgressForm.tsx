import { useState } from 'react';

interface GoalProgressFormProps {
  busy: boolean;
  onSubmit: (content: string) => void;
  onCancel: () => void;
}

export default function GoalProgressForm({ busy, onSubmit, onCancel }: GoalProgressFormProps) {
  const [content, setContent] = useState('');

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || busy) return;
    onSubmit(trimmed);
  };

  return (
    <form onSubmit={submit} className="rounded border-2 border-dashed border-vintage-border bg-white p-3">
      <label className="block text-sm font-bold text-vintage-dark">
        新进展
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          disabled={busy}
          autoFocus
          rows={3}
          placeholder="记录本次进展；提交后不可修改"
          className="mt-1 w-full rounded border border-vintage-border px-3 py-2 font-normal focus:border-vintage-red focus:outline-none"
        />
      </label>
      <div className="mt-2 flex gap-2">
        <button
          type="submit"
          disabled={busy || !content.trim()}
          className="rounded bg-vintage-red px-3 py-1.5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy ? '保存中...' : '追加'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded border border-vintage-border px-3 py-1.5 text-sm text-vintage-dark disabled:opacity-50"
        >
          取消
        </button>
      </div>
    </form>
  );
}
