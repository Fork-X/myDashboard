import { useState } from 'react';
import { queryKnowledgeBase } from '../../services/knowledgeBase';
import Modal from '../common/Modal';
import { MessageCircle, Send, Loader2 } from 'lucide-react';

interface KnowledgeAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function KnowledgeAssistant({ isOpen, onClose }: KnowledgeAssistantProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setAnswer('');

    try {
      await queryKnowledgeBase({
        question,
        onUpdate: (content) => {
          setAnswer(content);
        },
        onComplete: (content) => {
          setAnswer(content);
          setLoading(false);
        },
        onError: (error) => {
          setAnswer(`查询失败: ${error.message}`);
          setLoading(false);
        },
      });
    } catch (error) {
      console.error('Knowledge base query error:', error);
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="投资知识助手" size="lg">
      <div className="p-6 bg-vintage-paper">
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="请输入您的投资问题..."
              className="flex-1 px-4 py-3 border-2 border-dashed border-vintage-border rounded bg-white focus:outline-none focus:border-vintage-red"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !question.trim()}
              className="px-6 py-3 bg-vintage-red text-white rounded hover:bg-vintage-dark transition-colors font-bold disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>查询中</span>
                </>
              ) : (
                <>
                  <Send size={18} />
                  <span>提问</span>
                </>
              )}
            </button>
          </div>
        </form>

        {answer && (
          <div className="vintage-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <MessageCircle size={20} className="text-vintage-brown" />
              <h3 className="font-bold text-vintage-dark">回答</h3>
            </div>
            <div className="vintage-divider"></div>
            <div className="mt-4 text-vintage-dark whitespace-pre-wrap">
              {answer}
            </div>
          </div>
        )}

        {!answer && !loading && (
          <div className="text-center text-vintage-brown py-12">
            <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
            <p>请输入您的投资问题，我会为您查询相关知识</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
