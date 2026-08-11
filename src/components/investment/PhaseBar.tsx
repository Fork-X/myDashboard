import { format, differenceInDays } from 'date-fns';

interface PhaseBarProps {
  eventStartDate: string;
  eventEndDate: string;
  ambushDays: number;
  today: string;
}

export default function PhaseBar({ eventStartDate, eventEndDate, ambushDays, today }: PhaseBarProps) {
  const ambushStart = addDays(eventStartDate, -ambushDays);
  const cashStart = addDays(eventStartDate, -7); // 兑现期起点
  const totalDays = differenceInDays(
    new Date(eventEndDate + 'T00:00:00'),
    new Date(ambushStart + 'T00:00:00'),
  );

  if (totalDays <= 0) return null;

  function pct(from: string, to: string) {
    const start = Math.max(0, differenceInDays(new Date(from + 'T00:00:00'), new Date(ambushStart + 'T00:00:00')));
    const end = Math.min(totalDays, differenceInDays(new Date(to + 'T00:00:00'), new Date(ambushStart + 'T00:00:00')));
    const w = Math.max(0, ((end - start) / totalDays) * 100);
    return { left: (start / totalDays) * 100, width: w };
  }

  const ambush = pct(ambushStart, cashStart);
  const cash = pct(cashStart, addDays(eventEndDate, 1));

  const todayOffset = (() => {
    const offset = differenceInDays(new Date(today + 'T00:00:00'), new Date(ambushStart + 'T00:00:00'));
    return Math.max(0, Math.min(totalDays, offset)) / totalDays * 100;
  })();

  // Week tick marks (every 7 days)
  const weekTicks: number[] = [];
  for (let d = 0; d <= totalDays; d += 7) {
    weekTicks.push((d / totalDays) * 100);
  }

  return (
    <div className="relative mt-3">
      {/* Top labels: 启动 / 兑现 */}
      <div className="relative h-4 mb-0.5">
        {ambush.width > 0 && (
          <span
            className="absolute text-[10px] text-vintage-brown whitespace-nowrap"
            style={{ left: `${ambush.left}%`, transform: 'translateX(-50%)' }}
          >
            启动
          </span>
        )}
        {cash.width > 0 && (
          <span
            className="absolute text-[10px] text-vintage-brown whitespace-nowrap"
            style={{ left: `${cash.left}%`, transform: 'translateX(-50%)' }}
          >
            兑现
          </span>
        )}
      </div>

      {/* Bar */}
      <div className="h-2.5 bg-vintage-brown bg-opacity-10 rounded-full overflow-hidden relative">
        {/* Week tick marks */}
        {weekTicks.map((p, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-px bg-vintage-brown bg-opacity-15"
            style={{ left: `${p}%` }}
          />
        ))}

        {/* 潜伏期 (blue) */}
        {ambush.width > 0 && (
          <div
            className="absolute h-full bg-blue-300 bg-opacity-60 rounded-l-full"
            style={{ left: `${ambush.left}%`, width: `${ambush.width}%` }}
          />
        )}

        {/* 兑现期 (amber/yellow) */}
        {cash.width > 0 && (
          <div
            className="absolute h-full bg-amber-300 bg-opacity-60 rounded-r-full"
            style={{ left: `${cash.left}%`, width: `${cash.width}%` }}
          />
        )}

        {/* Today marker — coordinate diamond */}
        <div
          className="absolute z-20"
          style={{ left: `${todayOffset}%`, top: '-3px', transform: 'translateX(-50%)' }}
        >
          <div className="w-2 h-2 bg-vintage-red rotate-45 border border-cream rounded-sm" />
        </div>
      </div>

      {/* Bottom labels — positioned to match top labels */}
      <div className="relative h-4 mt-1">
        {ambush.width > 0 && (
          <span
            className="absolute text-[10px] text-vintage-brown date-num whitespace-nowrap"
            style={{ left: `${ambush.left}%`, transform: 'translateX(-50%)' }}
          >
            {format(new Date(ambushStart + 'T00:00:00'), 'M.d')}
          </span>
        )}
        {cash.width > 0 && (
          <span
            className="absolute text-[10px] text-vintage-brown date-num whitespace-nowrap"
            style={{ left: `${cash.left}%`, transform: 'translateX(-50%)' }}
          >
            {format(new Date(cashStart + 'T00:00:00'), 'M.d')}
          </span>
        )}
        <span
          className="absolute text-[10px] text-vintage-brown date-num whitespace-nowrap"
          style={{ left: '100%', transform: 'translateX(-100%)' }}
        >
          {format(new Date(eventEndDate + 'T00:00:00'), 'M.d')}
        </span>
      </div>
    </div>
  );
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return format(d, 'yyyy-MM-dd');
}