import { useCallback, useEffect, useState } from 'react';
import { ApiError, getConversation, sendChatMessage } from '../api/client';
import type { ChatMessage, ChatStreamEvent } from '../api/types';

function parseStreamEvent(value: unknown): ChatStreamEvent | null {
  if (typeof value !== 'object' || value === null) return null;
  const type = (value as { type?: unknown }).type;
  if (
    type === 'status' || type === 'delta' || type === 'thinking' || type === 'message'
    || type === 'queue' || type === 'turn_end' || type === 'error' || type === 'session_closed'
  ) {
    return value as ChatStreamEvent;
  }
  return null;
}

export function useChatStream(conversationId: string | null) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [draftThinking, setDraftThinking] = useState('');
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState(false);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setDraft('');
      setDraftThinking('');
      setBusy(false);
      setError(null);
      return undefined;
    }

    let cancelled = false;
    setMessages([]);
    setDraft('');
    setDraftThinking('');
    setBusy(false);
    setQueued(false);
    setError(null);
    setLoading(true);

    getConversation(conversationId)
      .then((detail) => {
        if (!cancelled) setMessages(detail.messages);
      })
      .catch((reason) => {
        if (!cancelled) {
          setError(reason instanceof ApiError ? reason.message : '对话记录加载失败');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    const source = new EventSource(`/api/chats/${encodeURIComponent(conversationId)}/stream`);
    // Deltas/messages that arrive while the connection is down are lost;
    // on reconnect, re-sync from the full snapshot (the source of truth).
    let connected = false;
    source.onopen = () => {
      if (cancelled) return;
      if (connected) {
        getConversation(conversationId)
          .then((detail) => {
            if (!cancelled) setMessages(detail.messages);
          })
          .catch(() => {});
      }
      connected = true;
    };
    source.onmessage = (event) => {
      if (cancelled) return;
      let parsed: ChatStreamEvent | null = null;
      try {
        parsed = parseStreamEvent(JSON.parse(event.data));
      } catch {
        return;
      }
      if (!parsed) return;
      switch (parsed.type) {
        case 'status':
          setBusy(parsed.busy);
          break;
        case 'delta':
          setBusy(true);
          setQueued(false);
          setDraft((prev) => prev + parsed.text);
          break;
        case 'thinking':
          setQueued(false);
          setDraftThinking((prev) => prev + parsed.text);
          break;
        case 'message':
          setMessages((prev) => (
            prev.some((item) => item.id === parsed.message.id)
              ? prev
              : [...prev, parsed.message]
          ));
          if (parsed.message.role === 'assistant') {
            setDraft('');
            setDraftThinking('');
          }
          break;
        case 'queue':
          // 平台算力排队：与「卡住」在感官上无法区分，必须显式告知
          setQueued(parsed.status !== 'ready');
          break;
        case 'turn_end':
          setBusy(false);
          setQueued(false);
          setDraft('');
          setDraftThinking('');
          break;
        case 'error':
          setBusy(false);
          setQueued(false);
          setError(parsed.message);
          break;
        case 'session_closed':
          setBusy(false);
          setQueued(false);
          break;
        default:
          break;
      }
    };

    return () => {
      cancelled = true;
      source.close();
    };
  }, [conversationId]);

  const send = useCallback(async (content: string) => {
    const trimmed = content.trim();
    if (!conversationId || !trimmed) return false;
    setSending(true);
    setError(null);
    try {
      const message = await sendChatMessage(conversationId, trimmed);
      setMessages((prev) => (
        prev.some((item) => item.id === message.id) ? prev : [...prev, message]
      ));
      setBusy(true);
      return true;
    } catch (reason) {
      setError(reason instanceof ApiError ? reason.message : '消息发送失败');
      return false;
    } finally {
      setSending(false);
    }
  }, [conversationId]);

  return {
    messages, draft, draftThinking, busy, queued, sending, loading, error, send,
  };
}
