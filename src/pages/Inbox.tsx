import { useState } from 'react';
import { Check, X, Edit3 } from 'lucide-react';
import { useInbox } from '../hooks/useInbox';
import Loading from '../components/common/Loading';
import ErrorState from '../components/common/ErrorState';
import EmptyState from '../components/common/EmptyState';
import type { InboxItem } from '../api/types';
import { format } from 'date-fns';

export default function Inbox() {
  const { data: items, loading, error, update, convert, ignore } = useInbox();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editStartDate, setEditStartDate] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editConfidence, setEditConfidence] = useState<'exact' | 'fuzzy'>('fuzzy');
  const [editTags, setEditTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  if (loading) return <Loading text="正在加载收件箱..." />;
  if (error) return <ErrorState message={error} />;

  const pending = items.filter((i) => i.status === 'pending');
  const processed = items.filter((i) => i.status !== 'pending');

  function startEdit(item: InboxItem) {
    setEditingId(item.id);
    setEditName(item.aiEventName || '');
    setEditStartDate(item.aiEventStartDate || '');
    setEditEndDate(item.aiEventEndDate || '');
    setEditConfidence(item.dateConfidence);
    setEditTags(item.aiTags);
    setTagInput('');
  }

  function addTag() {
    const trimmed = tagInput.trim();
    if (trimmed && !editTags.includes(trimmed)) {
      setEditTags([...editTags, trimmed]);
    }
    setTagInput('');
  }

  function removeTag(tag: string) {
    setEditTags(editTags.filter((t) => t !== tag));
  }

  async function handleUpdate(id: string) {
    setSaving(true);
    try {
      await update(id, {
        aiEventName: editName.trim(),
        aiEventStartDate: editStartDate,
        aiEventEndDate: editEndDate,
        dateConfidence: editConfidence,
        aiTags: editTags,
      });
      setEditingId(null);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-vintage-dark mb-6">收件箱</h2>

      {items.length === 0 ? (
        <EmptyState title="收件箱为空" description="AI 扫描结果将出现在这里，确认后转为日历事件" />
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-vintage-brown mb-3">
                待确认 ({pending.length})
              </h3>
              <div className="space-y-3">
                {pending.map((item) => (
                  <div key={item.id} className="border border-vintage-brown border-opacity-20 rounded p-4 bg-cream">
                    {editingId === item.id ? (
                      <div className="space-y-3">
                        <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)}
                          placeholder="事件名称" className="vintage-input w-full text-sm" />
                        <div className="grid grid-cols-2 gap-2">
                          <input type="date" value={editStartDate} onChange={(e) => setEditStartDate(e.target.value)}
                            className="vintage-input text-sm" />
                          <input type="date" value={editEndDate} onChange={(e) => setEditEndDate(e.target.value)}
                            className="vintage-input text-sm" />
                        </div>
                        <div className="flex items-center gap-4">
                          <label className="flex items-center gap-1 text-sm">
                            <input type="checkbox" checked={editConfidence === 'fuzzy'}
                              onChange={(e) => setEditConfidence(e.target.checked ? 'fuzzy' : 'exact')} />
                            模糊日期
                          </label>
                        </div>
                        <div>
                          <div className="flex gap-2">
                            <input
                              type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                              placeholder="输入标签后回车添加" className="vintage-input flex-1 text-sm"
                            />
                            <button type="button" onClick={addTag} className="vintage-btn text-sm px-3">添加</button>
                          </div>
                          {editTags.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {editTags.map((tag) => (
                                <span key={tag}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-vintage-brown bg-opacity-15 text-vintage-dark">
                                  {tag}
                                  <button type="button" onClick={() => removeTag(tag)} className="hover:text-vintage-red">&times;</button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => handleUpdate(item.id)} disabled={saving}
                            className="vintage-btn text-xs px-3 py-1">保存</button>
                          <button onClick={() => setEditingId(null)}
                            className="text-xs text-vintage-brown hover:text-vintage-dark">取消</button>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-vintage-dark mb-1">
                              <span className="text-vintage-red font-bold">**{item.aiEventName || '未命名事件'}**</span>
                            </p>
                            <p className="text-sm text-vintage-brown mb-1">{item.sourceSummary}</p>
                            <div className="flex flex-wrap items-center gap-2 text-xs">
                              {item.aiEventStartDate && (
                                <span className="text-vintage-dark">
                                  📅 {item.aiEventStartDate}{item.aiEventEndDate ? ` ~ ${item.aiEventEndDate}` : ''}
                                  {item.dateConfidence === 'fuzzy' && <span className="vintage-stamp ml-1">模糊</span>}
                                </span>
                              )}
                              {item.aiTags.length > 0 && (
                                <span className="text-vintage-brown">
                                  🏷️ {item.aiTags.join(' · ')}
                                </span>
                              )}
                            </div>
                            {item.sourceUrl && (
                              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-vintage-brown underline block mt-1">来源链接</a>
                            )}
                            <p className="text-xs text-vintage-brown mt-1">
                              扫描于 {format(new Date(item.scannedAt), 'MM-dd HH:mm')}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 ml-4">
                            <button onClick={() => startEdit(item)}
                              className="text-xs px-2 py-1 text-vintage-brown hover:text-vintage-dark" title="修改">
                              <Edit3 size={14} />
                            </button>
                            <button onClick={() => convert(item.id)}
                              className="vintage-btn text-xs px-2 py-1 flex items-center gap-1" title="转为事件">
                              <Check size={14} /> 确认
                            </button>
                            <button onClick={() => ignore(item.id)}
                              className="text-xs px-2 py-1 text-vintage-red hover:text-red-700" title="忽略">
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {processed.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-vintage-brown mb-3">
                已处理 ({processed.length})
              </h3>
              <div className="space-y-2">
                {processed.map((item) => (
                  <div key={item.id} className="border border-vintage-brown border-opacity-10 rounded p-3 bg-cream opacity-60">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-vintage-dark">{item.aiEventName || item.sourceSummary.slice(0, 60)}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        item.status === 'converted' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {item.status === 'converted' ? '已转换' : '已忽略'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}