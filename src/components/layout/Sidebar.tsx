import { NavLink } from 'react-router-dom';
import { Home, TrendingUp, Lightbulb, Briefcase, CheckSquare, Folder } from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: '首页' },
  { path: '/investment', icon: TrendingUp, label: '投资理财' },
  { path: '/thoughts', icon: Lightbulb, label: '个人思考' },
  { path: '/career', icon: Briefcase, label: '职业生涯' },
  { path: '/todos', icon: CheckSquare, label: '待办规划' },
  { path: '/projects', icon: Folder, label: '个人项目' },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex-shrink-0">
      <div className="h-16 flex items-center px-6 border-b border-gray-200">
        <h1 className="text-xl font-bold text-gray-800">个人看板</h1>
      </div>
      <nav className="p-4 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-700 hover:bg-gray-50'
              }`
            }
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
