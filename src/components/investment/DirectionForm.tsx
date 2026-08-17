import { useState, useEffect } from 'react';
import { listDomains } from '../../api/client';
import type { DomainInfo } from '../../api/types';

interface Props {
  initial?: {
    name: string;
    description: string;
    keywords: string;
    domain: string;
    enabled: boolean;
    priority: number;
    scanIntervalHours: number;
  };
  onSave: (input: {
    name: string; description: string; keywords: string; domain: string; enabled: boolean; priority: number; scanIntervalHours: number;
  }) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

export default function DirectionForm({ initial, onSave, onCancel, saving }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [keywords, setKeywords] = useState(initial?.keywords ?? '');
  const [domain, setDomain] = useState(initial?.domain ?? '');
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [priority, setPriority] = useState(initial?.priority ?? 0);
  const [scanIntervalHours, setScanIntervalHours] = useState(initial?.scanIntervalHours ?? 6);
  const [domains, setDomains] = useState<DomainInfo[]>([]);

  useEffect(() => {
    listDomains().then((list) => {
      setDomains(list);
      // 新建题材默认选第一个真实板块（不再提供“默认”伪板块）
      setDomain((current) => current || list[0]?.key || '');
    }).catch(() => setDomains([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !domain) return;
    await onSave({
      name: name.trim(),
      description: description.trim(),
      keywords: keywords.trim(),
      domain,
      enabled,
      priority,
      scanIntervalHours,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-vintage-dark mb-1">题材名称 *</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="如：商业航天" className="vintage-input w-full" autoFocus />
      </div>
      <div>
        <label className="block text-sm font-medium text-vintage-dark mb-1">自然语言描述</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)}
          placeholder="如：关注中国商业航天领域的火箭发射计划，特别是朱雀、天龙、双曲线等型号" rows={3}
          className="vintage-input w-full" />
      </div>
      <div>
        <label className="block text-sm font-medium text-vintage-dark mb-1">关键词（逗号分隔）</label>
        <input type="text" value={keywords} onChange={(e) => setKeywords(e.target.value)}
          placeholder="如：火箭,发射,卫星,航天" className="vintage-input w-full" />
      </div>
      <div>
        <label className="block text-sm font-medium text-vintage-dark mb-1">所属板块</label>
        <select value={domain} onChange={(e) => setDomain(e.target.value)}
          className="vintage-input w-full">
          {/* 编辑存量题材时，旧值（如遗留的 stock）不在板块列表里也原样展示，不静默改判 */}
          {domain && !domains.some((d) => d.key === domain) && (
            <option value={domain}>{domain === 'stock' ? '通用（待分配板块）' : domain}</option>
          )}
          {domains.map((d) => (
            <option key={d.key} value={d.key}>{d.name}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-vintage-dark mb-1">优先级</label>
          <input type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))}
            className="vintage-input w-full" />
        </div>
        <div>
          <label className="block text-sm font-medium text-vintage-dark mb-1">扫描间隔（小时）</label>
          <input type="number" value={scanIntervalHours} onChange={(e) => setScanIntervalHours(Number(e.target.value))}
            min={1} className="vintage-input w-full" />
        </div>
        <div className="flex items-end pb-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)}
              className="rounded" />
            <span className="text-sm text-vintage-dark">启用扫描</span>
          </label>
        </div>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={!name.trim() || saving} className="vintage-btn">
          {saving ? '保存中...' : '保存'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-vintage-brown hover:text-vintage-dark">取消</button>
      </div>
    </form>
  );
}