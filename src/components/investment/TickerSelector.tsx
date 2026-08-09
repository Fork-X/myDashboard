import { useState, useRef, useEffect } from 'react';
import type { TickerItem } from '../../api/types';

interface Props {
  tickers: TickerItem[];
  selectedIds: string[];
  onSelect: (ids: string[]) => void;
  onCreateTicker: (input: { symbol: string; name: string; market?: string }) => Promise<void>;
}

export default function TickerSelector({ tickers, selectedIds, onSelect, onCreateTicker }: Props) {
  const [search, setSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newSymbol, setNewSymbol] = useState('');
  const [newName, setNewName] = useState('');
  const [newMarket, setNewMarket] = useState('');
  const [creating, setCreating] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const filtered = tickers.filter(
    (t) =>
      t.symbol.toLowerCase().includes(search.toLowerCase())
      || t.name.toLowerCase().includes(search.toLowerCase()),
  );

  const selected = tickers.filter((t) => selectedIds.includes(t.id));

  function toggle(id: string) {
    const next = selectedIds.includes(id)
      ? selectedIds.filter((i) => i !== id)
      : [...selectedIds, id];
    onSelect(next);
  }

  async function handleCreate() {
    if (!newSymbol.trim() || !newName.trim() || creating) return;
    setCreating(true);
    try {
      await onCreateTicker({ symbol: newSymbol.trim(), name: newName.trim(), market: newMarket.trim() });
      setNewSymbol('');
      setNewName('');
      setNewMarket('');
      setShowCreate(false);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-medium text-vintage-dark mb-1">关联标的</label>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selected.map((t) => (
            <span
              key={t.id}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-vintage-brown bg-opacity-15 text-vintage-dark"
            >
              {t.symbol} {t.name}
              <button type="button" onClick={() => toggle(t.id)} className="hover:text-vintage-red">&times;</button>
            </span>
          ))}
        </div>
      )}

      <input
        type="text"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setShowDropdown(true); }}
        onFocus={() => setShowDropdown(true)}
        placeholder="搜索标的..."
        className="vintage-input w-full text-sm"
      />

      {showDropdown && (
        <div className="absolute z-20 mt-1 w-full bg-cream border border-vintage-brown border-opacity-30 rounded shadow-lg max-h-48 overflow-y-auto">
          {filtered.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              className={`w-full text-left px-3 py-2 text-sm hover:bg-vintage-brown hover:bg-opacity-10 flex items-center justify-between ${
                selectedIds.includes(t.id) ? 'bg-vintage-brown bg-opacity-10' : ''
              }`}
            >
              <span>{t.symbol} - {t.name}</span>
              {selectedIds.includes(t.id) && <span className="text-vintage-red text-xs">✓</span>}
            </button>
          ))}
          {!showCreate && (
            <button
              type="button"
              onClick={() => { setShowCreate(true); setShowDropdown(false); }}
              className="w-full text-left px-3 py-2 text-sm text-vintage-brown hover:bg-vintage-brown hover:bg-opacity-10 border-t border-vintage-brown border-opacity-20"
            >
              + 新建标的
            </button>
          )}
        </div>
      )}

      {showCreate && (
        <div className="mt-2 p-3 border border-dashed border-vintage-brown border-opacity-40 rounded">
          <div className="grid grid-cols-3 gap-2 mb-2">
            <input
              type="text" value={newSymbol} onChange={(e) => setNewSymbol(e.target.value)}
              placeholder="代码 (如 600XXX)" className="vintage-input text-sm"
            />
            <input
              type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
              placeholder="名称" className="vintage-input text-sm"
            />
            <input
              type="text" value={newMarket} onChange={(e) => setNewMarket(e.target.value)}
              placeholder="市场 (可选)" className="vintage-input text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleCreate} disabled={creating}
              className="vintage-btn text-sm px-3 py-1">
              {creating ? '创建中...' : '创建'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)}
              className="text-sm text-vintage-brown hover:text-vintage-dark">
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}