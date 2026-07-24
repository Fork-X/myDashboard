import { useState, useEffect } from 'react';
import { supabase } from '../../onedaycloud/client';
import { Tables } from '../../onedaycloud/types';
import Card from '../common/Card';
import Loading from '../common/Loading';
import EmptyState from '../common/EmptyState';
import { BookOpen, Tag } from 'lucide-react';

type Knowledge = Tables<'investment_knowledge'>;

export default function KnowledgeList() {
  const [knowledge, setKnowledge] = useState<Knowledge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKnowledge();
  }, []);

  const fetchKnowledge = async () => {
    try {
      const { data, error } = await supabase
        .from('investment_knowledge')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setKnowledge(data || []);
    } catch (error) {
      console.error('Error fetching knowledge:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;

  if (knowledge.length === 0) {
    return (
      <EmptyState
        icon={<BookOpen size={64} />}
        title="暂无投资知识"
        description="开始添加您的投资知识和经验"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {knowledge.map((item, index) => (
        <Card key={item.id} number={String(index + 1).padStart(4, '0')}>
          <h3 className="text-lg font-bold text-vintage-dark mb-2">{item.title}</h3>
          <div className="vintage-divider"></div>
          <p className="text-vintage-brown text-sm mb-4 line-clamp-3">{item.content}</p>
          {item.category && (
            <div className="vintage-stamp mb-3">
              {item.category}
            </div>
          )}
          {item.tags && item.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-dashed border-vintage-border">
              <Tag size={14} className="text-vintage-brown" />
              {item.tags.map((tag, idx) => (
                <span key={idx} className="text-xs text-vintage-brown border border-vintage-border px-2 py-1 rounded">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
