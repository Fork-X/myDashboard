import { useState, useEffect } from 'react';
import { supabase } from '../../onedaycloud/client';
import { Tables } from '../../onedaycloud/types';
import { format } from 'date-fns';
import Card from '../common/Card';
import Loading from '../common/Loading';
import EmptyState from '../common/EmptyState';
import { Target, Calendar } from 'lucide-react';

type Goal = Tables<'goals'>;

const statusLabels: Record<string, { label: string; color: string }> = {
  pending: { label: '待开始', color: 'bg-gray-100 text-gray-700' },
  in_progress: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  completed: { label: '已完成', color: 'bg-green-100 text-green-700' },
  cancelled: { label: '已取消', color: 'bg-red-100 text-red-700' },
};

const typeLabels: Record<string, string> = {
  year: '年度目标',
  month: '月度目标',
};

export default function GoalsList() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchGoals();
  }, []);

  const fetchGoals = async () => {
    try {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .order('target_date', { ascending: false });

      if (error) throw error;
      setGoals(data || []);
    } catch (error) {
      console.error('Error fetching goals:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;

  if (goals.length === 0) {
    return (
      <EmptyState
        icon={<Target size={64} />}
        title="暂无目标"
        description="开始设定您的年度或月度目标"
      />
    );
  }

  const yearGoals = goals.filter((g) => g.type === 'year');
  const monthGoals = goals.filter((g) => g.type === 'month');

  return (
    <div className="space-y-8">
      {yearGoals.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">年度目标</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {yearGoals.map((goal) => (
              <Card key={goal.id}>
                <div className="flex items-start justify-between mb-3">
                  <h4 className="text-lg font-semibold text-gray-900">{goal.title}</h4>
                  <span className={`px-3 py-1 text-xs rounded-full ${statusLabels[goal.status || 'pending'].color}`}>
                    {statusLabels[goal.status || 'pending'].label}
                  </span>
                </div>
                {goal.description && (
                  <p className="text-gray-600 text-sm mb-3">{goal.description}</p>
                )}
                {goal.target_date && (
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <Calendar size={16} />
                    <span>目标日期：{format(new Date(goal.target_date), 'yyyy年MM月dd日')}</span>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {monthGoals.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">月度目标</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {monthGoals.map((goal) => (
              <Card key={goal.id}>
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-semibold text-gray-900">{goal.title}</h4>
                  <span className={`px-2 py-1 text-xs rounded-full ${statusLabels[goal.status || 'pending'].color}`}>
                    {statusLabels[goal.status || 'pending'].label}
                  </span>
                </div>
                {goal.description && (
                  <p className="text-gray-600 text-sm mb-3">{goal.description}</p>
                )}
                {goal.target_date && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar size={14} />
                    <span>{format(new Date(goal.target_date), 'yyyy-MM-dd')}</span>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
