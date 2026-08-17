import { useState } from 'react';
import { Plus, Power, Play, Clock, Trash2 } from 'lucide-react';
import { useDirections } from '../hooks/useDirections';
import Loading from '../components/common/Loading';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';
import DirectionForm from '../components/investment/DirectionForm';
import type { DirectionItem } from '../api/types';
import { format } from 'date-fns';

export default function DirectionBoard() {
  const { data: directions, loading, error, create, update, remove, scan } = useDirections();
  const [showForm, setShowForm] = useState(false);
  const [editingDir, setEditingDir] = useState<DirectionItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState<string | null>(null);

  if (loading) return <Loading text="正在加载题材列表..." />;
  if (error) return <ErrorState message={error} />;

  async function handleSave(input: {
    name: string; description: string; keywords: string; domain: string; enabled: boolean; priority: number; scanIntervalHours: number;
  }) {
    setSaving(true);
    try {
      if (editingDir) {
        await update(editingDir.id, input);
      } else {
        await create(input);
      }
      setShowForm(false);
      setEditingDir(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleScan(id: string) {
    setScanning(id);
    try {
      await scan(id);
    } finally {
      setScanning(null);
    }
  }

  if (showForm || editingDir) {
    return (
      <div>
        <button onClick={() => { setShowForm(false); setEditingDir(null); }}
          className="text-sm text-vintage-brown hover:text-vintage-dark mb-4">
          &larr; 返回题材列表
        </button>
        <h2 className="text-xl font-bold text-vintage-dark mb-4">
          {editingDir ? '编辑题材' : '新建题材'}
        </h2>
        <DirectionForm
          initial={editingDir ? {
            name: editingDir.name,
            description: editingDir.description,
            keywords: editingDir.keywords,
            domain: editingDir.domain,
            enabled: editingDir.enabled,
            priority: editingDir.priority,
            scanIntervalHours: editingDir.scanIntervalHours,
          } : undefined}
          onSave={handleSave}
          onCancel={() => { setShowForm(false); setEditingDir(null); }}
          saving={saving}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-vintage-dark">扫描题材</h2>
        <button onClick={() => setShowForm(true)}
          className="vintage-btn flex items-center gap-2">
          <Plus size={18} /> 新建题材
        </button>
      </div>

      {directions.length === 0 ? (
        <EmptyState title="暂无扫描题材" description="新建题材后，AI 将按此题材扫描投资事件" />
      ) : (
        <div className="space-y-3">
          {directions.map((dir) => (
            <div key={dir.id} className="border border-vintage-brown border-opacity-20 rounded p-4 bg-cream">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-vintage-dark">{dir.name}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                      {dir.domain}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      dir.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {dir.enabled ? '启用' : '停用'}
                    </span>
                    <span className="vintage-number text-xs">优先级 {dir.priority}</span>
                  </div>
                  {dir.description && (
                    <p className="text-sm text-vintage-brown mb-1">{dir.description}</p>
                  )}
                  {dir.keywords && (
                    <p className="text-xs text-vintage-brown">
                      关键词：{dir.keywords}
                    </p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-xs text-vintage-brown">
                    <span className="flex items-center gap-1"><Clock size={12} /> 每 {dir.scanIntervalHours}h 扫描</span>
                    {dir.lastScannedAt && (
                      <span>上次扫描：{format(new Date(dir.lastScannedAt), 'MM-dd HH:mm')}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <button
                    onClick={() => handleScan(dir.id)}
                    disabled={scanning === dir.id || !dir.enabled}
                    className="vintage-btn text-xs px-3 py-1.5 flex items-center gap-1"
                  >
                    <Play size={14} />
                    {scanning === dir.id ? '扫描中...' : '扫描'}
                  </button>
                  <button
                    onClick={() => update(dir.id, { enabled: !dir.enabled })}
                    className={`text-xs px-2 py-1.5 rounded border ${
                      dir.enabled ? 'border-green-400 text-green-600' : 'border-gray-400 text-gray-500'
                    }`}
                    title={dir.enabled ? '停用' : '启用'}
                  >
                    <Power size={14} />
                  </button>
                  <button onClick={() => setEditingDir(dir)}
                    className="text-xs px-2 py-1.5 text-vintage-brown hover:text-vintage-dark">
                    编辑
                  </button>
                  <button onClick={() => { if (confirm('确定删除此题材？')) remove(dir.id); }}
                    className="text-xs px-2 py-1.5 text-vintage-red hover:text-red-700">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}