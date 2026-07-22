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
      {news.map((item) => (
        <Card key={item.id}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
              <p className="text-gray-600 text-sm mb-3">{item.content}</p>
              <div className="flex items-center gap-4 text-xs text-gray-500">
                {item.source && <span>来源：{item.source}</span>}
                {item.published_at && (
                  <span>{format(new Date(item.published_at), 'yyyy-MM-dd HH:mm')}</span>
                )}
              </div>
            </div>
            {item.url && (
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 text-blue-600 hover:text-blue-700"
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
