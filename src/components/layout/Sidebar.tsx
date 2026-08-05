import { NavLink } from 'react-router-dom';
import { Home, TrendingUp, Lightbulb, Briefcase, CheckSquare, Folder } from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: '首页' },
  { path: '/investment', icon: TrendingUp, label: '投资理财', pendingDesign: true },
  { path: '/thoughts', icon: Lightbulb, label: '个人思考' },
  { path: '/career', icon: Briefcase, label: '职业生涯', pendingDesign: true },
  { path: '/todos', icon: CheckSquare, label: '待办规划' },
  { path: '/projects', icon: Folder, label: '个人项目', pendingDesign: true },
];

export default function Sidebar() {
  return (
    <aside className="w-64 bg-vintage-paper border-r-2 border-dashed border-vintage-border flex-shrink-0">
      <div className="h-16 flex items-center justify-center px-6 border-b-2 border-dashed border-vintage-border">
        <div className="text-center">
          <h1 className="text-xl font-bold text-vintage-dark">个人看板</h1>
          <p className="text-xs text-vintage-brown vintage-number mt-1">NO.2024</p>
        </div>
      </div>
      <nav className="p-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded transition-colors border-2 ${
                isActive
                  ? 'bg-vintage-red text-white border-vintage-red shadow-md'
                  : 'text-vintage-dark border-dashed border-vintage-border hover:bg-white hover:shadow-sm'
              }`
            }
          >
            <item.icon size={20} />
            <span className="font-medium">{item.label}</span>
            {item.pendingDesign && (
              <span className="ml-auto text-xs opacity-70">待设计</span>
            )}
          </NavLink>
        ))}
      </nav>
      <div className="absolute bottom-4 left-4 right-4">
        <div className="vintage-barcode rounded"></div>
      </div>
    </aside>
  );
}
