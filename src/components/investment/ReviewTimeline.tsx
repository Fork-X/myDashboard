import { useState, useEffect } from 'react';
import { supabase } from '../../onedaycloud/client';
import { Tables } from '../../onedaycloud/types';
import { format } from 'date-fns';
import Card from '../common/Card';
import Loading from '../common/Loading';
import EmptyState from '../common/EmptyState';
import { Calendar } from 'lucide-react';

type Review = Tables<'investment_reviews'>;

export default function ReviewTimeline() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('investment_reviews')
        .select('*')
        .order('date', { ascending: false });

      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;

  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={<Calendar size={64} />}
        title="暂无复盘记录"
        description="开始记录您的每日投资复盘"
      />
    );
  }

  return (
    <div className="space-y-6">
      {reviews.map((review) => (
        <Card key={review.id}>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center">
              <Calendar className="text-blue-600" size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  {format(new Date(review.date), 'yyyy年MM月dd日')}
                </h3>
              </div>
              {review.market_summary && (
                <div className="mb-3">
                  <span className="text-sm font-medium text-gray-700">市场总结：</span>
                  <p className="text-gray-600 text-sm mt-1">{review.market_summary}</p>
                </div>
              )}
              <div>
                <span className="text-sm font-medium text-gray-700">复盘内容：</span>
                <p className="text-gray-600 text-sm mt-1 whitespace-pre-wrap">{review.content}</p>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
