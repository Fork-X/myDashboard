import { Link } from 'react-router-dom';
import { TrendingUp, Lightbulb, Briefcase, CheckSquare, Folder, ArrowRight } from 'lucide-react';
import Card from '../components/common/Card';

const modules = [
  {
    title: '投资理财',
    description: '记录投资知识、每日复盘和热点消息',
    icon: TrendingUp,
    path: '/investment',
    number: '0001',
  },
  {
    title: '个人思考',
    description: '记录想法、灵感和各类思考',
    icon: Lightbulb,
    path: '/thoughts',
    number: '0002',
  },
  {
    title: '职业生涯',
    description: '时间线展示职业经历和成长',
    icon: Briefcase,
    path: '/career',
    number: '0003',
  },
  {
    title: '待办规划',
    description: '管理目标和待办事项',
    icon: CheckSquare,
    path: '/todos',
    number: '0004',
  },
  {
    title: '个人项目',
    description: '展示个人项目和作品集',
    icon: Folder,
    path: '/projects',
    number: '0005',
  },
];

export default function Home() {
  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold text-vintage-dark mb-3">欢迎回来</h1>
          <div className="vintage-divider max-w-md mx-auto"></div>
          <p className="text-vintage-brown mt-3">选择一个模块开始管理您的内容</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((module) => (
            <Link key={module.path} to={module.path}>
              <Card number={module.number} className="h-full hover:scale-105 transition-transform">
                <div className="flex items-start gap-4">
                  <div className="p-3 rounded-lg bg-vintage-brown bg-opacity-10 border-2 border-dashed border-vintage-brown">
                    <module.icon size={24} className="text-vintage-brown" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-vintage-dark mb-1">
                      {module.title}
                    </h3>
                    <p className="text-sm text-vintage-brown mb-3">{module.description}</p>
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
      </div>
    </div>
  );
}
