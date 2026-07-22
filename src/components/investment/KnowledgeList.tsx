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
      {knowledge.map((item) => (
        <Card key={item.id}>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{item.title}</h3>
          <p className="text-gray-600 text-sm mb-4 line-clamp-3">{item.content}</p>
          {item.category && (
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs rounded-full mb-3">
              {item.category}
            </span>
          )}
          {item.tags && item.tags.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <Tag size={14} className="text-gray-400" />
              {item.tags.map((tag, index) => (
                <span key={index} className="text-xs text-gray-500">
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
