import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ApiError,
  createConversation,
  deleteConversation,
  listConversations,
} from '../api/client';
import type { ConversationSummary } from '../api/types';

export function useConversations() {
  const [data, setData] = useState<ConversationSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const reload = useCallback(async () => {
    try {
      const conversations = await listConversations();
      if (mounted.current) {
        setData(conversations);
        setError(null);
      }
    } catch (reason) {
      if (mounted.current) {
        setError(reason instanceof ApiError ? reason.message : '对话列表加载失败');
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = useCallback(async (): Promise<ConversationSummary | null> => {
    try {
      const created = await createConversation();
      if (mounted.current) setData((prev) => [created, ...prev]);
      return created;
    } catch (reason) {
      if (mounted.current) {
        setError(reason instanceof ApiError ? reason.message : '对话创建失败');
      }
      return null;
    }
  }, []);

  const remove = useCallback(async (id: string): Promise<boolean> => {
    try {
      await deleteConversation(id);
      if (mounted.current) setData((prev) => prev.filter((item) => item.id !== id));
      return true;
    } catch (reason) {
      if (mounted.current) {
        setError(reason instanceof ApiError ? reason.message : '对话删除失败');
      }
      return false;
    }
  }, []);

  return { data, loading, error, reload, create, remove };
}
