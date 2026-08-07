import { useState } from 'react';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';
import type { ChatMessage } from '../../api/types';
import Markdown from '../Markdown';

interface MessageItemProps {
  message: ChatMessage;
}

export default function MessageItem({ message }: MessageItemProps) {
  const [showThinking, setShowThinking] = useState(false);
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[80%] rounded border-2 px-4 py-3 ${
          isUser
            ? 'bg-vintage-red text-white border-vintage-red'
            : 'bg-white text-vintage-dark border-dashed border-vintage-border'
        }`}
      >
        <div className={`flex items-center gap-2 text-xs mb-1 ${isUser ? 'opacity-80' : 'text-vintage-brown'}`}>
          <span className="font-bold">{isUser ? '我' : 'AI'}</span>
          <span className="vintage-number">{format(new Date(message.createdAt), 'HH:mm')}</span>
        </div>
        {message.thinking && (
          <div className="mb-2">
            <button
              type="button"
              onClick={() => setShowThinking((prev) => !prev)}
              className={`flex items-center gap-1 text-xs ${isUser ? 'opacity-80' : 'text-vintage-brown hover:text-vintage-dark'}`}
            >
              <Brain size={14} />
              <span>思考过程</span>
              {showThinking ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
            {showThinking && (
              <p className="mt-1 text-xs whitespace-pre-wrap opacity-70 border-l-2 border-dashed border-vintage-border pl-2">
                {message.thinking}
              </p>
            )}
          </div>
        )}
        {isUser ? (
          <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
        ) : (
          <Markdown content={message.content} />
        )}
      </div>
    </div>
  );
}
