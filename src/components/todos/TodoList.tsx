import { useState, useEffect } from 'react';
import { supabase } from '../../onedaycloud/client';
import { Tables } from '../../onedaycloud/types';
import { format } from 'date-fns';
import Loading from '../common/Loading';
import EmptyState from '../common/EmptyState';
import { CheckSquare, Square, X, Plus } from 'lucide-react';

type Todo = Tables<'todos'>;

export default function TodoList() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTodoTitle, setNewTodoTitle] = useState('');
  const [newTodoDescription, setNewTodoDescription] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    fetchTodos();
  }, []);

  const fetchTodos = async () => {
    try {
      const { data, error } = await supabase
        .from('todos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTodos(data || []);
    } catch (error) {
      console.error('Error fetching todos:', error);
    } finally {
      setLoading(false);
    }
  };

  const addTodo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTodoTitle.trim()) return;

    try {
      const { error } = await supabase.from('todos').insert({
        title: newTodoTitle,
        description: newTodoDescription || null,
        status: 'pending',
      });

      if (error) throw error;

      setNewTodoTitle('');
      setNewTodoDescription('');
      setShowAddForm(false);
      fetchTodos();
    } catch (error) {
      console.error('Error adding todo:', error);
    }
  };

  const updateTodoStatus = async (id: string, status: string) => {
    try {
      const { error } = await supabase
        .from('todos')
        .update({
          status,
          completed_at: status === 'completed' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (error) throw error;
      fetchTodos();
    } catch (error) {
      console.error('Error updating todo:', error);
    }
  };

  if (loading) return <Loading />;

  const pendingTodos = todos.filter((t) => t.status === 'pending');
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
          />
          <textarea
            value={newTodoDescription}
            onChange={(e) => setNewTodoDescription(e.target.value)}
            placeholder="描述（可选）"
            rows={3}
            className="w-full px-4 py-2 border-2 border-dashed border-vintage-border rounded mb-3 bg-white focus:outline-none focus:border-vintage-red"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-vintage-red text-white rounded hover:bg-vintage-dark transition-colors font-bold"
            >
              添加
            </button>
            <button
              type="button"
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

      {todos.length === 0 ? (
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
                      className="flex-shrink-0 mt-1 text-vintage-brown hover:text-vintage-red transition-colors"
                    >
                      <Square size={20} />
                    </button>
                    <div className="flex-1">
                      <h4 className="font-bold text-vintage-dark">{todo.title}</h4>
                      {todo.description && (
                        <p className="text-sm text-vintage-brown mt-1">{todo.description}</p>
                      )}
                      <p className="text-xs vintage-number mt-2">
                        {format(new Date(todo.created_at!), 'yyyy.MM.dd HH:mm')}
                      </p>
                    </div>
                    <button
                      onClick={() => updateTodoStatus(todo.id, 'cancelled')}
                      className="flex-shrink-0 text-vintage-brown hover:text-vintage-red transition-colors"
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
                      className="flex-shrink-0 mt-1 text-vintage-red hover:text-vintage-brown transition-colors"
                    >
                      <CheckSquare size={20} />
                    </button>
                    <div className="flex-1">
                      <h4 className="font-bold text-vintage-dark line-through opacity-60">{todo.title}</h4>
                      {todo.description && (
                        <p className="text-sm text-vintage-brown mt-1 line-through opacity-60">{todo.description}</p>
                      )}
                      <p className="text-xs vintage-number mt-2 opacity-60">
                        完成于 {format(new Date(todo.completed_at!), 'yyyy.MM.dd HH:mm')}
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
