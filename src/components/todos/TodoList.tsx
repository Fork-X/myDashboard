import { useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import Loading from '../common/Loading';
import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import { CheckSquare, Square, X, Plus } from 'lucide-react';
import { useTasks } from '../../hooks/useTasks';

export default function TodoList() {
  const { data: todos, loading, error, add, setStatus } = useTasks('todo');
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoDescription, setNewTodoDescription] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [mutationBusy, setMutationBusy] = useState(false);
  const mutationBusyRef = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const beginMutation = () => {
    if (mutationBusyRef.current) return false;
    mutationBusyRef.current = true;
    if (mounted.current) setMutationBusy(true);
    return true;
  };

  const finishMutation = () => {
    mutationBusyRef.current = false;
    if (mounted.current) setMutationBusy(false);
  };

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTodoTitle.trim();
    if (!title || !beginMutation()) return;

    try {
      await add({
        title,
        description: newTodoDescription.trim(),
      });
      if (mounted.current) {
        setNewTodoTitle('');
        setNewTodoDescription('');
        setShowAddForm(false);
      }
    } catch {
      // useTasks exposes the failure through its error state.
    } finally {
      finishMutation();
    }
  };

  const updateTodoStatus = async (
    id: string,
    status: 'pending' | 'completed' | 'cancelled',
  ) => {
    if (!beginMutation()) return;
    try {
      await setStatus(id, status);
    } catch {
      // useTasks exposes the failure through its error state.
    } finally {
      finishMutation();
    }
  };

  if (loading && todos.length === 0) return <Loading />;

  const pendingTodos = todos.filter(
    (todo) => todo.status === 'pending' || todo.status === 'in_progress',
  );
  const completedTodos = todos.filter((t) => t.status === 'completed');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm vintage-number">
          <span>待完成: {pendingTodos.length}</span>
          <span>已完成: {completedTodos.length}</span>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          disabled={mutationBusy}
          className="flex items-center gap-2 px-4 py-2 bg-vintage-red text-white rounded hover:bg-vintage-dark transition-colors font-bold"
        >
          <Plus size={18} />
          <span>添加待办</span>
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={addTodo} className="vintage-card p-4">
          <input
            type="text"
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            placeholder="待办标题"
            className="w-full px-4 py-2 border-2 border-dashed border-vintage-border rounded mb-3 bg-white focus:outline-none focus:border-vintage-red"
            autoFocus
            disabled={mutationBusy}
          />
          <textarea
            value={newTodoDescription}
            onChange={(e) => setNewTodoDescription(e.target.value)}
            placeholder="描述（可选）"
            rows={3}
            disabled={mutationBusy}
            className="w-full px-4 py-2 border-2 border-dashed border-vintage-border rounded mb-3 bg-white focus:outline-none focus:border-vintage-red"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={mutationBusy || !newTodoTitle.trim()}
              className="px-4 py-2 bg-vintage-red text-white rounded hover:bg-vintage-dark transition-colors font-bold disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mutationBusy ? '保存中...' : '添加'}
            </button>
            <button
              type="button"
              disabled={mutationBusy}
              onClick={() => {
                setShowAddForm(false);
                setNewTodoTitle('');
                setNewTodoDescription('');
              }}
              className="px-4 py-2 bg-white text-vintage-dark rounded hover:bg-gray-100 transition-colors border-2 border-dashed border-vintage-border"
            >
              取消
            </button>
          </div>
        </form>
      )}

      {error && <ErrorState message={error} />}

      {todos.length === 0 && !error ? (
        <EmptyState
          icon={<CheckSquare size={64} />}
          title="暂无待办事项"
          description="点击上方按钮添加您的第一个待办"
        />
      ) : (
        <div className="space-y-6">
          {pendingTodos.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-vintage-dark mb-3 flex items-center gap-2">
                <span>待完成</span>
                <div className="vintage-divider flex-1"></div>
              </h3>
              <div className="space-y-2">
                {pendingTodos.map((todo, index) => (
                  <div
                    key={todo.id}
                    className="vintage-card p-4 flex items-start gap-3"
                  >
                    <span className="vintage-number text-xs mt-1">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <button
                      onClick={() => updateTodoStatus(todo.id, 'completed')}
                      disabled={mutationBusy}
                      aria-label={`完成待办：${todo.title}`}
                      className="flex-shrink-0 mt-1 text-vintage-brown hover:text-vintage-red transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Square size={20} />
                    </button>
                    <div className="flex-1">
                      <h4 className="font-bold text-vintage-dark">{todo.title}</h4>
                      {todo.description && (
                        <p className="text-sm text-vintage-brown mt-1">{todo.description}</p>
                      )}
                      <p className="text-xs vintage-number mt-2">
                        {format(new Date(todo.createdAt), 'yyyy.MM.dd HH:mm')}
                      </p>
                    </div>
                    <button
                      onClick={() => updateTodoStatus(todo.id, 'cancelled')}
                      disabled={mutationBusy}
                      aria-label={`取消待办：${todo.title}`}
                      className="flex-shrink-0 text-vintage-brown hover:text-vintage-red transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <X size={20} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {completedTodos.length > 0 && (
            <div>
              <h3 className="text-lg font-bold text-vintage-dark mb-3 flex items-center gap-2">
                <span>已完成</span>
                <div className="vintage-divider flex-1"></div>
              </h3>
              <div className="space-y-2">
                {completedTodos.map((todo, index) => (
                  <div
                    key={todo.id}
                    className="vintage-card p-4 flex items-start gap-3 relative overflow-hidden"
                  >
                    <div className="absolute top-4 right-4 vintage-seal opacity-80 pointer-events-none">
                      <div className="w-16 h-16 rounded-full border-4 border-vintage-red flex items-center justify-center transform rotate-12">
                        <span className="text-vintage-red font-bold text-xs">已完成</span>
                      </div>
                    </div>
                    <span className="vintage-number text-xs mt-1">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <button
                      onClick={() => updateTodoStatus(todo.id, 'pending')}
                      disabled={mutationBusy}
                      aria-label={`重新打开待办：${todo.title}`}
                      className="flex-shrink-0 mt-1 text-vintage-red hover:text-vintage-brown transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <CheckSquare size={20} />
                    </button>
                    <div className="flex-1">
                      <h4 className="font-bold text-vintage-dark line-through opacity-60">{todo.title}</h4>
                      {todo.description && (
                        <p className="text-sm text-vintage-brown mt-1 line-through opacity-60">{todo.description}</p>
                      )}
                      <p className="text-xs vintage-number mt-2 opacity-60">
                        {todo.completedAt
                          ? `完成于 ${format(new Date(todo.completedAt), 'yyyy.MM.dd HH:mm')}`
                          : '已完成'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
