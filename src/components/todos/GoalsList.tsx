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
  pending: { label: '待开始', color: 'bg-vintage-brown bg-opacity-20 text-vintage-brown' },
  in_progress: { label: '进行中', color: 'bg-blue-100 text-blue-700' },
  completed: { label: '已完成', color: 'bg-vintage-red text-white' },
  cancelled: { label: '已取消', color: 'bg-gray-400 text-white' },
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
          <h3 className="text-lg font-bold text-vintage-dark mb-4 flex items-center gap-2">
            <span>年度目标</span>
            <div className="vintage-divider flex-1"></div>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {yearGoals.map((goal, index) => (
              <Card key={goal.id} number={String(index + 1).padStart(4, '0')}>
                <div className="flex items-start justify-between mb-3">
                  <h4 className="text-lg font-bold text-vintage-dark">{goal.title}</h4>
                  <span className={`px-3 py-1 text-xs rounded font-bold ${statusLabels[goal.status || 'pending'].color}`}>
                    {statusLabels[goal.status || 'pending'].label}
                  </span>
                </div>
                <div className="vintage-divider"></div>
                {goal.description && (
                  <p className="text-vintage-brown text-sm mb-3 mt-3">{goal.description}</p>
                )}
                {goal.target_date && (
                  <div className="flex items-center gap-2 text-sm vintage-number border-t border-dashed border-vintage-border pt-3">
                    <Calendar size={16} />
                    <span>目标日期: {format(new Date(goal.target_date), 'yyyy.MM.dd')}</span>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {monthGoals.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-vintage-dark mb-4 flex items-center gap-2">
            <span>月度目标</span>
            <div className="vintage-divider flex-1"></div>
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {monthGoals.map((goal, index) => (
              <Card key={goal.id} number={String(index + 1).padStart(4, '0')}>
                <div className="flex items-start justify-between mb-3">
                  <h4 className="font-bold text-vintage-dark">{goal.title}</h4>
                  <span className={`px-2 py-1 text-xs rounded font-bold ${statusLabels[goal.status || 'pending'].color}`}>
                    {statusLabels[goal.status || 'pending'].label}
                  </span>
                </div>
                <div className="vintage-divider"></div>
                {goal.description && (
                  <p className="text-vintage-brown text-sm mb-3 mt-3">{goal.description}</p>
                )}
                {goal.target_date && (
                  <div className="flex items-center gap-2 text-xs vintage-number border-t border-dashed border-vintage-border pt-3">
                    <Calendar size={14} />
                    <span>{format(new Date(goal.target_date), 'yyyy.MM.dd')}</span>
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
