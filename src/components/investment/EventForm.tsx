import { useState } from 'react';
import type { TickerItem } from '../../api/types';
import TickerSelector from './TickerSelector';

interface EventInput {
  name: string;
  eventStartDate: string;
  eventEndDate: string;
  dateConfidence: 'exact' | 'fuzzy';
  ambushDays: number;
  tags: string[];
  tickerIds: string[];
  notes: string;
}

interface Props {
  initial?: EventInput;
  tickers: TickerItem[];
  onCreateTicker: (input: { symbol: string; name: string; market?: string }) => Promise<void>;
  onSave: (input: EventInput) => Promise<void>;
  onCancel: () => void;
  saving: boolean;
}

export default function EventForm({ initial, tickers, onCreateTicker, onSave, onCancel, saving }: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [eventStartDate, setEventStartDate] = useState(initial?.eventStartDate ?? '');
  const [eventEndDate, setEventEndDate] = useState(initial?.eventEndDate ?? '');
  const [dateConfidence, setDateConfidence] = useState<'exact' | 'fuzzy'>(initial?.dateConfidence ?? 'exact');
  const [ambushDays, setAmbushDays] = useState(initial?.ambushDays ?? 60);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [tickerIds, setTickerIds] = useState<string[]>(initial?.tickerIds ?? []);
  const [notes, setNotes] = useState(initial?.notes ?? '');

  function addTag() {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
    }
    setTagInput('');
  }

  function removeTag(tag: string) {
    setTags(tags.filter((t) => t !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !eventStartDate || !eventEndDate) return;
    await onSave({
      name: name.trim(),
      eventStartDate,
      eventEndDate,
      dateConfidence,
      ambushDays,
      tags,
      tickerIds,
      notes: notes.trim(),
    });
  }

  const valid = name.trim() && eventStartDate && eventEndDate;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-vintage-dark mb-1">事件名称 *</label>
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="如：朱雀三号首飞" className="vintage-input w-full" autoFocus
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-vintage-dark mb-1">事件开始日期 *</label>
          <input
            type="date" value={eventStartDate} onChange={(e) => setEventStartDate(e.target.value)}
            className="vintage-input w-full"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-vintage-dark mb-1">事件结束日期 *</label>
          <input
            type="date" value={eventEndDate} onChange={(e) => setEventEndDate(e.target.value)}
            className="vintage-input w-full"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-vintage-dark mb-1">日期精度</label>
          <select value={dateConfidence} onChange={(e) => setDateConfidence(e.target.value as 'exact' | 'fuzzy')}
            className="vintage-input w-full">
            <option value="exact">精确</option>
            <option value="fuzzy">模糊</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-vintage-dark mb-1">潜伏天数</label>
          <input
            type="number" value={ambushDays} onChange={(e) => setAmbushDays(Number(e.target.value))}
            min={1} className="vintage-input w-full"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-vintage-dark mb-1">板块标签</label>
        <div className="flex gap-2">
          <input
            type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            placeholder="输入标签后回车添加" className="vintage-input flex-1 text-sm"
          />
          <button type="button" onClick={addTag} className="vintage-btn text-sm px-3">添加</button>
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {tags.map((tag) => (
              <span key={tag}
                className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-vintage-brown bg-opacity-15 text-vintage-dark">
                {tag}
                <button type="button" onClick={() => removeTag(tag)} className="hover:text-vintage-red">&times;</button>
              </span>
            ))}
          </div>
        )}
      </div>

      <TickerSelector
        tickers={tickers}
        selectedIds={tickerIds}
        onSelect={setTickerIds}
        onCreateTicker={onCreateTicker}
      />

      <div>
        <label className="block text-sm font-medium text-vintage-dark mb-1">备注</label>
        <textarea
          value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
          placeholder="补充信息..." className="vintage-input w-full"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={!valid || saving} className="vintage-btn">
          {saving ? '保存中...' : '保存'}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-vintage-brown hover:text-vintage-dark">
          取消
        </button>
      </div>
    </form>
  );
}