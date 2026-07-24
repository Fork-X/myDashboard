import { useState, useEffect } from 'react';
import { supabase } from '../../onedaycloud/client';
import { Tables } from '../../onedaycloud/types';
import { format } from 'date-fns';
import Card from '../common/Card';
import Loading from '../common/Loading';
import EmptyState from '../common/EmptyState';
import { Newspaper, ExternalLink } from 'lucide-react';

type News = Tables<'hot_news'>;

const mockNews: News[] = [
  {
    id: 'mock-1',
    title: 'AI大模型技术突破，多家科技巨头发布新产品',
    content: '本周多家科技公司发布了最新的AI大模型产品，性能大幅提升。市场预计AI产业链将迎来新一轮投资热潮，相关概念股表现活跃。',
    source: '财经新闻',
    url: 'https://example.com/news/1',
    published_at: '2024-03-15T09:30:00Z',
    created_at: '2024-03-15T09:30:00Z',
    updated_at: '2024-03-15T09:30:00Z'
  },
  {
    id: 'mock-2',
    title: '央行宣布降准0.5个百分点，释放长期资金约1万亿',
    content: '为支持实体经济发展，央行决定于3月20日下调金融机构存款准备金率0.5个百分点。此次降准将释放长期资金约1万亿元，有利于降低企业融资成本。',
    source: '央行公告',
    url: 'https://example.com/news/2',
    published_at: '2024-03-14T16:00:00Z',
    created_at: '2024-03-14T16:00:00Z',
    updated_at: '2024-03-14T16:00:00Z'
  },
  {
    id: 'mock-3',
    title: '新能源汽车销量持续增长，渗透率突破40%',
    content: '2月份新能源汽车销量同比增长35%，市场渗透率首次突破40%。行业分析师认为，随着技术进步和成本下降，新能源汽车将继续保持高速增长。',
    source: '汽车行业协会',
    url: 'https://example.com/news/3',
    published_at: '2024-03-13T14:20:00Z',
    created_at: '2024-03-13T14:20:00Z',
    updated_at: '2024-03-13T14:20:00Z'
  },
  {
    id: 'mock-4',
    title: '美联储维持利率不变，暗示年内可能降息',
    content: '美联储宣布维持联邦基金利率在5.25%-5.50%区间不变，但会议纪要显示，多数委员认为年内可能开始降息。市场对此反应积极，美股三大指数集体上涨。',
    source: '路透社',
    url: 'https://example.com/news/4',
    published_at: '2024-03-13T02:00:00Z',
    created_at: '2024-03-13T02:00:00Z',
    updated_at: '2024-03-13T02:00:00Z'
  },
  {
    id: 'mock-5',
    title: '半导体行业回暖，多家芯片厂商上调业绩预期',
    content: '随着AI需求爆发和库存去化完成，半导体行业迎来复苏。多家芯片制造商上调了全年业绩预期，行业景气度持续提升。',
    source: '科技日报',
    url: 'https://example.com/news/5',
    published_at: '2024-03-12T10:15:00Z',
    created_at: '2024-03-12T10:15:00Z',
    updated_at: '2024-03-12T10:15:00Z'
  }
];

export default function NewsList() {
  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNews();
  }, []);

  const fetchNews = async () => {
    try {
      const { data, error } = await supabase
        .from('hot_news')
        .select('*')
        .order('published_at', { ascending: false });

      if (error) throw error;
      const dbData = data || [];
      setNews(dbData.length > 0 ? dbData : mockNews);
    } catch (error) {
      console.error('Error fetching news:', error);
      setNews(mockNews);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;

  if (news.length === 0) {
    return (
      <EmptyState
        icon={<Newspaper size={64} />}
        title="暂无热点消息"
        description="热点消息将在这里显示"
      />
    );
  }

  return (
    <div className="space-y-4">
      {news.map((item, index) => (
        <Card key={item.id} number={String(index + 1).padStart(4, '0')}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <Newspaper size={20} className="text-vintage-brown" />
                <h3 className="text-lg font-bold text-vintage-dark">{item.title}</h3>
              </div>
              <div className="vintage-divider"></div>
              <p className="text-vintage-brown text-sm mb-3 mt-3">{item.content}</p>
              <div className="flex items-center gap-4 text-xs text-vintage-brown border-t border-dashed border-vintage-border pt-3">
                {item.source && (
                  <span className="vintage-number">来源: {item.source}</span>
                )}
                {item.published_at && (
                  <span className="vintage-number">
                    {format(new Date(item.published_at), 'yyyy.MM.dd HH:mm')}
                  </span>
                )}
              </div>
            </div>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-vintage-red hover:text-vintage-dark transition-colors"
              >
                <ExternalLink size={20} />
              </a>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}
