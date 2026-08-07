import { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { ApiError, createThought, distillConversation } from '../../api/client';
import Modal from '../common/Modal';

interface DistillModalProps {
  isOpen: boolean;
  conversationId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

type Phase =
  | { kind: 'loading' }
  | { kind: 'error'; message: string }
  | { kind: 'empty'; reason: string }
  | { kind: 'draft' };

export default function DistillModal({
  isOpen, conversationId, onClose, onSaved,
}: DistillModalProps) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !conversationId) return undefined;
    let cancelled = false;
    setPhase({ kind: 'loading' });
    setSaveError(null);
    distillConversation(conversationId)
      .then((draft) => {
        if (cancelled) return;
        if (draft.shouldSave) {
          setTitle(draft.title);
          setContent(draft.content);
          setTagsText(draft.tags.join(', '));
          setPhase({ kind: 'draft' });
        } else {
          setPhase({ kind: 'empty', reason: draft.reason });
        }
      })
      .catch((reason) => {
        if (cancelled) return;
        setPhase({
          kind: 'error',
          message: reason instanceof ApiError ? reason.message : '提炼失败，请稍后重试',
        });
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, conversationId]);

  const handleSave = async () => {
    const tags = tagsText.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean);
    setSaving(true);
    setSaveError(null);
    try {
      await createThought({ title: title.trim(), content: content.trim(), tags });
      onSaved();
      onClose();
    } catch (reason) {
      setSaveError(reason instanceof ApiError ? reason.message : '入库失败，请稍后重试');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="沉淀思考精华" size="lg">
      <div className="p-6 bg-vintage-paper">
        {phase.kind === 'loading' && (
          <div className="flex items-center justify-center gap-2 py-12 text-vintage-brown">
            <Loader2 size={20} className="animate-spin" />
            AI 正在提炼对话精华...
          </div>
        )}

        {phase.kind === 'error' && (
          <p className="py-8 text-center text-sm text-vintage-red">{phase.message}</p>
        )}

        {phase.kind === 'empty' && (
          <p className="py-8 text-center text-sm text-vintage-brown">
            本次对话没有可沉淀的精华：{phase.reason}
          </p>
        )}

        {phase.kind === 'draft' && (
          <div className="space-y-4">
            <p className="text-xs text-vintage-brown">
              以下是 AI 提炼的草稿，确认或修改后才会落入个人思考。
            </p>
            <label className="block">
              <span className="text-sm font-medium text-vintage-dark">标题</span>
              <input
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="mt-1 w-full rounded border-2 border-dashed border-vintage-border bg-white px-3 py-2 text-vintage-dark outline-none focus:border-vintage-red"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-vintage-dark">正文（Markdown）</span>
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={10}
                className="mt-1 w-full resize-y rounded border-2 border-dashed border-vintage-border bg-white px-3 py-2 text-sm text-vintage-dark outline-none focus:border-vintage-red"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-vintage-dark">标签（逗号分隔）</span>
              <input
                type="text"
                value={tagsText}
                onChange={(event) => setTagsText(event.target.value)}
                className="mt-1 w-full rounded border-2 border-dashed border-vintage-border bg-white px-3 py-2 text-vintage-dark outline-none focus:border-vintage-red"
              />
            </label>
            {saveError && <p className="text-sm text-vintage-red">{saveError}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded border-2 border-dashed border-vintage-border px-4 py-2 text-sm text-vintage-dark hover:bg-white"
              >
                取消
              </button>
              <button
                type="button"
                disabled={saving || !title.trim() || !content.trim()}
                onClick={() => void handleSave()}
                className="flex items-center gap-1 rounded border-2 border-vintage-red bg-vintage-red px-4 py-2 text-sm text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                确认入库
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
