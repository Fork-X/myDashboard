import { useState } from 'react';
import { CheckCircle2, Pencil, Plus, RotateCcw, Trash2, XCircle } from 'lucide-react';
import type { TodoItem, TodoStatus } from '../../api/types';
import { useTodos } from '../../hooks/useTodos';
import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import Loading from '../common/Loading';
import TodoForm from './TodoForm';

const quadrants = [
  { key: 'important-urgent', label: '重要且紧急', isImportant: true, isUrgent: true },
  { key: 'important-not-urgent', label: '重要不紧急', isImportant: true, isUrgent: false },
  { key: 'not-important-urgent', label: '紧急不重要', isImportant: false, isUrgent: true },
  { key: 'not-important-not-urgent', label: '不重要不紧急', isImportant: false, isUrgent: false },
];

const statusLabels: Record<TodoStatus, { label: string; color: string }> = {
  pending: { label: '待处理', color: 'bg-vintage-brown bg-opacity-20 text-vintage-brown' },
  in_progress: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  completed: { label: '已完成', color: 'bg-vintage-red text-white' },
  cancelled: { label: '已取消', color: 'bg-gray-400 text-white' },
};

type QuadrantDefaults = Pick<TodoItem, 'isImportant' | 'isUrgent'>;

export default function TodoList() {
  const { data: todos, loading, error, create, update, remove } = useTodos();
  const [createDefaults, setCreateDefaults] = useState<QuadrantDefaults | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [mutationBusy, setMutationBusy] = useState(false);

  const runMutation = async (operation: () => Promise<void>, onSuccess: () => void) => {
    if (mutationBusy) return;
    setMutationBusy(true);
    try {
      await operation();
      onSuccess();
    } catch {
      // useTodos keeps the API error visible below.
    } finally {
      setMutationBusy(false);
    }
  };

  const setTodoStatus = (todo: TodoItem, status: TodoStatus) => {
    void runMutation(() => update(todo.id, { status }), () => undefined);
  };

  const deleteTodo = (todo: TodoItem) => {
    if (!window.confirm('确认删除这条 TODO？')) return;
    void runMutation(() => remove(todo.id), () => undefined);
  };

  if (loading && todos.length === 0) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-vintage-brown">按重要性与紧急性管理 TODO。</p>
        <button
          type="button"
          onClick={() => setCreateDefaults({ isImportant: false, isUrgent: false })}
          disabled={mutationBusy}
          className="flex items-center gap-2 rounded bg-vintage-red px-4 py-2 font-bold text-white transition-colors hover:bg-vintage-dark disabled:opacity-50"
        >
          <Plus size={18} /> 新建 TODO
        </button>
      </div>

      {createDefaults && (
        <TodoForm
          defaults={createDefaults}
          busy={mutationBusy}
          submitLabel="创建 TODO"
          onSubmit={(input) => runMutation(() => create(input), () => setCreateDefaults(null))}
          onCancel={() => setCreateDefaults(null)}
        />
      )}

      {error && <ErrorState message={error} />}

      {todos.length === 0 && !createDefaults && !error ? (
        <EmptyState
          icon={<CheckCircle2 size={64} />}
          title="暂无 TODO"
          description="新增事项后，它会出现在对应象限"
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          {quadrants.map((quadrant) => {
            const items = todos.filter(
              (todo) => todo.isImportant === quadrant.isImportant && todo.isUrgent === quadrant.isUrgent,
            );
            return (
              <section key={quadrant.key} className="vintage-card rounded-lg p-5">
                <div className="mb-4 flex items-center justify-between gap-3 border-b-2 border-dashed border-vintage-border pb-3">
                  <div>
                    <h3 className="font-bold text-vintage-dark">{quadrant.label}</h3>
                    <span className="vintage-number text-xs text-vintage-brown">{items.length} 项</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreateDefaults({
                      isImportant: quadrant.isImportant,
                      isUrgent: quadrant.isUrgent,
                    })}
                    disabled={mutationBusy}
                    aria-label={`在${quadrant.label}中新建 TODO`}
                    className="rounded border border-vintage-border p-2 text-vintage-dark hover:bg-white disabled:opacity-50"
                  >
                    <Plus size={17} />
                  </button>
                </div>

                {items.length === 0 ? (
                  <p className="py-6 text-center text-sm text-vintage-brown">此象限暂无事项</p>
                ) : (
                  <div className="space-y-3">
                    {items.map((todo) => (
                      <article key={todo.id} className="rounded border border-dashed border-vintage-border bg-white bg-opacity-70 p-3">
                        {editingId === todo.id ? (
                          <TodoForm
                            todo={todo}
                            busy={mutationBusy}
                            submitLabel="保存修改"
                            onSubmit={(patch) => runMutation(
                              () => update(todo.id, patch),
                              () => setEditingId(null),
                            )}
                            onCancel={() => setEditingId(null)}
                          />
                        ) : (
                          <>
                            <div className="flex items-start justify-between gap-3">
                              <h4 className={`font-bold text-vintage-dark ${todo.status === 'completed' ? 'line-through opacity-60' : ''}`}>
                                {todo.title}
                              </h4>
                              <span className={`whitespace-nowrap rounded px-2 py-1 text-xs font-bold ${statusLabels[todo.status].color}`}>
                                {statusLabels[todo.status].label}
                              </span>
                            </div>

                            {todo.tags.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1">
                                {todo.tags.map((tag) => (
                                  <span key={tag} className="rounded border border-vintage-border px-2 py-0.5 text-xs text-vintage-brown">
                                    #{tag}
                                  </span>
                                ))}
                              </div>
                            )}

                            <div className="mt-3 flex flex-wrap gap-2">
                              {todo.status !== 'completed' && (
                                <button
                                  type="button"
                                  onClick={() => setTodoStatus(todo, 'completed')}
                                  disabled={mutationBusy}
                                  className="flex items-center gap-1 rounded border border-vintage-border px-2 py-1 text-xs text-vintage-dark hover:bg-white disabled:opacity-50"
                                >
                                  <CheckCircle2 size={14} /> 完成
                                </button>
                              )}
                              {todo.status !== 'pending' && (
                                <button
                                  type="button"
                                  onClick={() => setTodoStatus(todo, 'pending')}
                                  disabled={mutationBusy}
                                  className="flex items-center gap-1 rounded border border-vintage-border px-2 py-1 text-xs text-vintage-dark hover:bg-white disabled:opacity-50"
                                >
                                  <RotateCcw size={14} /> 重新打开
                                </button>
                              )}
                              {todo.status !== 'cancelled' && todo.status !== 'completed' && (
                                <button
                                  type="button"
                                  onClick={() => setTodoStatus(todo, 'cancelled')}
                                  disabled={mutationBusy}
                                  className="flex items-center gap-1 rounded border border-vintage-border px-2 py-1 text-xs text-vintage-dark hover:bg-white disabled:opacity-50"
                                >
                                  <XCircle size={14} /> 取消
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setEditingId(todo.id)}
                                disabled={mutationBusy}
                                className="flex items-center gap-1 rounded border border-vintage-border px-2 py-1 text-xs text-vintage-dark hover:bg-white disabled:opacity-50"
                              >
                                <Pencil size={14} /> 编辑
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteTodo(todo)}
                                disabled={mutationBusy}
                                className="flex items-center gap-1 rounded border border-vintage-red px-2 py-1 text-xs text-vintage-red hover:bg-red-50 disabled:opacity-50"
                              >
                                <Trash2 size={14} /> 删除
                              </button>
                            </div>
                          </>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
