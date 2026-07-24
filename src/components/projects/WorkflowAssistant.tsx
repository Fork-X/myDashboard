import { useState } from 'react';
import { queryWorkflow } from '../../services/workflowAssistant';
import Modal from '../common/Modal';
import { MessageCircle, Send, Loader2, AlertCircle } from 'lucide-react';

interface WorkflowAssistantProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WorkflowAssistant({ isOpen, onClose }: WorkflowAssistantProps) {
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || loading) return;

    setLoading(true);
    setAnswer('');
    setError('');

    try {
      await queryWorkflow({
        question,
        onUpdate: (content) => {
          setAnswer(content);
        },
        onComplete: (content) => {
          setAnswer(content);
          setLoading(false);
        },
        onError: (err) => {
          setError(err.message);
          setLoading(false);
        },
      });
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : '查询失败';
      setError(errorMessage);
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="保证金造数助手" size="lg">
      <div className="p-6 bg-vintage-paper">
        <div className="mb-4 vintage-card p-4">
          <p className="text-sm text-vintage-brown">
            <strong>功能说明：</strong>这是一个用于保证金造数执行的问答助手，可以帮助您解答相关问题。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mb-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="请输入您的问题..."
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

        {error && (
          <div className="vintage-card p-4 mb-6 bg-red-50 border-vintage-red">
            <div className="flex items-start gap-3">
              <AlertCircle size={20} className="text-vintage-red flex-shrink-0 mt-1" />
              <div>
                <h4 className="font-bold text-vintage-red mb-1">查询失败</h4>
                <p className="text-sm text-vintage-dark">{error}</p>
                <p className="text-xs text-vintage-brown mt-2">
                  提示：请确保您在 OneDay 平台内访问此应用，并且 Workflow 已正确配置。
                </p>
              </div>
            </div>
          </div>
        )}

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

        {!answer && !loading && !error && (
          <div className="text-center text-vintage-brown py-12">
            <MessageCircle size={48} className="mx-auto mb-4 opacity-50" />
            <p>请输入您的问题，我会为您查询相关信息</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
