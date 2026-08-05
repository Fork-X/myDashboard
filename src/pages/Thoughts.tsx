import { useState } from 'react';
import { Calendar, Lightbulb, Search, Tag } from 'lucide-react';
import { format } from 'date-fns';
import type { ThoughtItem } from '../api/types';
import Card from '../components/common/Card';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Loading from '../components/common/Loading';
import Modal from '../components/common/Modal';
import { useThoughts } from '../hooks/useThoughts';

export default function Thoughts() {
  const { data, loading, error } = useThoughts();
  const [search, setSearch] = useState('');
  const [selectedTag, setSelectedTag] = useState('all');
  const [selectedThought, setSelectedThought] = useState<ThoughtItem | null>(null);
  const availableTags = Array.from(new Set(data.flatMap((thought) => thought.tags))).sort();
  const normalizedSearch = search.trim().toLowerCase();
  const filteredThoughts = data.filter((thought) => {
    const matchesSearch = normalizedSearch.length === 0
      || thought.title.toLowerCase().includes(normalizedSearch)
      || thought.content.toLowerCase().includes(normalizedSearch);
    const matchesTag = selectedTag === 'all' || thought.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  if (loading) return <Loading text="正在读取个人思考..." />;

  if (error) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <ErrorState message={error} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-vintage-dark">个人思考</h1>
          <p className="mt-2 text-sm text-vintage-brown">只读展示由本地工具追加的提炼内容</p>
        </header>

        <div className="vintage-card p-4 mb-6">
          <label className="relative block">
            <span className="sr-only">搜索标题或正文</span>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-vintage-brown" size={18} />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="搜索标题或正文"
              className="w-full rounded border-2 border-dashed border-vintage-border bg-white py-2 pl-10 pr-3 text-vintage-dark outline-none focus:border-vintage-red"
            />
          </label>

          {availableTags.length > 0 && (
            <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="标签筛选">
              {['all', ...availableTags].map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => setSelectedTag(tag)}
                  className={`whitespace-nowrap rounded border-2 px-3 py-1 text-sm transition-colors ${
                    selectedTag === tag
                      ? 'bg-vintage-red text-white border-vintage-red'
                      : 'bg-vintage-paper text-vintage-dark border-dashed border-vintage-border hover:bg-white'
                  }`}
                >
                  {tag === 'all' ? '全部标签' : tag}
                </button>
              ))}
            </div>
          )}
        </div>

        {filteredThoughts.length === 0 ? (
          <EmptyState
            icon={<Lightbulb size={64} />}
            title={data.length === 0 ? '暂无思考记录' : '没有匹配的思考'}
            description={data.length === 0
              ? '本地工具尚未追加个人思考'
              : '请调整搜索内容或标签筛选'}
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredThoughts.map((thought, index) => (
              <Card
                key={thought.id}
                number={String(index + 1).padStart(4, '0')}
                onClick={() => setSelectedThought(thought)}
              >
                <h2 className="text-lg font-bold text-vintage-dark mb-2">{thought.title}</h2>
                <div className="vintage-divider" />
                <p className="text-vintage-brown text-sm mb-4 line-clamp-4 mt-3">{thought.content}</p>
                <div className="flex items-center gap-2 border-t border-dashed border-vintage-border pt-3 text-xs vintage-number">
                  <Calendar size={14} />
                  <span>{format(new Date(thought.createdAt), 'yyyy.MM.dd HH:mm')}</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap mt-3">
                  <Tag size={14} className="text-vintage-brown" />
                  {thought.tags.length > 0 ? thought.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs text-vintage-brown border border-vintage-border px-2 py-1 rounded"
                    >
                      {tag}
                    </span>
                  )) : (
                    <span className="text-xs text-vintage-brown">无标签</span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        <Modal
          isOpen={selectedThought !== null}
          onClose={() => setSelectedThought(null)}
          title={selectedThought?.title}
          size="lg"
        >
          {selectedThought && (
            <div className="p-6 bg-vintage-paper">
              <div className="flex items-center gap-2 text-sm vintage-number">
                <Calendar size={16} />
                {format(new Date(selectedThought.createdAt), 'yyyy年MM月dd日 HH:mm')}
              </div>
              <div className="vintage-divider my-4" />
              <p className="text-vintage-dark whitespace-pre-wrap">{selectedThought.content}</p>
              <div className="flex items-center gap-2 flex-wrap mt-6 pt-6 border-t-2 border-dashed border-vintage-border">
                <Tag size={16} className="text-vintage-brown" />
                {selectedThought.tags.length > 0 ? selectedThought.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-3 py-1 bg-white text-vintage-dark text-sm rounded border-2 border-dashed border-vintage-border"
                  >
                    {tag}
                  </span>
                )) : (
                  <span className="text-sm text-vintage-brown">无标签</span>
                )}
              </div>
            </div>
          )}
        </Modal>
      </div>
    </div>
  );
}
