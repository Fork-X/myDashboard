import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Download, FileJson, FileText, Loader2, User } from 'lucide-react';
import { exportJSON, exportMarkdown } from '../../utils/export';
import type { ExportError } from '../../utils/export';

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

  const [menuOpen, setMenuOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // click outside to close
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
    <>
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
          {/* export button */}
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              disabled={exporting}
              onClick={() => setMenuOpen((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded border-2 border-dashed border-vintage-border text-vintage-dark hover:bg-white transition-colors disabled:opacity-50"
              title="导出数据"
            >
              {exporting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Download size={18} />
              )}
              <span className="text-sm hidden sm:inline">导出</span>
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-44 bg-white border-2 border-dashed border-vintage-border rounded shadow-lg z-50">
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
          {/* user avatar */}
          <div className="w-10 h-10 rounded-full bg-vintage-brown flex items-center justify-center border-2 border-vintage-dark shadow-md">
            <User size={20} className="text-vintage-paper" />
          </div>
        </div>
      </header>
      {/* error banner */}
      {error && (
        <div className="bg-vintage-red/10 border-b-2 border-dashed border-vintage-red px-6 py-2 flex items-center justify-between">
          <span className="text-sm text-vintage-red">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-vintage-red hover:underline text-sm"
          >
            关闭
          </button>
        </div>
      )}
    </>
  );
}
