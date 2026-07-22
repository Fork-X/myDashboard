import { Link } from 'react-router-dom';
import { TrendingUp, Lightbulb, Briefcase, CheckSquare, Folder, ArrowRight } from 'lucide-react';
import Card from '../components/common/Card';

const modules = [
  {
    title: '投资理财',
    description: '记录投资知识、每日复盘和热点消息',
    icon: TrendingUp,
    path: '/investment',
    color: 'bg-green-100 text-green-600',
  },
  {
    title: '个人思考',
    description: '记录想法、灵感和各类思考',
    icon: Lightbulb,
    path: '/thoughts',
    color: 'bg-yellow-100 text-yellow-600',
  },
  {
    title: '职业生涯',
    description: '时间线展示职业经历和成长',
    icon: Briefcase,
    path: '/career',
    color: 'bg-blue-100 text-blue-600',
  },
  {
    title: '待办规划',
    description: '管理目标和待办事项',
    icon: CheckSquare,
    path: '/todos',
    color: 'bg-purple-100 text-purple-600',
  },
  {
    title: '个人项目',
    description: '展示个人项目和作品集',
    icon: Folder,
    path: '/projects',
    color: 'bg-pink-100 text-pink-600',
  },
];

export default function Home() {
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">欢迎回来</h1>
          <p className="text-gray-600">选择一个模块开始管理您的内容</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => (
            <Link key={module.path} to={module.path}>
              <Card className="h-full hover:border-blue-300 transition-all">
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${module.color}`}>
                    <module.icon size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {module.title}
                    </h3>
                    <p className="text-sm text-gray-600 mb-3">{module.description}</p>
                    <div className="flex items-center text-blue-600 text-sm font-medium">
                      <span>进入</span>
                      <ArrowRight size={16} className="ml-1" />
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
