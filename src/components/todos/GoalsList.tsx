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

const mockGoals: Goal[] = [
  {
    id: 'mock-1',
    title: '完成个人看板系统开发',
    description: '构建一个功能完善的个人管理系统，包含投资理财、个人思考、职业生涯、待办规划等模块，采用国风复古设计风格。',
    type: 'year',
    status: 'in_progress',
    target_date: '2024-12-31',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'mock-2',
    title: '投资收益率达到15%',
    description: '通过价值投资策略，在控制风险的前提下，实现年化收益率15%的目标。重点关注科技、医药、消费等优质赛道。',
    type: 'year',
    status: 'in_progress',
    target_date: '2024-12-31',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'mock-3',
    title: '阅读50本书',
    description: '涵盖投资、哲学、社会学、传播学等多个领域，拓宽知识面，提升思维深度。每本书都要写读书笔记和思考总结。',
    type: 'year',
    status: 'in_progress',
    target_date: '2024-12-31',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 'mock-4',
    title: '学习 AI 大模型技术',
    description: '深入学习 GPT、Claude 等大模型的原理和应用，掌握 Prompt Engineering 技巧，探索 AI 在实际工作中的应用场景。',
    type: 'month',
    status: 'in_progress',
    target_date: '2024-03-31',
    created_at: '2024-03-01T00:00:00Z',
    updated_at: '2024-03-01T00:00:00Z'
  },
  {
    id: 'mock-5',
    title: '完成投资复盘系统',
    description: '建立完善的投资复盘机制，每日记录市场观察和操作思路，每月进行投资总结和反思。',
    type: 'month',
    status: 'completed',
    target_date: '2024-02-29',
    created_at: '2024-02-01T00:00:00Z',
    updated_at: '2024-02-01T00:00:00Z'
  },
  {
    id: 'mock-6',
    title: '优化个人时间管理',
    description: '建立高效的时间管理系统，提高工作效率。使用番茄工作法，每天专注工作6小时，留出时间学习和思考。',
    type: 'month',
    status: 'in_progress',
    target_date: '2024-03-31',
    created_at: '2024-03-01T00:00:00Z',
    updated_at: '2024-03-01T00:00:00Z'
  }
];

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
      const dbData = data || [];
      setGoals(dbData.length > 0 ? dbData : mockGoals);
    } catch (error) {
      console.error('Error fetching goals:', error);
      setGoals(mockGoals);
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
