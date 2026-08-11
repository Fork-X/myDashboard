import { Link, Outlet, useLocation } from 'react-router-dom';
import { Calendar, Compass, Inbox } from 'lucide-react';

const tabs = [
  { label: '投资日历', path: '/investment', icon: Calendar },
  { label: '题材管理', path: '/investment/directions', icon: Compass },
  { label: '收件箱', path: '/investment/inbox', icon: Inbox },
];

export default function Investment() {
  const location = useLocation();
  const isRoot = location.pathname === '/investment' || location.pathname === '/investment/';

  return (
    <div className="p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-vintage-dark mb-2">投资理财</h1>
          <div className="vintage-divider max-w-sm" />
        </header>

        <nav className="flex gap-1 mb-6 border-b border-vintage-brown border-opacity-20">
          {tabs.map((tab) => {
            const active = tab.path === '/investment' ? isRoot : location.pathname.startsWith(tab.path);
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-vintage-red text-vintage-red'
                    : 'border-transparent text-vintage-brown hover:text-vintage-dark'
                }`}
              >
                <tab.icon size={16} />
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <Outlet />
      </div>
    </div>
  );
}