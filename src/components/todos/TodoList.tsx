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

  const deleteTodo = async (id: string) => {
    try {
      const { error } = await supabase.from('todos').delete().eq('id', id);
      if (error) throw error;
      fetchTodos();
    } catch (error) {
      console.error('Error deleting todo:', error);
    }
  };

  if (loading) return <Loading />;

  const pendingTodos = todos.filter((t) => t.status === 'pending');
  const completedTodos = todos.filter((t) => t.status === 'completed');
  const cancelledTodos = todos.filter((t) => t.status === 'cancelled');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span>待完成: {pendingTodos.length}</span>
          <span>已完成: {completedTodos.length}</span>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          <span>添加待办</span>
        </button>
      </div>

      {showAddForm && (
        <form onSubmit={addTodo} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <input
            type="text"
            value={newTodoTitle}
            onChange={(e) => setNewTodoTitle(e.target.value)}
            placeholder="待办标题"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            autoFocus
          />
          <textarea
            value={newTodoDescription}
            onChange={(e) => setNewTodoDescription(e.target.value)}
            placeholder="描述（可选）"
            rows={3}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
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
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
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
              <h3 className="text-lg font-semibold text-gray-900 mb-3">待完成</h3>
              <div className="space-y-2">
                {pendingTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 flex items-start gap-3"
                  >
                    <button
                      onClick={() => updateTodoStatus(todo.id, 'completed')}
                      className="flex-shrink-0 mt-1 text-gray-400 hover:text-green-600 transition-colors"
                    >
                      <Square size={20} />
                    </button>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-900">{todo.title}</h4>
                      {todo.description && (
                        <p className="text-sm text-gray-600 mt-1">{todo.description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        {format(new Date(todo.created_at!), 'yyyy-MM-dd HH:mm')}
                      </p>
                    </div>
                    <button
                      onClick={() => updateTodoStatus(todo.id, 'cancelled')}
                      className="flex-shrink-0 text-gray-400 hover:text-red-600 transition-colors"
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
              <h3 className="text-lg font-semibold text-gray-900 mb-3">已完成</h3>
              <div className="space-y-2">
                {completedTodos.map((todo) => (
                  <div
                    key={todo.id}
                    className="bg-gray-50 rounded-lg border border-gray-200 p-4 flex items-start gap-3 opacity-75"
                  >
                    <button
                      onClick={() => updateTodoStatus(todo.id, 'pending')}
                      className="flex-shrink-0 mt-1 text-green-600 hover:text-gray-400 transition-colors"
                    >
                      <CheckSquare size={20} />
                    </button>
                    <div className="flex-1">
                      <h4 className="font-medium text-gray-700 line-through">{todo.title}</h4>
                      {todo.description && (
                        <p className="text-sm text-gray-600 mt-1 line-through">{todo.description}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-2">
                        完成于 {format(new Date(todo.completed_at!), 'yyyy-MM-dd HH:mm')}
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
