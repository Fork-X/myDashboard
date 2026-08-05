import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  CheckSquare,
  Folder,
  Lightbulb,
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import Card from '../components/common/Card';
import ErrorState from '../components/common/ErrorState';
import Loading from '../components/common/Loading';
import { useGoals } from '../hooks/useGoals';
import { useThoughts } from '../hooks/useThoughts';
import { useTodos } from '../hooks/useTodos';

const modules = [
  {
    title: '投资理财',
    description: '业务范围与数据规则尚待设计',
    icon: TrendingUp,
    path: '/investment',
    number: '0001',
    pendingDesign: true,
  },
  {
    title: '个人思考',
    description: '查看由本地工具追加的思考记录',
    icon: Lightbulb,
    path: '/thoughts',
    number: '0002',
    pendingDesign: false,
  },
  {
    title: '职业生涯',
    description: '业务范围与数据规则尚待设计',
    icon: Briefcase,
    path: '/career',
    number: '0003',
    pendingDesign: true,
  },
  {
    title: '待办规划',
    description: '管理持续目标和四象限 TODO',
    icon: CheckSquare,
    path: '/todos',
    number: '0004',
    pendingDesign: false,
  },
  {
    title: '个人项目',
    description: '业务范围与数据规则尚待设计',
    icon: Folder,
    path: '/projects',
    number: '0005',
    pendingDesign: true,
  },
];

export default function Home() {
  const thoughtsState = useThoughts();
  const goalsState = useGoals();
  const todosState = useTodos();
  const latestThought = [...thoughtsState.data]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  const activeGoalCount = goalsState.data.filter((goal) => goal.status === 'active').length;
  const latestProgress = goalsState.data
    .flatMap((goal) => goal.progress.map((progress) => ({
      ...progress,
      goalTitle: goal.title,
    })))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
  const unfinishedTodos = todosState.data.filter(
    (todo) => todo.status === 'pending' || todo.status === 'in_progress',
  );
  const importantUrgentCount = unfinishedTodos.filter(
    (todo) => todo.isImportant && todo.isUrgent,
  ).length;
  const errors = [thoughtsState.error, goalsState.error, todosState.error].filter(Boolean);

  if (thoughtsState.loading || goalsState.loading || todosState.loading) {
    return <Loading text="正在读取本地看板..." />;
  }

  if (errors.length > 0) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <ErrorState message={errors.join('；')} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-vintage-dark mb-3">个人看板</h1>
          <div className="vintage-divider max-w-md mx-auto" />
          <p className="text-vintage-brown mt-3">本地数据的轻量总览</p>
        </header>

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10" aria-label="数据概览">
          <Card number="思考">
            <h2 className="font-bold text-vintage-dark mb-3">最近思考</h2>
            {latestThought ? (
              <>
                <h3 className="text-lg font-bold text-vintage-dark">{latestThought.title}</h3>
                <p className="mt-2 text-sm text-vintage-brown line-clamp-3">{latestThought.content}</p>
                <p className="mt-4 text-xs vintage-number">
                  {format(new Date(latestThought.createdAt), 'yyyy.MM.dd HH:mm')}
                </p>
              </>
            ) : (
              <p className="text-sm text-vintage-brown">暂无个人思考</p>
            )}
          </Card>

          <Card number="目标">
            <h2 className="font-bold text-vintage-dark mb-3">持续目标</h2>
            <p className="text-3xl font-bold text-vintage-red">{activeGoalCount}</p>
            <p className="text-sm text-vintage-brown mt-1">个进行中的目标</p>
            <div className="vintage-divider my-4" />
            {latestProgress ? (
              <div>
                <p className="text-xs vintage-number">最近进展 · {latestProgress.goalTitle}</p>
                <p className="mt-2 text-sm text-vintage-dark line-clamp-2">{latestProgress.content}</p>
              </div>
            ) : (
              <p className="text-sm text-vintage-brown">暂无目标进展</p>
            )}
          </Card>

          <Card number="TODO">
            <h2 className="font-bold text-vintage-dark mb-3">待办规划</h2>
            <div className="flex items-end gap-6">
              <div>
                <p className="text-3xl font-bold text-vintage-red">{importantUrgentCount}</p>
                <p className="text-sm text-vintage-brown mt-1">重要且紧急</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-vintage-dark">{unfinishedTodos.length}</p>
                <p className="text-sm text-vintage-brown mt-1">全部待处理</p>
              </div>
            </div>
          </Card>
        </section>

        <section aria-label="功能模块">
          <h2 className="text-xl font-bold text-vintage-dark mb-4">功能模块</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modules.map((module) => (
              <Link key={module.path} to={module.path}>
                <Card number={module.number} className="h-full hover:scale-105 transition-transform">
                  <div className="flex items-start gap-4">
                    <div className="p-3 rounded-lg bg-vintage-brown bg-opacity-10 border-2 border-dashed border-vintage-brown">
                      <module.icon size={24} className="text-vintage-brown" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-lg font-bold text-vintage-dark">{module.title}</h3>
                        {module.pendingDesign && <span className="vintage-stamp text-xs">待设计</span>}
                      </div>
                      <p className="text-sm text-vintage-brown my-3">{module.description}</p>
                      <div className="flex items-center text-vintage-red text-sm font-medium">
                        <span>进入</span>
                        <ArrowRight size={16} className="ml-1" />
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
