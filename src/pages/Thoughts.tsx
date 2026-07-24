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

const mockThoughts: Thought[] = [
  {
    id: 'mock-1',
    title: '关于时间管理的思考',
    content: '时间是最公平的资源，每个人每天都只有24小时。真正的时间管理不是把每分每秒都填满，而是学会做减法，专注于真正重要的事情。\n\n重要的不是你做了多少事，而是你做的事是否有意义。很多时候，我们忙碌只是为了逃避思考。\n\n建议：每天留出30分钟的空白时间，用来思考和复盘。',
    category: 'life',
    tags: ['时间管理', '效率', '人生'],
    created_at: '2024-03-10T10:00:00Z',
    updated_at: '2024-03-10T10:00:00Z'
  },
  {
    id: 'mock-2',
    title: '信息茧房与认知偏差',
    content: '算法推荐让我们越来越多地接触到符合自己观点的信息，形成了"信息茧房"。这种现象加剧了认知偏差，让我们难以客观看待问题。\n\n打破信息茧房的方法：\n1. 主动寻找不同观点\n2. 定期阅读不同领域的内容\n3. 与持不同观点的人交流\n4. 保持批判性思维',
    category: 'communication',
    tags: ['信息茧房', '算法', '认知偏差'],
    created_at: '2024-03-08T14:30:00Z',
    updated_at: '2024-03-08T14:30:00Z'
  },
  {
    id: 'mock-3',
    title: '内卷与躺平的辩证思考',
    content: '内卷和躺平看似对立，实则都是对现实的一种回应。内卷是过度竞争的结果，躺平是对内卷的消极抵抗。\n\n真正的出路不是二选一，而是找到自己的节奏：\n- 在重要的事情上全力以赴\n- 在不重要的事情上适度放松\n- 建立自己的价值评判标准\n- 不被外界的焦虑裹挟',
    category: 'sociology',
    tags: ['内卷', '躺平', '社会现象'],
    created_at: '2024-03-05T09:15:00Z',
    updated_at: '2024-03-05T09:15:00Z'
  },
  {
    id: 'mock-4',
    title: '产品设计中的人性洞察',
    content: '好的产品设计源于对人性的深刻理解。人们不是理性的，而是情绪化的；不是追求完美，而是追求"足够好"。\n\n设计原则：\n1. 降低认知负担\n2. 即时反馈\n3. 容错设计\n4. 情感化设计\n\n案例：微信的"拍一拍"功能，看似简单，实则满足了人们轻量化社交的需求。',
    category: 'idea',
    tags: ['产品设计', '用户体验', '人性'],
    created_at: '2024-03-01T16:45:00Z',
    updated_at: '2024-03-01T16:45:00Z'
  },
  {
    id: 'mock-5',
    title: '存在主义与人生意义',
    content: '萨特说："存在先于本质"。我们被抛入这个世界，没有预设的人生意义，意义需要我们自己去创造。\n\n这既是自由，也是责任。自由意味着我们可以选择成为任何人，责任意味着我们必须为自己的选择负责。\n\n人生的意义不在于找到答案，而在于不断追问和探索的过程本身。',
    category: 'philosophy',
    tags: ['存在主义', '萨特', '人生意义'],
    created_at: '2024-02-25T11:20:00Z',
    updated_at: '2024-02-25T11:20:00Z'
  },
  {
    id: 'mock-6',
    title: 'AI时代的职业焦虑',
    content: 'ChatGPT的出现让很多人开始担心自己的工作会被AI取代。但历史告诉我们，技术进步总是创造新的机会。\n\n关键是：\n1. 培养AI难以替代的能力（创造力、同理心、批判性思维）\n2. 学会与AI协作，而不是对抗\n3. 保持学习能力和适应能力\n4. 关注人与人之间的连接\n\nAI是工具，不是威胁。',
    category: 'idea',
    tags: ['AI', '职业发展', '未来'],
    created_at: '2024-02-20T13:00:00Z',
    updated_at: '2024-02-20T13:00:00Z'
  }
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
      const dbData = data || [];
      const filteredMock = selectedCategory === 'all'
        ? mockThoughts
        : mockThoughts.filter(t => t.category === selectedCategory);
      setThoughts(dbData.length > 0 ? dbData : filteredMock);
    } catch (error) {
      console.error('Error fetching thoughts:', error);
      const filteredMock = selectedCategory === 'all'
        ? mockThoughts
        : mockThoughts.filter(t => t.category === selectedCategory);
      setThoughts(filteredMock);
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
