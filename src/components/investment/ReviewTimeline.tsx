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
      {reviews.map((review, index) => (
        <Card key={review.id} number={format(new Date(review.date), 'MMdd')}>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 w-16 h-16 bg-vintage-brown bg-opacity-10 rounded-lg flex items-center justify-center border-2 border-dashed border-vintage-brown">
              <Calendar className="text-vintage-brown" size={24} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-vintage-dark">
                  {format(new Date(review.date), 'yyyy年MM月dd日')}
                </h3>
                <div className="vintage-stamp">
                  已复盘
                </div>
              </div>
              <div className="vintage-divider"></div>
              {review.market_summary && (
                <div className="mb-3">
                  <span className="text-sm font-bold text-vintage-dark">市场总结</span>
                  <p className="text-vintage-brown text-sm mt-1">{review.market_summary}</p>
                </div>
              )}
              <div>
                <span className="text-sm font-bold text-vintage-dark">复盘内容</span>
                <p className="text-vintage-brown text-sm mt-1 whitespace-pre-wrap">{review.content}</p>
              </div>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}
