import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, createTodo, deleteTodo, listTodos, updateTodo } from '../api/client';
import type { TodoItem, TodoStatus } from '../api/types';

const MUTATION_BUSY_MESSAGE = 'TODO 操作正在进行中';

export function useTodos() {
  const [data, setData] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const requestVersion = useRef(0);
  const mutationVersion = useRef(0);
  const mutationLock = useRef(false);

  const loadData = useCallback(async (
    targetGeneration: number,
    targetMutationVersion: number,
    failureMessage: string,
    useExactFailureMessage = false,
  ) => {
    const request = ++requestVersion.current;
    if (isCurrent(mounted, generation, targetGeneration)) setLoading(true);
    try {
      const todos = await listTodos();
      if (
        isCurrent(mounted, generation, targetGeneration)
        && request === requestVersion.current
      ) {
        setData(todos);
      }
    } catch (reason) {
      if (
        isCurrent(mounted, generation, targetGeneration)
        && request === requestVersion.current
        && targetMutationVersion === mutationVersion.current
      ) {
        setError(useExactFailureMessage
          ? failureMessage
          : messageOf(reason, failureMessage));
      }
      throw reason;
    } finally {
      if (
        isCurrent(mounted, generation, targetGeneration)
        && request === requestVersion.current
      ) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      generation.current += 1;
      requestVersion.current += 1;
      mutationVersion.current += 1;
    };
  }, []);

  useEffect(() => {
    const targetGeneration = ++generation.current;
    const targetMutationVersion = ++mutationVersion.current;
    setData([]);
    setError(null);
    setLoading(true);
    void loadData(targetGeneration, targetMutationVersion, '本地 TODO 加载失败')
      .catch(() => undefined);
    return () => {
      if (generation.current === targetGeneration) generation.current += 1;
      requestVersion.current += 1;
      mutationVersion.current += 1;
    };
  }, [loadData]);

  const load = useCallback(async () => {
    const targetGeneration = generation.current;
    const targetMutationVersion = ++mutationVersion.current;
    if (isCurrent(mounted, generation, targetGeneration)) setError(null);
    await loadData(targetGeneration, targetMutationVersion, '本地 TODO 加载失败');
  }, [loadData]);

  const mutate = useCallback(async (
    operation: () => Promise<unknown>,
    mutationFailureMessage: string,
    refreshFailureMessage: string,
  ) => {
    const targetGeneration = generation.current;
    const targetMutationVersion = ++mutationVersion.current;
    if (mutationLock.current) {
      if (isCurrent(mounted, generation, targetGeneration)) {
        setError(MUTATION_BUSY_MESSAGE);
      }
      throw new ApiError(MUTATION_BUSY_MESSAGE);
    }

    mutationLock.current = true;
    if (isCurrent(mounted, generation, targetGeneration)) setError(null);
    try {
      try {
        await operation();
      } catch (reason) {
        if (
          isCurrent(mounted, generation, targetGeneration)
          && targetMutationVersion === mutationVersion.current
        ) {
          setError(messageOf(reason, mutationFailureMessage));
        }
        throw reason;
      }

      if (isCurrent(mounted, generation, targetGeneration)) {
        try {
          await loadData(
            targetGeneration,
            targetMutationVersion,
            refreshFailureMessage,
            true,
          );
        } catch {
          // The write succeeded; loadData already exposed the distinct refresh error.
        }
      }
    } finally {
      mutationLock.current = false;
    }
  }, [loadData]);

  const create = useCallback(async (input: {
    title: string;
    status?: TodoStatus;
    isImportant?: boolean;
    isUrgent?: boolean;
    tags?: string[];
  }) => {
    await mutate(
      () => createTodo(input),
      '本地 TODO 保存失败',
      'TODO 已保存，但列表刷新失败',
    );
  }, [mutate]);

  const update = useCallback(async (
    id: string,
    patch: {
      title?: string;
      status?: TodoStatus;
      isImportant?: boolean;
      isUrgent?: boolean;
      tags?: string[];
    },
  ) => {
    await mutate(
      () => updateTodo(id, patch),
      '本地 TODO 更新失败',
      'TODO 已更新，但列表刷新失败',
    );
  }, [mutate]);

  const remove = useCallback(async (id: string) => {
    await mutate(
      () => deleteTodo(id),
      '本地 TODO 删除失败',
      'TODO 已删除，但列表刷新失败',
    );
  }, [mutate]);

  return { data, loading, error, load, create, update, remove };
}

function messageOf(reason: unknown, fallback: string) {
  return reason instanceof ApiError ? reason.message : fallback;
}

function isCurrent(
  mounted: { current: boolean },
  generation: { current: number },
  targetGeneration: number,
) {
  return mounted.current && generation.current === targetGeneration;
}
