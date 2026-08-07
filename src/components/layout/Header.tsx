import { useLocation } from 'react-router-dom';
import { User } from 'lucide-react';

const pageTitles: Record<string, string> = {
  '/': '欢迎回来',
  '/investment': '投资理财',
  '/thoughts': '个人思考',
  '/chats': 'AI 对话',
  '/career': '职业生涯',
  '/todos': '待办规划',
  '/projects': '个人项目',
};

export default function Header() {
  const location = useLocation();
  const currentPath = '/' + location.pathname.split('/')[1];
  const title = pageTitles[currentPath] || '个人看板';

  return (
    <header className="h-16 bg-vintage-paper border-b-2 border-dashed border-vintage-border flex items-center justify-between px-6 relative">
      <div className="absolute top-2 left-6 vintage-stamp text-xs">
        {new Date().getFullYear()}年
      </div>
      <div className="flex items-center gap-4">
        <h2 className="text-2xl font-bold text-vintage-dark">{title}</h2>
        <span className="vintage-number text-sm">
          {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '.')}
        </span>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-vintage-brown flex items-center justify-center border-2 border-vintage-dark shadow-md">
          <User size={20} className="text-vintage-paper" />
        </div>
      </div>
    </header>
  );
}
