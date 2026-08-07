import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Home, TrendingUp, Lightbulb, Briefcase, CheckSquare, Folder,
  Download, FileJson, FileText, Loader2,
} from 'lucide-react';
import { exportJSON, exportMarkdown } from '../../utils/export';
import type { ExportError } from '../../utils/export';
import bellUrl from '../../assets/bell.png';

const navItems = [
  { path: '/', icon: Home, label: '首页' },
  { path: '/investment', icon: TrendingUp, label: '投资理财', pendingDesign: true },
  { path: '/thoughts', icon: Lightbulb, label: '个人思考' },
  { path: '/career', icon: Briefcase, label: '职业生涯', pendingDesign: true },
  { path: '/todos', icon: CheckSquare, label: '待办规划' },
  { path: '/projects', icon: Folder, label: '个人项目', pendingDesign: true },
];

export default function Sidebar() {
  const [ringing, setRinging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const doExport = useCallback(async (fn: () => Promise<ExportError | null>) => {
    setExporting(true);
    setError(null);
    setMenuOpen(false);
    const err = await fn();
    setExporting(false);
    if (err) setError(err.message);
  }, []);

  return (
    <aside className="relative w-64 bg-vintage-paper border-r-2 border-dashed border-vintage-border flex-shrink-0">
      <div className="h-16 flex items-center justify-center px-6 border-b-2 border-dashed border-vintage-border">
        <div className="text-center">
          <h1 className="text-xl font-bold text-vintage-dark">个人看板</h1>
          <p className="text-xs text-vintage-brown vintage-number mt-1">NO.2026</p>
        </div>
      </div>
      <div className="border-b-2 border-dashed border-vintage-border px-4 py-4">
        <NavLink
          to="/chats"
          onClick={() => setRinging(true)}
          className={({ isActive }) =>
            `flex items-center gap-4 rounded border-2 px-4 py-3 transition-colors ${
              isActive
                ? 'bg-vintage-red text-white border-vintage-red shadow-md'
                : 'bg-vintage-red/90 text-white border-vintage-red shadow-md hover:bg-vintage-red'
            }`
          }
        >
          <span
            className={`inline-flex ${ringing ? 'bell-ring' : ''}`}
            onAnimationEnd={() => setRinging(false)}
          >
            <img src={bellUrl} alt="" className="h-14 w-auto" />
          </span>
          <span className="flex flex-col">
            <span className="text-lg font-bold tracking-wide">AI 对话</span>
            <span className="text-xs opacity-80">摇铃即问，小二候着</span>
          </span>
        </NavLink>
      </div>
      <nav className="p-4 pb-24 space-y-2">
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
        {error && (
          <div className="mb-2 flex items-center justify-between text-xs text-vintage-red">
            <span className="truncate">{error}</span>
            <button type="button" onClick={() => setError(null)} className="ml-2 hover:underline">
              关闭
            </button>
          </div>
        )}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            disabled={exporting}
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded border-2 border-dashed border-vintage-border text-vintage-dark hover:bg-white transition-colors disabled:opacity-50"
            title="导出数据"
          >
            {exporting ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Download size={16} />
            )}
            <span className="text-xs">导出</span>
          </button>
          {menuOpen && (
            <div className="absolute left-0 bottom-full mb-1 w-44 bg-white border-2 border-dashed border-vintage-border rounded shadow-lg z-50">
              <button
                type="button"
                onClick={() => doExport(exportJSON)}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm text-vintage-dark hover:bg-vintage-paper transition-colors"
              >
                <FileJson size={16} className="text-vintage-brown" />
                导出 JSON
              </button>
              <button
                type="button"
                onClick={() => doExport(exportMarkdown)}
                className="flex items-center gap-2 w-full px-4 py-2.5 text-left text-sm text-vintage-dark hover:bg-vintage-paper transition-colors"
              >
                <FileText size={16} className="text-vintage-brown" />
                导出 Markdown
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
