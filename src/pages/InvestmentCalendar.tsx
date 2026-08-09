import { useState } from 'react';
import { Plus, Archive } from 'lucide-react';
import { useEvents } from '../hooks/useEvents';
import { useTickers } from '../hooks/useTickers';
import Card from '../components/common/Card';
import Loading from '../components/common/Loading';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';
import EventForm from '../components/investment/EventForm';
import EventDetail from '../components/investment/EventDetail';
import PhaseBar from '../components/investment/PhaseBar';
import type { EventItem } from '../api/types';
import { format } from 'date-fns';

export default function InvestmentCalendar() {
  const { data: events, loading, error, create, update } = useEvents();
  const { data: tickers, create: createTicker } = useTickers();
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  if (loading) return <Loading text="正在加载投资日历..." />;
  if (error) return <ErrorState message={error} />;

  const today = format(new Date(), 'yyyy-MM-dd');

  const activeEvents = events.filter((e) => e.status === 'active');
  const archivedEvents = events.filter((e) => e.status === 'archived');

  function getPhase(event: EventItem) {
    const start = event.eventStartDate;
    const ambushStart = addDays(start, -event.ambushDays);
    const cashStart = addDays(start, -7);

    if (today < ambushStart) return { label: '待潜伏', color: 'text-gray-400', order: 0 };
    if (today < cashStart) return { label: '潜伏期', color: 'text-blue-600', order: 1 };
    if (today <= event.eventEndDate) return { label: '兑现期', color: 'text-amber-600', order: 2 };
    return { label: '已结束', color: 'text-gray-500', order: 3 };
  }

  const sorted = [...activeEvents].sort((a, b) => {
    const pa = getPhase(a);
    const pb = getPhase(b);
    if (pa.order !== pb.order) return pa.order - pb.order;
    return a.eventStartDate.localeCompare(b.eventStartDate);
  });

  const fuzzyEvents = sorted.filter((e) => e.dateConfidence === 'fuzzy');
  const exactEvents = sorted.filter((e) => e.dateConfidence === 'exact');

  if (selectedEvent) {
    return (
      <EventDetail
        event={selectedEvent}
        onBack={() => setSelectedEvent(null)}
      />
    );
  }

  if (showForm) {
    return (
      <div>
        <button onClick={() => setShowForm(false)}
          className="text-sm text-vintage-brown hover:text-vintage-dark mb-4">
          &larr; 返回日历
        </button>
        <h2 className="text-xl font-bold text-vintage-dark mb-4">新建事件</h2>
        <EventForm
          tickers={tickers}
          onCreateTicker={createTicker}
          onSave={async (input) => {
            setSaving(true);
            try {
              await create(input);
              setShowForm(false);
            } finally {
              setSaving(false);
            }
          }}
          onCancel={() => setShowForm(false)}
          saving={saving}
        />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-vintage-dark">投资日历</h2>
        <div className="flex items-center gap-3">
          {archivedEvents.length > 0 && (
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`text-sm flex items-center gap-1.5 px-3 py-1.5 rounded border transition-colors ${
                showArchived
                  ? 'border-vintage-brown bg-vintage-brown bg-opacity-10 text-vintage-dark'
                  : 'border-vintage-brown border-opacity-30 text-vintage-brown hover:text-vintage-dark'
              }`}
            >
              <Archive size={14} />
              已归档 ({archivedEvents.length})
            </button>
          )}
          <button onClick={() => setShowForm(true)}
            className="vintage-btn flex items-center gap-2">
            <Plus size={18} /> 新建事件
          </button>
        </div>
      </div>

      {events.length === 0 ? (
        <EmptyState title="暂无投资事件" description="点击「新建事件」开始添加" />
      ) : (
        <div className="space-y-6">
          {fuzzyEvents.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-vintage-brown mb-3">日期待确认</h3>
              <div className="space-y-3">
                {fuzzyEvents.map((event) => (
                  <EventCard key={event.id} event={event} tickers={tickers} today={today}
                    onClick={() => setSelectedEvent(event)} />
                ))}
              </div>
            </div>
          )}

          {exactEvents.length > 0 && (
            <div className="space-y-3">
              {exactEvents.map((event) => (
                <EventCard key={event.id} event={event} tickers={tickers} today={today}
                  onClick={() => setSelectedEvent(event)} />
              ))}
            </div>
          )}

          {showArchived && archivedEvents.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-vintage-brown mb-3 mt-6">
                已归档 ({archivedEvents.length})
              </h3>
              <div className="space-y-2">
                {archivedEvents.map((event) => (
                  <EventCard key={event.id} event={event} tickers={tickers} today={today}
                    onClick={() => setSelectedEvent(event)} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EventCard({ event, tickers, today, onClick }: {
  event: EventItem; tickers: { id: string; symbol: string; name: string }[]; today: string; onClick: () => void;
}) {
  const phase = getPhaseLabel(event, today);
  const eventTickers = tickers.filter((t) => event.tickerIds.includes(t.id));
  const isArchived = event.status === 'archived';

  return (
    <Card className={`cursor-pointer hover:shadow-md transition-shadow ${isArchived ? 'opacity-60' : ''}`} onClick={onClick}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-vintage-dark">{event.name}</h3>
            {event.dateConfidence === 'fuzzy' && <span className="vintage-stamp text-xs">模糊</span>}
            {isArchived && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">已归档</span>
            )}
          </div>
          <p className="text-sm text-vintage-brown">
            <span className="date-num">{format(new Date(event.eventStartDate + 'T00:00:00'), 'M.d')}</span>
            {' ~ '}
            <span className="date-num">{format(new Date(event.eventEndDate + 'T00:00:00'), 'M.d')}</span>
          </p>
          <div className="flex items-center gap-3 mt-2">
            {event.tags.length > 0 && (
              <div className="flex gap-1">
                {event.tags.map((tag) => (
                  <span key={tag} className="px-1.5 py-0.5 text-xs rounded bg-vintage-brown bg-opacity-10 text-vintage-brown">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
          {eventTickers.length > 0 && (
            <p className="text-xs text-vintage-brown mt-1">
              标的：{eventTickers.map((t) => `${t.symbol} ${t.name}`).join('、')}
            </p>
          )}
          <PhaseBar
            eventStartDate={event.eventStartDate}
            eventEndDate={event.eventEndDate}
            ambushDays={event.ambushDays}
            today={today}
          />
        </div>
        <span className={`text-xs font-medium ${phase.color}`}>{phase.label}</span>
      </div>
    </Card>
  );
}

function getPhaseLabel(event: EventItem, today: string) {
  const start = event.eventStartDate;
  const ambushStart = addDays(start, -event.ambushDays);
  const cashStart = addDays(start, -7);

  if (today < ambushStart) return { label: '待潜伏', color: 'text-gray-400' };
  if (today < cashStart) return { label: '潜伏期', color: 'text-blue-600' };
  if (today <= event.eventEndDate) return { label: '兑现期', color: 'text-amber-600' };
  return { label: '已结束', color: 'text-gray-500' };
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return format(d, 'yyyy-MM-dd');
}