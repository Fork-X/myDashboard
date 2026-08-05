import { useState } from 'react';
import { format } from 'date-fns';
import { MessageSquarePlus, Pencil, Plus, Target, Trash2 } from 'lucide-react';
import type { GoalItem, GoalStatus } from '../../api/types';
import { useGoals } from '../../hooks/useGoals';
import Card from '../common/Card';
import EmptyState from '../common/EmptyState';
import ErrorState from '../common/ErrorState';
import Loading from '../common/Loading';
import GoalForm from './GoalForm';
import GoalProgressForm from './GoalProgressForm';

const statusLabels: Record<GoalStatus, { label: string; color: string }> = {
  active: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  paused: { label: '已暂停', color: 'bg-vintage-brown bg-opacity-20 text-vintage-brown' },
  completed: { label: '已完成', color: 'bg-vintage-red text-white' },
  abandoned: { label: '已放弃', color: 'bg-gray-400 text-white' },
};

export default function GoalsList() {
  const {
    data: goals,
    loading,
    error,
    create,
    update,
    remove,
    appendProgress,
  } = useGoals();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [progressGoalId, setProgressGoalId] = useState<string | null>(null);
  const [mutationBusy, setMutationBusy] = useState(false);

  const runMutation = async (operation: () => Promise<void>, onSuccess: () => void) => {
    if (mutationBusy) return;
    setMutationBusy(true);
    try {
      await operation();
      onSuccess();
    } catch {
      // useGoals keeps the server or conflict message visible below.
    } finally {
      setMutationBusy(false);
    }
  };

  const deleteItem = async (goal: GoalItem) => {
    if (goal.progress.length > 0 || !window.confirm('确认删除这个目标？')) return;
    await runMutation(() => remove(goal.id), () => undefined);
  };

  if (loading && goals.length === 0) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-vintage-brown">持续维护方向，并以追加记录保留每次进展。</p>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          disabled={mutationBusy}
          className="flex items-center gap-2 rounded bg-vintage-red px-4 py-2 font-bold text-white transition-colors hover:bg-vintage-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={18} />
          新建目标
        </button>
      </div>

      {showCreate && (
        <GoalForm
          busy={mutationBusy}
          submitLabel="创建目标"
          onSubmit={(input) => runMutation(() => create(input), () => setShowCreate(false))}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {error && <ErrorState message={error} />}

      {goals.length === 0 && !showCreate && !error ? (
        <EmptyState
          icon={<Target size={64} />}
          title="暂无持续目标"
          description="新建一个长期方向，并持续追加进展"
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {goals.map((goal, index) => {
            const progressNewestFirst = [...goal.progress].sort(
              (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
            );
            return (
              <Card key={goal.id} number={String(index + 1).padStart(4, '0')}>
                {editingId === goal.id ? (
                  <GoalForm
                    goal={goal}
                    busy={mutationBusy}
                    submitLabel="保存修改"
                    onSubmit={(patch) => runMutation(
                      () => update(goal.id, patch),
                      () => setEditingId(null),
                    )}
                    onCancel={() => setEditingId(null)}
                  />
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-bold text-vintage-dark">{goal.title}</h3>
                        {goal.description && (
                          <p className="mt-2 whitespace-pre-wrap text-sm text-vintage-brown">
                            {goal.description}
                          </p>
                        )}
                      </div>
                      <span className={`whitespace-nowrap rounded px-3 py-1 text-xs font-bold ${statusLabels[goal.status].color}`}>
                        {statusLabels[goal.status].label}
                      </span>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2 border-t border-dashed border-vintage-border pt-3">
                      <button
                        type="button"
                        onClick={() => setEditingId(goal.id)}
                        disabled={mutationBusy}
                        className="flex items-center gap-1 rounded border border-vintage-border px-3 py-1 text-sm text-vintage-dark hover:bg-white disabled:opacity-50"
                      >
                        <Pencil size={15} /> 编辑
                      </button>
                      <button
                        type="button"
                        onClick={() => setProgressGoalId(goal.id)}
                        disabled={mutationBusy}
                        className="flex items-center gap-1 rounded border border-vintage-border px-3 py-1 text-sm text-vintage-dark hover:bg-white disabled:opacity-50"
                      >
                        <MessageSquarePlus size={15} /> 追加进展
                      </button>
                      {goal.progress.length === 0 && (
                        <button
                          type="button"
                          onClick={() => void deleteItem(goal)}
                          disabled={mutationBusy}
                          className="flex items-center gap-1 rounded border border-vintage-red px-3 py-1 text-sm text-vintage-red hover:bg-red-50 disabled:opacity-50"
                        >
                          <Trash2 size={15} /> 删除
                        </button>
                      )}
                    </div>
                  </>
                )}

                {progressGoalId === goal.id && (
                  <div className="mt-4">
                    <GoalProgressForm
                      busy={mutationBusy}
                      onSubmit={(content) => runMutation(
                        () => appendProgress(goal.id, content),
                        () => setProgressGoalId(null),
                      )}
                      onCancel={() => setProgressGoalId(null)}
                    />
                  </div>
                )}

                {progressNewestFirst.length > 0 && (
                  <div className="mt-5 border-t-2 border-dashed border-vintage-border pt-4">
                    <h4 className="mb-3 text-sm font-bold text-vintage-dark">进展时间线</h4>
                    <ol className="space-y-3">
                      {progressNewestFirst.map((progress) => (
                        <li key={progress.id} className="border-l-2 border-vintage-red pl-3">
                          <p className="whitespace-pre-wrap text-sm text-vintage-dark">{progress.content}</p>
                          <time className="vintage-number mt-1 block text-xs text-vintage-brown">
                            {format(new Date(progress.createdAt), 'yyyy.MM.dd HH:mm')}
                          </time>
                        </li>
                      ))}
                    </ol>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
