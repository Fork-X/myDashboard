import { useState, useEffect } from 'react';
import { supabase } from '../../onedaycloud/client';
import { Tables } from '../../onedaycloud/types';
import { format } from 'date-fns';
import Card from '../common/Card';
import Loading from '../common/Loading';
import EmptyState from '../common/EmptyState';
import { Newspaper, ExternalLink } from 'lucide-react';

type News = Tables<'hot_news'>;

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
      setNews(data || []);
    } catch (error) {
      console.error('Error fetching news:', error);
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
