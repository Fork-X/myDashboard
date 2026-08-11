import { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, Archive, Edit3, Trash2, Undo2 } from 'lucide-react';
import type { EventItem, TickerItem } from '../../api/types';
import { useEvents } from '../../hooks/useEvents';
import { useTickers } from '../../hooks/useTickers';
import EventForm from './EventForm';
import { format } from 'date-fns';

interface Props {
  event: EventItem;
  onBack: () => void;
}

export default function EventDetail({ event: initialEvent, onBack }: Props) {
  const { update, remove } = useEvents();
  const { data: tickers, create: createTicker } = useTickers();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [currentEvent, setCurrentEvent] = useState(initialEvent);

  // Sync with parent prop when event changes (e.g. after edit/archive)
  useEffect(() => {
    setCurrentEvent(initialEvent);
  }, [initialEvent]);

  const today = format(new Date(), 'yyyy-MM-dd');
  const isEnded = today > currentEvent.eventEndDate;
  const isArchived = currentEvent.status === 'archived';

  const handleSave = useCallback(async (input: {
    name: string; eventStartDate: string; eventEndDate: string;
    dateConfidence: 'exact' | 'fuzzy'; ambushDays: number;
    tags: string[]; tickerIds: string[]; notes: string;
  }) => {
    setSaving(true);
    try {
      await update(currentEvent.id, input);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }, [currentEvent.id, update]);

  const handleArchive = useCallback(async () => {
    setSaving(true);
    try {
      await update(currentEvent.id, { status: isArchived ? 'active' : 'archived' });
    } finally {
      setSaving(false);
    }
  }, [currentEvent.id, currentEvent.status, update, isArchived]);

  const handleDelete = useCallback(async () => {
    if (!confirm('确定删除此事件吗？')) return;
    setDeleting(true);
    try {
      await remove(currentEvent.id);
      onBack();
    } finally {
      setDeleting(false);
    }
  }, [currentEvent.id, remove, onBack]);

  const eventTickers = tickers.filter((t) => currentEvent.tickerIds.includes(t.id));

  if (editing) {
    return (
      <div>
        <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-sm text-vintage-brown hover:text-vintage-dark mb-4">
          <ArrowLeft size={16} /> 返回详情
        </button>
        <h2 className="text-xl font-bold text-vintage-dark mb-4">编辑事件</h2>
        <EventForm
          initial={{
            name: currentEvent.name,
            eventStartDate: currentEvent.eventStartDate,
            eventEndDate: currentEvent.eventEndDate,
            dateConfidence: currentEvent.dateConfidence,
            ambushDays: currentEvent.ambushDays,
            tags: currentEvent.tags,
            tickerIds: currentEvent.tickerIds,
            notes: currentEvent.notes,
          }}
          tickers={tickers}
          onCreateTicker={createTicker}
          onSave={handleSave}
          onCancel={() => setEditing(false)}
          saving={saving}
        />
      </div>
    );
  }

  return (
    <div>
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-vintage-brown hover:text-vintage-dark mb-4">
        <ArrowLeft size={16} /> 返回日历
      </button>

      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-2xl font-bold text-vintage-dark">{currentEvent.name}</h2>
          <p className="text-sm text-vintage-brown mt-1">
            <span className="date-num">{format(new Date(currentEvent.eventStartDate + 'T00:00:00'), 'M.d')}</span>
            {' ~ '}
            <span className="date-num">{format(new Date(currentEvent.eventEndDate + 'T00:00:00'), 'M.d')}</span>
            {currentEvent.dateConfidence === 'fuzzy' && <span className="vintage-stamp text-xs ml-2">模糊</span>}
          </p>
        </div>
        <div className="flex gap-2">
          {isEnded && (
            <button
              onClick={handleArchive}
              disabled={saving}
              className={`text-sm px-3 py-1.5 rounded flex items-center gap-1 border transition-colors ${
                isArchived
                  ? 'border-vintage-brown text-vintage-brown hover:bg-vintage-brown hover:text-cream'
                  : 'border-vintage-brown text-vintage-brown hover:bg-vintage-brown hover:text-cream'
              }`}
              title={isArchived ? '取消归档' : '归档'}
            >
              {isArchived ? <Undo2 size={14} /> : <Archive size={14} />}
              {isArchived ? '取消归档' : '归档'}
            </button>
          )}
          <button onClick={() => setEditing(true)} className="vintage-btn text-sm px-3 py-1.5 flex items-center gap-1">
            <Edit3 size={14} /> 编辑
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="text-sm px-3 py-1.5 border border-vintage-red text-vintage-red rounded hover:bg-vintage-red hover:text-cream flex items-center gap-1">
            <Trash2 size={14} /> {deleting ? '删除中...' : '删除'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 bg-vintage-brown bg-opacity-5 rounded">
          <p className="text-xs text-vintage-brown">潜伏天数</p>
          <p className="text-lg font-bold text-vintage-dark">{currentEvent.ambushDays} 天</p>
        </div>
        <div className="p-3 bg-vintage-brown bg-opacity-5 rounded">
          <p className="text-xs text-vintage-brown">状态</p>
          <p className="text-lg font-bold text-vintage-dark">
            {isArchived ? '已归档' : currentEvent.status === 'active' ? '进行中' : '已归档'}
          </p>
        </div>
      </div>

      {currentEvent.tags.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-vintage-dark mb-1">板块标签</p>
          <div className="flex flex-wrap gap-1.5">
            {currentEvent.tags.map((tag) => (
              <span key={tag} className="px-2 py-0.5 text-xs rounded-full bg-vintage-brown bg-opacity-15 text-vintage-dark">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {eventTickers.length > 0 && (
        <div className="mb-4">
          <p className="text-sm font-medium text-vintage-dark mb-1">关联标的</p>
          <div className="flex flex-wrap gap-1.5">
            {eventTickers.map((t) => (
              <span key={t.id} className="px-2 py-0.5 text-xs rounded-full bg-vintage-brown bg-opacity-15 text-vintage-dark">
                {t.symbol} {t.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {currentEvent.notes && (
        <div className="mb-4">
          <p className="text-sm font-medium text-vintage-dark mb-1">备注</p>
          <p className="text-sm text-vintage-brown whitespace-pre-wrap">{currentEvent.notes}</p>
        </div>
      )}
    </div>
  );
}