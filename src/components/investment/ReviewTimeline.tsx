import type { RecordItem } from '../../api/types';
import { format } from 'date-fns';
import Card from '../common/Card';
import EmptyState from '../common/EmptyState';
import { Calendar } from 'lucide-react';

export default function ReviewTimeline({ records }: { records: RecordItem[] }) {
  if (records.length === 0) {
    return (
      <EmptyState
        icon={<Calendar size={64} />}
        title="暂无复盘记录"
        description="开始记录您的投资复盘与决策"
      />
    );
  }

  return (
    <div className="space-y-6">
      {records.map((review) => {
        const date = review.occurredAt ?? review.updatedAt;
        const isDecision = review.type === 'decision';

        return (
          <Card key={review.id} number={format(new Date(date), 'MMdd')}>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-16 h-16 bg-vintage-brown bg-opacity-10 rounded-lg flex items-center justify-center border-2 border-dashed border-vintage-brown">
                <Calendar className="text-vintage-brown" size={24} />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-lg font-bold text-vintage-dark">
                    {format(new Date(date), 'yyyy年MM月dd日')}
                  </h3>
                  <div className="vintage-stamp">
                    {isDecision ? '已决策' : '已复盘'}
                  </div>
                </div>
                <div className="vintage-divider"></div>
                {review.title && (
                  <div className="mb-3">
                    <span className="text-sm font-bold text-vintage-dark">市场总结</span>
                    <p className="text-vintage-brown text-sm mt-1">{review.title}</p>
                  </div>
                )}
                <div>
                  <span className="text-sm font-bold text-vintage-dark">
                    {isDecision ? '决策内容' : '复盘内容'}
                  </span>
                  <p className="text-vintage-brown text-sm mt-1 whitespace-pre-wrap">{review.content}</p>
                </div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
