import { useEffect, useRef, useState } from 'react';
import {
  Loader2, MessageSquare, Plus, Send, Sparkles, Trash2,
} from 'lucide-react';
import { format } from 'date-fns';
import EmptyState from '../components/common/EmptyState';
import ErrorState from '../components/common/ErrorState';
import Loading from '../components/common/Loading';
import MessageItem from '../components/chat/MessageItem';
import DistillModal from '../components/chat/DistillModal';
import { useConversations } from '../hooks/useConversations';
import { useChatStream } from '../hooks/useChatStream';

export default function Chat() {
  const conversations = useConversations();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [distillOpen, setDistillOpen] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stream = useChatStream(selectedId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const selected = conversations.data.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    const container = scrollRef.current;
    if (container) container.scrollTop = container.scrollHeight;
  }, [stream.messages, stream.draft, stream.draftThinking]);

  useEffect(() => () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
  }, []);

  const handleSaved = () => {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setSavedNotice(true);
    noticeTimer.current = setTimeout(() => setSavedNotice(false), 3000);
  };

  const handleCreate = async () => {
    const created = await conversations.create();
    if (created) setSelectedId(created.id);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('删除该对话及其全部消息？')) return;
    if (await conversations.remove(id) && selectedId === id) setSelectedId(null);
  };

  const handleSend = async () => {
    if (await stream.send(input)) setInput('');
  };

  if (conversations.loading) return <Loading text="正在读取对话..." />;

  if (conversations.error && conversations.data.length === 0) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <ErrorState message={conversations.error} />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex">
      <aside className="w-72 flex-shrink-0 border-r-2 border-dashed border-vintage-border flex flex-col bg-vintage-paper">
        <div className="p-4 border-b-2 border-dashed border-vintage-border flex items-center justify-between">
          <h2 className="font-bold text-vintage-dark">对话列表</h2>
          <button
            type="button"
            onClick={() => void handleCreate()}
            className="flex items-center gap-1 rounded border-2 border-vintage-red bg-vintage-red px-2 py-1 text-sm text-white hover:opacity-90"
          >
            <Plus size={16} />
            新对话
          </button>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-thin p-2 space-y-1">
          {conversations.data.length === 0 ? (
            <p className="p-4 text-sm text-vintage-brown text-center">暂无对话，点击"新对话"开始</p>
          ) : conversations.data.map((item) => (
            <div
              key={item.id}
              className={`group flex items-center gap-1 rounded border-2 px-3 py-2 cursor-pointer transition-colors ${
                selectedId === item.id
                  ? 'bg-white border-vintage-red'
                  : 'border-transparent hover:bg-white hover:border-dashed hover:border-vintage-border'
              }`}
              onClick={() => setSelectedId(item.id)}
            >
              <MessageSquare size={16} className="flex-shrink-0 text-vintage-brown" />
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium text-vintage-dark">
                  {item.title || '未命名对话'}
                </p>
                <p className="text-xs text-vintage-brown vintage-number">
                  {item.messageCount} 条 · {format(new Date(item.updatedAt), 'MM.dd HH:mm')}
                </p>
              </div>
              <button
                type="button"
                aria-label="删除对话"
                onClick={(event) => {
                  event.stopPropagation();
                  void handleDelete(item.id);
                }}
                className="hidden group-hover:block text-vintage-brown hover:text-vintage-red"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className="flex-1 flex flex-col min-w-0">
        {!selectedId ? (
          <div className="flex-1 flex items-center justify-center">
            <EmptyState
              icon={<MessageSquare size={64} />}
              title="选择或新建一个对话"
              description="与 AI 多轮对话，思考精华可沉淀为个人思考"
            />
          </div>
        ) : (
          <>
            <div className="px-6 py-3 border-b-2 border-dashed border-vintage-border bg-vintage-paper flex items-center gap-3">
              <h2 className="flex-1 truncate font-bold text-vintage-dark">
                {selected?.title || '未命名对话'}
              </h2>
              {savedNotice && (
                <span className="text-sm text-vintage-brown">已入库到个人思考</span>
              )}
              <button
                type="button"
                disabled={stream.busy || stream.messages.length === 0}
                onClick={() => setDistillOpen(true)}
                className="flex items-center gap-1 rounded border-2 border-dashed border-vintage-red px-3 py-1 text-sm text-vintage-red hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Sparkles size={16} />
                沉淀精华
              </button>
            </div>
            <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin p-6 space-y-4">
              {stream.loading ? (
                <Loading text="正在读取消息..." />
              ) : (
                <>
                  {stream.messages.map((message) => (
                    <MessageItem key={message.id} message={message} />
                  ))}
                  {(stream.draft || stream.draftThinking) && (
                    <div className="flex justify-start">
                      <div className="max-w-[80%] rounded border-2 border-dashed border-vintage-border bg-white px-4 py-3 text-vintage-dark">
                        {stream.draftThinking && (
                          <p className="mb-2 text-xs whitespace-pre-wrap opacity-70 border-l-2 border-dashed border-vintage-border pl-2 line-clamp-3">
                            {stream.draftThinking}
                          </p>
                        )}
                        <p className="text-sm whitespace-pre-wrap break-words">
                          {stream.draft}
                          <span className="animate-pulse">▍</span>
                        </p>
                      </div>
                    </div>
                  )}
                  {stream.busy && !stream.draft && !stream.draftThinking && (
                    <div className="flex items-center gap-2 text-sm text-vintage-brown">
                      <Loader2 size={16} className="animate-spin" />
                      AI 正在思考...
                    </div>
                  )}
                </>
              )}
            </div>

            {stream.error && (
              <div className="mx-6 mb-2 rounded border-2 border-dashed border-vintage-red bg-white px-3 py-2 text-sm text-vintage-red">
                {stream.error}
              </div>
            )}

            <div className="p-4 border-t-2 border-dashed border-vintage-border bg-vintage-paper">
              <div className="flex items-end gap-2">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  placeholder="输入消息，Enter 发送，Shift+Enter 换行"
                  rows={3}
                  className="flex-1 resize-none rounded border-2 border-dashed border-vintage-border bg-white px-3 py-2 text-sm text-vintage-dark outline-none focus:border-vintage-red"
                />
                <button
                  type="button"
                  disabled={stream.sending || !input.trim()}
                  onClick={() => void handleSend()}
                  className="flex items-center gap-1 rounded border-2 border-vintage-red bg-vintage-red px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {stream.sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                  发送
                </button>
              </div>
            </div>

            <DistillModal
              isOpen={distillOpen}
              conversationId={selectedId}
              onClose={() => setDistillOpen(false)}
              onSaved={handleSaved}
            />
          </>
        )}
      </section>
    </div>
  );
}
