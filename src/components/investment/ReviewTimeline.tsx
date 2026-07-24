import { useState, useEffect } from 'react';
import { supabase } from '../../onedaycloud/client';
import { Tables } from '../../onedaycloud/types';
import { format } from 'date-fns';
import Card from '../common/Card';
import Loading from '../common/Loading';
import EmptyState from '../common/EmptyState';
import { Calendar } from 'lucide-react';

type Review = Tables<'investment_reviews'>;

const mockReviews: Review[] = [
  {
    id: 'mock-1',
    date: '2024-03-15',
    market_summary: '三大指数集体收涨，沪指涨0.8%，创业板指涨1.2%。AI概念股继续活跃，新能源板块有所回调。',
    content: '今日操作：\n1. 加仓了某AI芯片龙头股，理由是业绩超预期且估值合理\n2. 减持了部分新能源持仓，获利了结\n\n心得体会：\n市场情绪较为乐观，但需要警惕追高风险。继续坚持价值投资理念，不追热点。',
    created_at: '2024-03-15T20:00:00Z',
    updated_at: '2024-03-15T20:00:00Z'
  },
  {
    id: 'mock-2',
    date: '2024-03-14',
    market_summary: '市场震荡调整，沪��跌0.3%，科技股分化明显。北向资金净流入20亿。',
    content: '今日操作：\n无操作，继续观望\n\n心得体会：\n市场处于震荡期，不急于操作。重点关注年报披露情况，寻找业绩超预期的标的。保持耐心，等待更好的买入时机。',
    created_at: '2024-03-14T20:00:00Z',
    updated_at: '2024-03-14T20:00:00Z'
  },
  {
    id: 'mock-3',
    date: '2024-03-13',
    market_summary: '大盘低开高走，沪指涨1.5%，成交量明显放大。消费板块领涨，医药股表现强势。',
    content: '今日操作：\n1. 建仓某医药龙头，看好其创新药管线\n2. 继续持有核心资产不动\n\n心得体会：\n市场风格有所切换，价值股开始受到关注。医药板块经过长期调整后，部分优质标的已具备配置价值。',
    created_at: '2024-03-13T20:00:00Z',
    updated_at: '2024-03-13T20:00:00Z'
  },
  {
    id: 'mock-4',
    date: '2024-03-12',
    market_summary: '市场继续调整，沪指跌1.2%，两市成交额萎缩。外围市场波动加大。',
    content: '今日操作：\n无操作，持股待涨\n\n心得体会：\n短期市场受外部因素影响较大，但不改变长期向好的趋势。坚持长期投资理念，不被短期波动影响。利用调整机会梳理持仓，优化组合结构。',
    created_at: '2024-03-12T20:00:00Z',
    updated_at: '2024-03-12T20:00:00Z'
  }
];

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
      const dbData = data || [];
      setReviews(dbData.length > 0 ? dbData : mockReviews);
    } catch (error) {
      console.error('Error fetching reviews:', error);
      setReviews(mockReviews);
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
