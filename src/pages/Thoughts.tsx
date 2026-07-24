import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../onedaycloud/client';
import { Tables } from '../onedaycloud/types';
import Card from '../components/common/Card';
import Loading from '../components/common/Loading';
import EmptyState from '../components/common/EmptyState';
import Modal from '../components/common/Modal';
import { Lightbulb, Tag, Calendar } from 'lucide-react';
import { format } from 'date-fns';

type Thought = Tables<'thoughts'>;

const categories = [
  { value: 'all', label: '全部' },
  { value: 'idea', label: 'Idea' },
  { value: 'life', label: '人生思考' },
  { value: 'sociology', label: '社会学' },
  { value: 'philosophy', label: '哲学' },
  { value: 'communication', label: '传播学' },
];

export default function Thoughts() {
  const { category: urlCategory } = useParams();
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState(urlCategory || 'all');
  const [selectedThought, setSelectedThought] = useState<Thought | null>(null);

  useEffect(() => {
    fetchThoughts();
  }, [selectedCategory]);

  const fetchThoughts = async () => {
    try {
      let query = supabase.from('thoughts').select('*').order('created_at', { ascending: false });

      if (selectedCategory !== 'all') {
        query = query.eq('category', selectedCategory);
      }

      const { data, error } = await query;
      if (error) throw error;
      setThoughts(data || []);
    } catch (error) {
      console.error('Error fetching thoughts:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex gap-3 overflow-x-auto pb-2">
          {categories.map((cat) => (
            <button
              key={cat.value}
              onClick={() => setSelectedCategory(cat.value)}
              className={`px-4 py-2 rounded font-medium whitespace-nowrap transition-all border-2 ${
                selectedCategory === cat.value
                  ? 'bg-vintage-red text-white border-vintage-red shadow-md'
                  : 'bg-vintage-paper text-vintage-dark border-dashed border-vintage-border hover:bg-white hover:shadow-sm'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {thoughts.length === 0 ? (
          <EmptyState
            icon={<Lightbulb size={64} />}
            title="暂无思考记录"
            description="开始记录您的想法和灵感"
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {thoughts.map((thought, index) => (
              <Card key={thought.id} number={String(index + 1).padStart(4, '0')} onClick={() => setSelectedThought(thought)}>
                <h3 className="text-lg font-bold text-vintage-dark mb-2">{thought.title}</h3>
                <div className="vintage-divider"></div>
                <p className="text-vintage-brown text-sm mb-4 line-clamp-4 mt-3">{thought.content}</p>
                <div className="flex items-center justify-between border-t border-dashed border-vintage-border pt-3">
                  <div className="vintage-stamp text-xs">
                    {categories.find((c) => c.value === thought.category)?.label}
                  </div>
                  <span className="text-xs vintage-number">
                    {format(new Date(thought.created_at!), 'yyyy.MM.dd')}
                  </span>
                </div>
                {thought.tags && thought.tags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap mt-3">
                    <Tag size={14} className="text-vintage-brown" />
                    {thought.tags.map((tag, idx) => (
                      <span key={idx} className="text-xs text-vintage-brown border border-vintage-border px-2 py-1 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}

        <Modal
          isOpen={!!selectedThought}
          onClose={() => setSelectedThought(null)}
          title={selectedThought?.title}
          size="lg"
        >
          {selectedThought && (
            <div className="p-6 bg-vintage-paper">
              <div className="flex items-center gap-4 mb-4">
                <div className="vintage-stamp">
                  {categories.find((c) => c.value === selectedThought.category)?.label}
                </div>
                <div className="flex items-center gap-2 text-sm vintage-number">
                  <Calendar size={16} />
                  {format(new Date(selectedThought.created_at!), 'yyyy年MM月dd日')}
                </div>
              </div>
              <div className="vintage-divider"></div>
              <div className="prose max-w-none mt-4">
                <p className="text-vintage-dark whitespace-pre-wrap">{selectedThought.content}</p>
              </div>
              {selectedThought.tags && selectedThought.tags.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap mt-6 pt-6 border-t-2 border-dashed border-vintage-border">
                  <Tag size={16} className="text-vintage-brown" />
                  {selectedThought.tags.map((tag, idx) => (
                    <span key={idx} className="px-3 py-1 bg-white text-vintage-dark text-sm rounded border-2 border-dashed border-vintage-border">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
