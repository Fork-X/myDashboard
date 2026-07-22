import { useLocation } from 'react-router-dom';
import { User } from 'lucide-react';

const pageTitles: Record<string, string> = {
  '/': '欢迎回来',
  '/investment': '投资理财',
  '/thoughts': '个人思考',
  '/career': '职业生涯',
  '/todos': '待办规划',
  '/projects': '个人项目',
};

export default function Header() {
  const location = useLocation();
  const currentPath = '/' + location.pathname.split('/')[1];
  const title = pageTitles[currentPath] || '个人看板';

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <h2 className="text-2xl font-semibold text-gray-800">{title}</h2>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
          <User size={20} className="text-blue-600" />
        </div>
      </div>
    </header>
  );
}
